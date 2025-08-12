package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

// ---------- helpers ----------

func getenvStr(k, d string) string {
	v := os.Getenv(k)
	if v == "" {
		return d
	}
	return v
}
func getenvInt(k string, d int) int {
	if s := os.Getenv(k); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			return n
		}
	}
	return d
}

// encode: JSON -> base64 string
func encode(v any) string {
	b, _ := json.Marshal(v)
	return base64.StdEncoding.EncodeToString(b)
}

// decode: base64 string -> JSON -> v
func decode(s string, v any) error {
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, v)
}

// ---------- WebRTC ----------

// 확장: 비디오 + 오디오 트랙을 모두 추가하고, Answer 생성까지 수행
func initWebRTCSession(offer *webrtc.SessionDescription) (
	*webrtc.PeerConnection,
	*webrtc.TrackLocalStaticRTP, *webrtc.RTPSender, // video
	*webrtc.TrackLocalStaticRTP, *webrtc.RTPSender, // audio
	error,
) {
	api := webrtc.NewAPI()

	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	}

	pc, err := api.NewPeerConnection(config)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("NewPeerConnection: %w", err)
	}

	// --- Video (H.264)
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "pion-v",
	)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("NewTrackLocalStaticRTP(video): %w", err)
	}
	rtpSenderVideo, err := pc.AddTrack(videoTrack)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("AddTrack(video): %w", err)
	}
	go readIncomingRTCPPackets(rtpSenderVideo)

	// --- Audio (Opus 48kHz, 2ch)
	audioTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		"audio", "pion-a",
	)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("NewTrackLocalStaticRTP(audio): %w", err)
	}
	rtpSenderAudio, err := pc.AddTrack(audioTrack)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("AddTrack(audio): %w", err)
	}
	go readIncomingRTCPPackets(rtpSenderAudio)

	// --- Set remote / Create answer
	if err := pc.SetRemoteDescription(*offer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("SetRemoteDescription: %w", err)
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("CreateAnswer: %w", err)
	}
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, nil, fmt.Errorf("SetLocalDescription: %w", err)
	}

	// ICE 수집 완료 대기 후 반환
	g := webrtc.GatheringCompletePromise(pc)
	<-g

	return pc, videoTrack, rtpSenderVideo, audioTrack, rtpSenderAudio, nil
}

func readIncomingRTCPPackets(sender *webrtc.RTPSender) {
	buf := make([]byte, 1500)
	for {
		if _, _, err := sender.Read(buf); err != nil {
			return // 연결 종료/에러 시 루프 종료
		}
	}
}

// ---------- UDP(RTP) ----------

func initUDPListenerVideo() *net.UDPConn {
	return initUDPListener(getenvStr("RTP_BIND_IP", "0.0.0.0"), getenvInt("RTP_PORT", 5004))
}
func initUDPListenerAudio() *net.UDPConn {
	return initUDPListener(getenvStr("RTP_BIND_IP", "0.0.0.0"), getenvInt("RTP_AUDIO_PORT", 5006))
}

func initUDPListener(bindIP string, port int) *net.UDPConn {
	addr := &net.UDPAddr{
		IP:   net.ParseIP(bindIP),
		Port: port,
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("failed to bind UDP %s:%d: %v", bindIP, port, err)
	}

	// 버퍼 여유
	if err := conn.SetReadBuffer(4 * 1024 * 1024); err != nil {
		log.Printf("warn: SetReadBuffer failed: %v", err)
	}
	if err := conn.SetWriteBuffer(4 * 1024 * 1024); err != nil {
		log.Printf("warn: SetWriteBuffer failed: %v", err)
	}

	la := conn.LocalAddr().(*net.UDPAddr)
	log.Printf("UDP listener ready on %s:%d", la.IP.String(), la.Port)
	return conn
}

func pumpRTPToTrack(track *webrtc.TrackLocalStaticRTP, listener *net.UDPConn) {
	defer func() {
		_ = listener.Close()
	}()

	buf := make([]byte, 2048)
	var pkt rtp.Packet

	for {
		n, _, err := listener.ReadFrom(buf)
		if err != nil {
			if !isNetClosedErr(err) {
				log.Printf("RTP read error: %v", err)
			}
			return
		}
		if err := pkt.Unmarshal(buf[:n]); err != nil {
			continue
		}
		if err := track.WriteRTP(&pkt); err != nil {
			if !isNetClosedErr(err) {
				log.Printf("track.WriteRTP error: %v", err)
			}
			return
		}
	}
}

func isNetClosedErr(err error) bool {
	if err == nil {
		return false
	}
	es := err.Error()
	return es == "use of closed network connection" ||
		es == "EOF" ||
		es == "file already closed"
}

// ---------- (옵션) 로컬 GStreamer ----------
// LOCAL_GST=1 일 때만 시도.

func runGstreamerPipelineVideo(ctx context.Context) *exec.Cmd {
	if os.Getenv("LOCAL_GST") != "1" {
		return nil
	}
	cmdline := getenvStr("GST_CMD",
		`gst-launch-1.0 -v `+
			`v4l2src device=/dev/video0 io-mode=4 ! `+
			`video/x-raw,width=1280,height=720 ! `+
			`queue ! mpph264enc profile=baseline header-mode=each-idr ! `+
			`rtph264pay pt=96 mtu=1200 config-interval=1 ! `+
			`udpsink host=127.0.0.1 port=`+strconv.Itoa(getenvInt("RTP_PORT", 5004)),
	)
	cmd := exec.CommandContext(ctx, "bash", "-lc", cmdline)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Printf("failed to start local GStreamer(video) (ignored): %v", err)
		return nil
	}
	log.Printf("local GStreamer(video) started (pid=%d)", cmd.Process.Pid)
	return cmd
}

func runGstreamerPipelineAudio(ctx context.Context) *exec.Cmd {
	if os.Getenv("LOCAL_GST") != "1" {
		return nil
	}
	cmdline := getenvStr("GST_CMD_AUDIO",
		`gst-launch-1.0 -v `+
			`alsasrc device=hw:0 ! audioconvert ! audioresample ! `+
			`opusenc bitrate=64000 frame-size=2.5 inband-fec=true ! `+
			`rtpopuspay pt=111 ! `+
			`udpsink host=127.0.0.1 port=`+strconv.Itoa(getenvInt("RTP_AUDIO_PORT", 5006))+` sync=false`,
	)
	cmd := exec.CommandContext(ctx, "bash", "-lc", cmdline)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Printf("failed to start local GStreamer(audio) (ignored): %v", err)
		return nil
	}
	log.Printf("local GStreamer(audio) started (pid=%d)", cmd.Process.Pid)
	return cmd
}

// ---------- ICE 상태 변화 시 정리 ----------

func handleICEConnectionState(
	pc *webrtc.PeerConnection,
	gstVideo, gstAudio *exec.Cmd,
	udpVideo, udpAudio *net.UDPConn,
	streamInProgress *bool,
) {
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("ICE state: %s", s.String())

		switch s {
		case webrtc.PeerConnectionStateFailed,
			webrtc.PeerConnectionStateClosed,
			webrtc.PeerConnectionStateDisconnected:

			// 자원 반납 (nil-safe)
			if gstVideo != nil && gstVideo.Process != nil {
				_ = gstVideo.Process.Kill()
				log.Printf("terminated local GStreamer(video)")
			}
			if gstAudio != nil && gstAudio.Process != nil {
				_ = gstAudio.Process.Kill()
				log.Printf("terminated local GStreamer(audio)")
			}
			if udpVideo != nil {
				_ = udpVideo.Close()
			}
			if udpAudio != nil {
				_ = udpAudio.Close()
			}
			if pc != nil {
				_ = pc.Close()
			}
			*streamInProgress = false
		}
	})
}

// ---------- HTTP server ----------

func main() {
	// 정적 파일
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	gstCtx, cancelGst := context.WithCancel(context.Background())
	defer cancelGst()

	var streamInProgress bool

	http.HandleFunc("/post", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if streamInProgress {
			log.Println("Attempted new session while stream in progress")
			http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Unable to read request", http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		var offer webrtc.SessionDescription
		if err := decode(string(body), &offer); err != nil {
			http.Error(w, "Bad offer (decode)", http.StatusBadRequest)
			return
		}
		log.Println("Received SessionDescription from browser")

		// WebRTC: 비디오+오디오 트랙 준비 및 Answer 생성
		pc, videoTrack, rtpSenderVideo, audioTrack, rtpSenderAudio, err := initWebRTCSession(&offer)
		if err != nil {
			http.Error(w, "Failed to init WebRTC: "+err.Error(), http.StatusInternalServerError)
			return
		}
		_ = rtpSenderVideo
		_ = rtpSenderAudio // RTCP 루프는 initWebRTCSession 안에서 시작됨

		// UDP 수신 소켓 (Radxa -> 이 서버)
		udpVideo := initUDPListenerVideo()
		udpAudio := initUDPListenerAudio()

		// RTP → WebRTC 트랙으로 전달
		go pumpRTPToTrack(videoTrack, udpVideo)
		go pumpRTPToTrack(audioTrack, udpAudio)

		// (옵션) 로컬 GStreamer 자동 실행
		var gstVideo, gstAudio *exec.Cmd
		if os.Getenv("LOCAL_GST") == "1" {
			gstVideo = runGstreamerPipelineVideo(gstCtx)
			gstAudio = runGstreamerPipelineAudio(gstCtx)
		}

		handleICEConnectionState(pc, gstVideo, gstAudio, udpVideo, udpAudio, &streamInProgress)
		streamInProgress = true

		// SDP answer 반환
		fmt.Fprint(w, encode(pc.LocalDescription()))
		log.Printf("Sent local SessionDescription to browser (elapsed=%s)", time.Since(start))
	})

	addr := ":" + strconv.Itoa(getenvInt("HTTP_PORT", 8080))
	log.Printf("Server starting on %s ...", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("HTTP Server error: ", err)
	}
}
