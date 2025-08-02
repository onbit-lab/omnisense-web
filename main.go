    package main

    import (
        "context"
        "encoding/base64"
        "encoding/json"
        "errors"
        "fmt"
        "io"
        "log"
        "net"
        "net/http"
        "os"
        "os/exec"
        "strconv"
        "strings"

        "github.com/pion/webrtc/v4"
    )

    func main() {
        // Serve static assets
        http.Handle("/", http.FileServer(http.Dir("./static")))

        // Context for GStreamer process cancellation
        gstCtx, cancelGst := context.WithCancel(context.Background())
        defer cancelGst()

        var streamInProgress bool

        http.HandleFunc("/post", func(w http.ResponseWriter, r *http.Request) {
            if r.Method != http.MethodPost {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
            }
            if streamInProgress {
                http.Error(w, "Stream already in progress", http.StatusServiceUnavailable)
                return
            }

            body, err := io.ReadAll(r.Body)
            if err != nil {
                http.Error(w, "Cannot read body", http.StatusInternalServerError)
                return
            }
            defer r.Body.Close()

            // Decode SDP from browser
            offer := webrtc.SessionDescription{}
            decode(string(body), &offer)
            fmt.Println("Received offer from browser")

            peer, videoTrack, sender := initWebRTCSession(&offer)
            go readIncomingRTCPPackets(sender)

            // UDP listener for incoming RTP
            listener := initUDPListener()
            go sendRtpToClient(videoTrack, listener)

            // Decide whether to launch local GStreamer pipeline
            var gstCmd *exec.Cmd
            if os.Getenv("GST_MODE") != "external" {
                gstCmd = runGstreamerPipeline(gstCtx)
            }

            // Handle connection state & cleanup
            handleICEConnectionState(peer, gstCmd, listener, &streamInProgress)
            streamInProgress = true

            // Send answer back to browser
            fmt.Fprint(w, encode(peer.LocalDescription()))
        })

        // Listen address configurable via env
        addr := os.Getenv("HTTP_ADDR")
        if addr == "" {
            addr = ":8080"
        }
        fmt.Println("HTTP server listening on", addr)
        log.Fatal(http.ListenAndServe(addr, nil))
    }

    // === WebRTC helpers ===

    func initWebRTCSession(offer *webrtc.SessionDescription) (*webrtc.PeerConnection, *webrtc.TrackLocalStaticRTP, *webrtc.RTPSender) {
        pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
            ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
        })
        if err != nil {
            panic(err)
        }

        videoTrack, err := webrtc.NewTrackLocalStaticRTP(
            webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
            "video", "pion",
        )
        if err != nil {
            panic(err)
        }
        sender, err := pc.AddTrack(videoTrack)
        if err != nil {
            panic(err)
        }

        if err = pc.SetRemoteDescription(*offer); err != nil {
            panic(err)
        }

        answer, err := pc.CreateAnswer(nil)
        if err != nil {
            panic(err)
        }

        gatherComplete := webrtc.GatheringCompletePromise(pc)
        if err = pc.SetLocalDescription(answer); err != nil {
            panic(err)
        }
        <-gatherComplete
        fmt.Println("WebRTC session established")
        return pc, videoTrack, sender
    }

    func handleICEConnectionState(pc *webrtc.PeerConnection, gst *exec.Cmd, listener *net.UDPConn, inProgress *bool) {
        pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
            fmt.Println("ICE state ->", state.String())
            if state == webrtc.ICEConnectionStateDisconnected ||
                state == webrtc.ICEConnectionStateFailed ||
                state == webrtc.ICEConnectionStateClosed {

                if gst != nil && gst.Process != nil {
                    _ = gst.Process.Kill()
                    fmt.Println("Local GStreamer stopped")
                }
                if listener != nil {
                    _ = listener.Close()
                }
                _ = pc.Close()
                *inProgress = false
            }
        })
    }

    func readIncomingRTCPPackets(sender *webrtc.RTPSender) {
        buf := make([]byte, 1500)
        for {
            if _, _, err := sender.Read(buf); err != nil {
                return // connection closed
            }
        }
    }

    // === UDP / RTP bridge ===

    func initUDPListener() *net.UDPConn {
        host := os.Getenv("UDP_HOST")
        if host == "" {
            host = "0.0.0.0"
        }
        port := 5004
        if p := os.Getenv("UDP_PORT"); p != "" {
            if v, err := strconv.Atoi(p); err == nil {
                port = v
            }
        }
        addr := &net.UDPAddr{IP: net.ParseIP(host), Port: port}
        l, err := net.ListenUDP("udp", addr)
        if err != nil {
            panic(err)
        }
        _ = l.SetReadBuffer(3 * 1000 * 100) // 300 KB
        fmt.Printf("UDP listening on %s:%d
", host, port)
        return l
    }

    func sendRtpToClient(track *webrtc.TrackLocalStaticRTP, l *net.UDPConn) {
        defer l.Close()
        pkt := make([]byte, 1600)
        for {
            n, _, err := l.ReadFrom(pkt)
            if err != nil {
                return
            }
            if _, err = track.Write(pkt[:n]); err != nil && !errors.Is(err, io.ErrClosedPipe) {
                panic(err)
            }
        }
    }

    // === Local GStreamer pipeline (optional) ===

    func runGstreamerPipeline(ctx context.Context) *exec.Cmd {
        args := []string{
            "v4l2src", "device=/dev/video0", "io-mode=4",
            "!", "video/x-raw,width=1280,height=960",
            "!", "queue",
            "!", "mpph264enc", "profile=baseline", "header-mode=each-idr",
            "!", "rtph264pay",
            "!", "udpsink", "host=127.0.0.1", "port=5004",
        }
        cmd := exec.CommandContext(ctx, "gst-launch-1.0", args...)
        if err := cmd.Start(); err != nil {
            log.Fatal("GStreamer start:", err)
        }
        fmt.Println("Local GStreamer started")
        return cmd
    }

    // === SDP encode/decode helpers ===

    func encode(sd *webrtc.SessionDescription) string {
        b, _ := json.Marshal(sd)
        return base64.StdEncoding.EncodeToString(b)
    }
    func decode(in string, sd *webrtc.SessionDescription) {
        b, _ := base64.StdEncoding.DecodeString(in)
        _ = json.Unmarshal(b, sd)
    }
