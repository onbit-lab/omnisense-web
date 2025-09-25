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

	"github.com/gorilla/websocket"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

// ---------- Subtitle structures ----------

type SubtitleData struct {
	Text      string  `json:"text"`
	Emotion   string  `json:"emotion"`
	Language  string  `json:"language"`
	Timestamp float64 `json:"timestamp"`
	IsFinal   bool    `json:"is_final"`
	Emoji     string  `json:"emoji"`
	LangCode  string  `json:"lang_code"`
}

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("Client connected. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected. Total clients: %d", len(h.clients))
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

var hub *Hub

// ---------- WebSocket upgrader ----------

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin
	},
}

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

func initWebRTCSession(offer *webrtc.SessionDescription) (*webrtc.PeerConnection, *webrtc.TrackLocalStaticRTP, *webrtc.TrackLocalStaticRTP, *webrtc.RTPSender, error) {
	api := webrtc.NewAPI()

	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	}

	pc, err := api.NewPeerConnection(config)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("NewPeerConnection: %w", err)
	}

	// H.264 트랙 (RTP 그대로 씁니다)
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "pion",
	)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("NewTrackLocalStaticRTP video: %w", err)
	}

	// Opus 오디오 트랙
	audioTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio", "pion",
	)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("NewTrackLocalStaticRTP audio: %w", err)
	}

	rtpSender, err := pc.AddTrack(videoTrack)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("AddTrack video: %w", err)
	}
	
	_, err = pc.AddTrack(audioTrack)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("AddTrack audio: %w", err)
	}

	// 브라우저의 RTCP 읽기 루프(에러 나면 종료)
	go readIncomingRTCPPackets(rtpSender)

	// 리모트 SDP 설정
	if err := pc.SetRemoteDescription(*offer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("SetRemoteDescription: %w", err)
	}

	// Answer 생성/설정
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("CreateAnswer: %w", err)
	}
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		return nil, nil, nil, nil, fmt.Errorf("SetLocalDescription: %w", err)
	}

	// ICE 수집 완료 대기 후 반환
	g := webrtc.GatheringCompletePromise(pc)
	<-g

	return pc, videoTrack, audioTrack, rtpSender, nil
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
	if err := conn.SetReadBuffer(4 * 1024 * 1024); err != nil {/* Lines 210-211 omitted */}
	if err := conn.SetWriteBuffer(4 * 1024 * 1024); err != nil {/* Lines 213-214 omitted */}

	la := conn.LocalAddr().(*net.UDPAddr)
	log.Printf("UDP listener ready on %s:%d", la.IP.String(), la.Port)
	return conn
}

// Audio UDP listener
func initAudioUDPListener() *net.UDPConn {
	bindIP := getenvStr("RTP_BIND_IP", "0.0.0.0")
	port := getenvInt("RTP_AUDIO_PORT", 5006)

	addr := &net.UDPAddr{
		IP:   net.ParseIP(bindIP),
		Port: port,
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("failed to bind UDP (audio) %s:%d: %v", bindIP, port, err)
	}

	// 버퍼 여유
	if err := conn.SetReadBuffer(1 * 1024 * 1024); err != nil {}
	if err := conn.SetWriteBuffer(1 * 1024 * 1024); err != nil {}

	la := conn.LocalAddr().(*net.UDPAddr)
	log.Printf("Audio UDP listener ready on %s:%d", la.IP.String(), la.Port)
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

// ---------- WebSocket handlers ----------

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		conn: conn,
		send: make(chan []byte, 256),
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------- ICE 상태 변화 시 정리 ----------

func handleICEConnectionState(pc *webrtc.PeerConnection, gstHandle *exec.Cmd, listener *net.UDPConn, audioListener *net.UDPConn, streamInProgress *bool) {
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
			if audioListener != nil {
				_ = audioListener.Close()
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
	// WebSocket Hub 초기화
	hub = newHub()
	go hub.run()

	// 정적 파일
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	// WebSocket 엔드포인트
	http.HandleFunc("/ws", handleWebSocket)

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

		pc, videoTrack, audioTrack, rtpSender, err := initWebRTCSession(&offer)
		if err != nil {
			http.Error(w, "Failed to init WebRTC: "+err.Error(), http.StatusInternalServerError)
			return
		}
		_ = rtpSender // RTCP 루프는 initWebRTCSession 안에서 시작됨

		// 비디오 UDP 수신(Radxa -> 이 서버)
		listener := initUDPListener()
		go sendRtpToClient(videoTrack, listener)
		
		// 오디오 UDP 수신(마이크 -> 이 서버)
		audioListener := initAudioUDPListener()
		go sendRtpToClient(audioTrack, audioListener)

		// 기본: 로컬 GStreamer OFF (Radxa가 쏨). 필요 시 ENV로 토글.
		var gstHandle *exec.Cmd
		if os.Getenv("LOCAL_GST") == "1" {
			gstHandle = runGstreamerPipeline(gstContext)
		}

		handleICEConnectionState(pc, gstHandle, listener, audioListener, &streamInProgress)
		streamInProgress = true

		// SDP answer 반환
		fmt.Fprint(w, encode(pc.LocalDescription()))
		log.Printf("Sent local SessionDescription to browser (elapsed=%s)", time.Since(start))
	})

	// 자막 수신 엔드포인트
	http.HandleFunc("/subtitle", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var subtitle SubtitleData
		if err := json.NewDecoder(r.Body).Decode(&subtitle); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// 자막을 JSON으로 직렬화하여 WebSocket으로 브로드캐스트
		message, err := json.Marshal(subtitle)
		if err != nil {
			log.Printf("Failed to marshal subtitle: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		hub.broadcast <- message
		
		log.Printf("Received subtitle: %s [%s] %s", subtitle.LangCode, subtitle.Emoji, subtitle.Text)
		
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	addr := ":" + strconv.Itoa(getenvInt("HTTP_PORT", 8080))
	log.Printf("Server starting on %s ...", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("HTTP Server error: ", err)
	}
}

