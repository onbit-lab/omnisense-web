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

func initWebRTCSession(offer *webrtc.SessionDescription) (*webrtc.PeerConnection, *webrtc.TrackLocalStaticRTP, *webrtc.RTPSender, error) {
	api := webrtc.NewAPI()

	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	}

	pc, err := api.NewPeerConnection(config)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("NewPeerConnection: %w", err)
	}

	// H.264 트랙 (RTP 그대로 씁니다)
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "pion",
	)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, fmt.Errorf("NewTrackLocalStaticRTP: %w", err)
	}

	rtpSender, err := pc.AddTrack(videoTrack)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, fmt.Errorf("AddTrack: %w", err)
	}

	// 브라우저의 RTCP 읽기 루프(에러 나면 종료)
	go readIncomingRTCPPackets(rtpSender)

	// 리모트 SDP 설정
	if err := pc.SetRemoteDescription(*offer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, fmt.Errorf("SetRemoteDescription: %w", err)
	}

	// Answer 생성/설정
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, fmt.Errorf("CreateAnswer: %w", err)
	}
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, fmt.Errorf("SetLocalDescription: %w", err)
	}

	// ICE 수집 완료 대기 후 반환
	g := webrtc.GatheringCompletePromise(pc)
	<-g

	return pc, videoTrack, rtpSender, nil
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

func initUDPListener() *net.UDPConn {
	bindIP := getenvStr("RTP_BIND_IP", "0.0.0.0")
	port := getenvInt("RTP_PORT", 5004)

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

func sendRtpToClient(track *webrtc.TrackLocalStaticRTP, listener *net.UDPConn) {
	defer func() {
		_ = listener.Close()
	}()

	buf := make([]byte, 2048)
	var pkt rtp.Packet

	for {
		n, _, err := listener.ReadFrom(buf)
		if err != nil {
			// listener close 등으로 종료됨
			if !isNetClosedErr(err) {
				log.Printf("RTP read error: %v", err)
			}
			return
		}

		if err := pkt.Unmarshal(buf[:n]); err != nil {
			// 가끔 나쁜 패킷이 들어오면 스킵
			continue
		}

		if err := track.WriteRTP(&pkt); err != nil {
			log.Printf("track.WriteRTP error: %v", err)
			return
		}
	}
}

func isNetClosedErr(err error) bool {
	if err == nil {
		return false
	}
	// 플랫폼별 메시지가 달라서 문자열 포함 체크
	es := err.Error()
	return es == "use of closed network connection" ||
		es == "EOF" ||
		es == "file already closed"
}

// ---------- (옵션) 로컬 GStreamer ----------
// 기본값으로는 사용하지 않습니다. LOCAL_GST=1 일 때만 시도.
func runGstreamerPipeline(ctx context.Context) *exec.Cmd {
	if os.Getenv("LOCAL_GST") != "1" {
		return nil
	}

	// ※ 예시: Rockchip 환경(라즈베리에선 보통 실패)
	// 필요하면 환경 변수 GST_CMD 로 명령을 교체하세요.
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
		log.Printf("failed to start local GStreamer (ignored): %v", err)
		return nil
	}
	log.Printf("local GStreamer started (pid=%d)", cmd.Process.Pid)
	return cmd
}

// ---------- ICE 상태 변화 시 정리 ----------

func handleICEConnectionState(pc *webrtc.PeerConnection, gstHandle *exec.Cmd, listener *net.UDPConn, streamInProgress *bool) {
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("ICE state: %s", s.String())

		switch s {
		case webrtc.PeerConnectionStateFailed,
			webrtc.PeerConnectionStateClosed,
			webrtc.PeerConnectionStateDisconnected:
			// 자원 반납 (nil-safe)
			if gstHandle != nil && gstHandle.Process != nil {
				_ = gstHandle.Process.Kill()
				log.Printf("terminated local GStreamer")
			}
			if listener != nil {
				_ = listener.Close()
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

	gstContext, cancelGst := context.WithCancel(context.Background())
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

		pc, videoTrack, rtpSender, err := initWebRTCSession(&offer)
		if err != nil {
			http.Error(w, "Failed to init WebRTC: "+err.Error(), http.StatusInternalServerError)
			return
		}
		_ = rtpSender // RTCP 루프는 initWebRTCSession 안에서 시작됨

		// UDP 수신(Radxa -> 이 서버)
		listener := initUDPListener()
		go sendRtpToClient(videoTrack, listener)

		// 기본: 로컬 GStreamer OFF (Radxa가 쏨). 필요 시 ENV로 토글.
		var gstHandle *exec.Cmd
		if os.Getenv("LOCAL_GST") == "1" {
			gstHandle = runGstreamerPipeline(gstContext)
		}

		handleICEConnectionState(pc, gstHandle, listener, &streamInProgress)
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

