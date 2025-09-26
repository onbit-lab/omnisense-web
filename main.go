package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
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

type SystemStatus struct {
	Battery     string `json:"battery"`
	Signal      string `json:"signal"`
	Temperature string `json:"temperature"`
	Storage     string `json:"storage"`
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

func initWebRTCSession(offer *webrtc.SessionDescription, isLocalhost bool) (*webrtc.PeerConnection, *webrtc.TrackLocalStaticRTP, *webrtc.TrackLocalStaticRTP, error) {
	log.Printf("Initializing WebRTC session (localhost: %t)", isLocalhost)
	
	// localhost/내부망 접속인 경우 STUN 서버 없이 직접 연결
	var iceServers []webrtc.ICEServer
	if !isLocalhost {
		iceServers = []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		}
	}
	
	// localhost 환경에 최적화된 설정
	config := webrtc.Configuration{
		ICEServers:         iceServers,
		ICETransportPolicy: webrtc.ICETransportPolicyAll,
		BundlePolicy:       webrtc.BundlePolicyMaxBundle,
	}
	
	// localhost인 경우 추가 최적화 설정
	var s webrtc.SettingEngine
	if isLocalhost {
		// 로컬 연결용 포트 범위 제한
		s.SetEphemeralUDPPortRange(50000, 50100)
		// 네트워크 인터페이스 필터링
		s.SetIncludeLoopbackCandidate(true)
	}
	
	var pc *webrtc.PeerConnection
	var err error
	if isLocalhost {
		api := webrtc.NewAPI(webrtc.WithSettingEngine(s))
		pc, err = api.NewPeerConnection(config)
	} else {
		pc, err = webrtc.NewPeerConnection(config)
	}
	
	if err != nil {
		return nil, nil, nil, fmt.Errorf("NewPeerConnection: %w", err)
	}

	// 트랙 생성 및 추가
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "video", "pion")
	if err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("video track: %w", err)
	}

	audioTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus}, "audio", "pion")
	if err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("audio track: %w", err)
	}

	if _, err = pc.AddTrack(videoTrack); err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("add video track: %w", err)
	}
	if _, err = pc.AddTrack(audioTrack); err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("add audio track: %w", err)
	}

	// SDP 처리
	if err := pc.SetRemoteDescription(*offer); err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("SetRemoteDescription: %w", err)
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("CreateAnswer: %w", err)
	}
	if err := pc.SetLocalDescription(answer); err != nil {
		pc.Close()
		return nil, nil, nil, fmt.Errorf("SetLocalDescription: %w", err)
	}

	// ICE 수집 완료 대기
	<-webrtc.GatheringCompletePromise(pc)
	return pc, videoTrack, audioTrack, nil
}



// ---------- UDP(RTP) ----------

func initUDPListener(portEnv string, defaultPort int, label string) (*net.UDPConn, error) {
	addr := &net.UDPAddr{
		IP:   net.ParseIP(getenvStr("RTP_BIND_IP", "0.0.0.0")),
		Port: getenvInt(portEnv, defaultPort),
	}
	
	lc := &net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			var err error
			c.Control(func(fd uintptr) {
				err = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1)
			})
			return err
		},
	}
	
	conn, err := lc.ListenPacket(context.Background(), "udp", addr.String())
	if err != nil {
		return nil, fmt.Errorf("%s UDP port %d in use", label, addr.Port)
	}
	
	udpConn := conn.(*net.UDPConn)
	bufSize := 2 * 1024 * 1024
	udpConn.SetReadBuffer(bufSize)
	udpConn.SetWriteBuffer(bufSize)

	log.Printf("%s UDP listener ready on %s", label, addr)
	return udpConn, nil
}

func sendRtpToClient(track *webrtc.TrackLocalStaticRTP, listener *net.UDPConn) {
	defer listener.Close()
	
	buf := make([]byte, 2048)
	var pkt rtp.Packet

	for {
		n, _, err := listener.ReadFrom(buf)
		if err != nil {
			return // 연결 종료
		}

		if pkt.Unmarshal(buf[:n]) == nil {
			track.WriteRTP(&pkt)
		}
	}
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
		log.Printf("WebSocket client disconnected")
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(30 * time.Second)) // 더 짧은 타임아웃
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		return nil
	})

	// 연결 끊김을 즉시 감지하기 위한 클로즈 핸들러
	c.conn.SetCloseHandler(func(code int, text string) error {
		log.Printf("WebSocket close: code=%d, text=%s", code, text)
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
				log.Printf("WebSocket unexpected error: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second) // 더 빈번한 핑
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second)) // 더 짧은 타임아웃
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// 대기 중인 메시지들 일괄 처리
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func setupPeerConnection(pc *webrtc.PeerConnection, cleanup func()) {
	var once bool
	
	doCleanup := func(reason string) {
		if !once {
			once = true
			log.Printf("Connection ended: %s", reason)
			cleanup()
		}
	}

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("Connection: %s", s.String())
		switch s {
		case webrtc.PeerConnectionStateFailed, 
			 webrtc.PeerConnectionStateClosed,
			 webrtc.PeerConnectionStateDisconnected:
			doCleanup(s.String())
		}
	})

	pc.OnICEConnectionStateChange(func(s webrtc.ICEConnectionState) {
		log.Printf("ICE: %s", s.String())
		switch s {
		case webrtc.ICEConnectionStateFailed,
			 webrtc.ICEConnectionStateClosed,
			 webrtc.ICEConnectionStateDisconnected:
			doCleanup(s.String())
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

	var streamInProgress bool

	http.HandleFunc("/post", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("Stream request received")
		
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if streamInProgress {
			log.Printf("Stream blocked - already in progress")
			http.Error(w, "Stream already in progress", http.StatusServiceUnavailable)
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
			http.Error(w, "Bad offer", http.StatusBadRequest)
			return
		}
		log.Printf("Received offer")

		// localhost/내부망 접속 감지
		host := r.Host
		isLocalhost := strings.Contains(host, "localhost") || 
					   strings.Contains(host, "127.0.0.1") ||
					   strings.Contains(host, "::1") ||
					   strings.Contains(host, "192.168.") ||
					   strings.Contains(host, "10.") ||
					   strings.Contains(host, "172.")

		pc, videoTrack, audioTrack, err := initWebRTCSession(&offer, isLocalhost)
		if err != nil {
			http.Error(w, "WebRTC failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// UDP 리스너 초기화
		videoListener, err := initUDPListener("RTP_PORT", 5004, "Video")
		if err != nil {
			pc.Close()
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		
		audioListener, err := initUDPListener("RTP_AUDIO_PORT", 5006, "Audio")
		if err != nil {
			pc.Close()
			videoListener.Close()
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}

		// RTP 전송 시작
		go sendRtpToClient(videoTrack, videoListener)
		go sendRtpToClient(audioTrack, audioListener)

		// 즉시 정리를 위한 연결 모니터링
		streamInProgress = true
		setupPeerConnection(pc, func() {
			streamInProgress = false
			videoListener.Close()
			audioListener.Close()
			pc.Close()
			log.Printf("Stream resources cleaned up")
		})

		// SDP answer 반환
		fmt.Fprint(w, encode(pc.LocalDescription()))
		log.Printf("Stream started (elapsed=%s)", time.Since(start))
	})

	// Reset endpoint to clear stream state in case of issues
	http.HandleFunc("/reset", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		streamInProgress = false
		log.Printf("Stream state reset by client request (method: %s)", r.Method)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK - Stream state reset"))
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

	// 시스템 상태 엔드포인트
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		status := getSystemStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	})

	port := getenvInt("HTTP_PORT", 8080)
	addr := ":" + strconv.Itoa(port)
	
	log.Printf("🚀 OMNISENSE Server starting...")
	log.Printf("📍 Server: http://localhost:%d", port)
	
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("HTTP Server error: ", err)
	}
}



func getSystemStatus() SystemStatus {
	status := SystemStatus{
		Battery:     getBatteryStatus(),
		Signal:      getNetworkStatus(),
		Temperature: getCPUTemperature(),
		Storage:     getStorageStatus(),
	}
	return status
}

func getBatteryStatus() string {
	powerSupplyDir := "/sys/class/power_supply"
	entries, err := os.ReadDir(powerSupplyDir)
	if err != nil {
		return "전원 정보 없음"
	}
	
	var hasBattery bool
	var hasActivePower bool
	var batteryLevel string
	var powerType string
	
	for _, entry := range entries {
		path := powerSupplyDir + "/" + entry.Name()
		
		// 타입 확인
		if typeData, err := ioutil.ReadFile(path + "/type"); err == nil {
			typeStr := strings.TrimSpace(string(typeData))
			
			if typeStr == "USB" {
				// USB-C PD 전원 확인 - voltage_now와 current_now로 실제 전력 공급 확인
				if voltageData, err := ioutil.ReadFile(path + "/voltage_now"); err == nil {
					if currentData, err2 := ioutil.ReadFile(path + "/current_now"); err2 == nil {
						voltage := strings.TrimSpace(string(voltageData))
						current := strings.TrimSpace(string(currentData))
						
						if voltageVal, err3 := strconv.Atoi(voltage); err3 == nil && voltageVal > 1000000 { // 1V 이상
							hasActivePower = true
							powerType = "USB-C 전원"
						} else if currentVal, err4 := strconv.Atoi(current); err4 == nil && currentVal > 100000 { // 100mA 이상
							hasActivePower = true
							powerType = "USB-C 전원"
						}
					}
				}
				
				// online 상태도 확인
				if onlineData, err := ioutil.ReadFile(path + "/online"); err == nil {
					if strings.TrimSpace(string(onlineData)) == "1" {
						hasActivePower = true
						powerType = "USB-C 전원"
					}
				}
			} else if typeStr == "Mains" || typeStr == "USB_PD" {
				// 일반적인 AC 어댑터 확인
				if onlineData, err := ioutil.ReadFile(path + "/online"); err == nil {
					if strings.TrimSpace(string(onlineData)) == "1" {
						hasActivePower = true
						if typeStr == "USB_PD" {
							powerType = "USB-PD 전원"
						} else {
							powerType = "AC 전원"
						}
					}
				}
			} else if typeStr == "Battery" {
				hasBattery = true
				if capacityData, err := ioutil.ReadFile(path + "/capacity"); err == nil {
					batteryLevel = strings.TrimSpace(string(capacityData)) + "%"
				}
			}
		}
	}
	
	// 실제 전력 공급 여부 확인 - 시스템이 켜져 있다는 것은 전원이 공급되고 있다는 뜻
	if !hasActivePower {
		// 시스템이 실행 중이므로 어떤 형태로든 전력이 공급되고 있음
		// USB-C 타입이 감지되었다면 USB-C 전원으로 간주
		for _, entry := range entries {
			path := powerSupplyDir + "/" + entry.Name()
			if typeData, err := ioutil.ReadFile(path + "/type"); err == nil {
				if strings.TrimSpace(string(typeData)) == "USB" {
					if usbTypeData, err2 := ioutil.ReadFile(path + "/usb_type"); err2 == nil {
						if strings.Contains(string(usbTypeData), "PD") {
							hasActivePower = true
							powerType = "USB-C PD 전원"
							break
						}
					}
				}
			}
		}
	}
	
	if hasActivePower {
		if hasBattery && batteryLevel != "" {
			return powerType + " (" + batteryLevel + ")"
		}
		return powerType
	}
	
	if hasBattery && batteryLevel != "" {
		return batteryLevel
	}
	
	// 마지막 수단: 시스템이 실행 중이므로 전원 공급 중
	return "전원 공급 중"
}

func getNetworkStatus() string {
	// nmcli로 연결 상태 확인
	cmd := exec.Command("nmcli", "device", "status")
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				deviceName := fields[0]
				deviceType := fields[1] 
				state := fields[2]
				
				if state == "connected" {
					if deviceType == "ethernet" {
						return "유선 연결"
					} else if deviceType == "wifi" {
						// WiFi 신호 강도 확인
						return getWiFiSignalStrengthNmcli(deviceName)
					}
				}
			}
		}
	}
	
	// 백업: /sys/class/net 디렉토리 확인
	netDir := "/sys/class/net"
	if entries, err := os.ReadDir(netDir); err == nil {
		for _, entry := range entries {
			ifaceName := entry.Name()
			if ifaceName == "lo" {
				continue
			}
			
			ifacePath := netDir + "/" + ifaceName
			if operData, err := ioutil.ReadFile(ifacePath + "/operstate"); err == nil {
				if strings.TrimSpace(string(operData)) == "up" {
					// 유선 연결 확인
					if strings.HasPrefix(ifaceName, "end") || strings.HasPrefix(ifaceName, "eth") || strings.HasPrefix(ifaceName, "enp") {
						if carrierData, err := ioutil.ReadFile(ifacePath + "/carrier"); err == nil {
							if strings.TrimSpace(string(carrierData)) == "1" {
								return "유선 연결"
							}
						}
					}
					
					// WiFi 연결 확인
					if strings.HasPrefix(ifaceName, "wl") {
						return getWiFiSignalStrengthNmcli(ifaceName)
					}
				}
			}
		}
	}
	
	return "연결 없음"
}

func getWiFiSignalStrengthNmcli(deviceName string) string {
	cmd := exec.Command("nmcli", "device", "wifi", "list", "ifname", deviceName)
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for i, line := range lines {
			if i == 0 || !strings.Contains(line, "*") {
				continue
			}
			fields := strings.Fields(line)
			for j := 2; j < len(fields); j++ {
				if val, err := strconv.Atoi(fields[j]); err == nil {
					if val >= 0 && val <= 100 {
						return getSignalStrengthFromPercentage(val)
					} else if val <= 0 && val >= -100 {
						return getSignalStrengthFromDbm(val)
					}
				}
			}
		}
	}
	return "WiFi 연결"
}

func getSignalStrengthFromPercentage(percentage int) string {
	if percentage >= 70 {
		return "WiFi 강함"
	} else if percentage >= 40 {
		return "WiFi 보통"
	}
	return "WiFi 약함"
}

func getSignalStrengthFromDbm(dbm int) string {
	if dbm >= -30 {
		return "WiFi 강함"
	} else if dbm >= -60 {
		return "WiFi 보통"
	}
	return "WiFi 약함"
}



func getCPUTemperature() string {
	// CPU 온도 확인 (여러 경로 시도)
	tempPaths := []string{
		"/sys/class/thermal/thermal_zone0/temp",
		"/sys/class/thermal/thermal_zone1/temp",
		"/sys/devices/virtual/thermal/thermal_zone0/temp",
	}
	
	for _, path := range tempPaths {
		if data, err := ioutil.ReadFile(path); err == nil {
			tempStr := strings.TrimSpace(string(data))
			if temp, err := strconv.Atoi(tempStr); err == nil {
				// milli-celsius를 celsius로 변환
				celsius := temp / 1000
				return fmt.Sprintf("%d°C", celsius)
			}
		}
	}
	
	// sensors 명령어 시도
	cmd := exec.Command("sensors")
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(line, "Core 0") || strings.Contains(line, "CPU") {
				if strings.Contains(line, "°C") {
					parts := strings.Fields(line)
					for _, part := range parts {
						if strings.HasSuffix(part, "°C") {
							return part
						}
					}
				}
			}
		}
	}
	
	return "N/A"
}

func getStorageStatus() string {
	cmd := exec.Command("df", "-h", "/")
	output, err := cmd.Output()
	if err != nil {
		return "N/A"
	}
	
	lines := strings.Split(string(output), "\n")
	if len(lines) >= 2 {
		fields := strings.Fields(lines[1])
		if len(fields) >= 4 {
			total := fields[1]  // 전체 용량
			avail := fields[3]  // 사용 가능 용량
			return fmt.Sprintf("%s Free / %s", avail, total)
		}
	}
	
	return "N/A"
}



