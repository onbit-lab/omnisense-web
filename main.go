package main

import (
	"log"
	"net/http"
	"strconv"
)

var hub *Hub

func main() {
	// WebSocket Hub 초기화
	hub = newHub()
	go hub.run()

	// 정적 파일
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	// WebSocket 엔드포인트
	http.HandleFunc("/ws", handleWebSocket)

	// HTTP 엔드포인트
	http.HandleFunc("/post", handlePost)
	http.HandleFunc("/reset", handleReset)
	http.HandleFunc("/subtitle", handleSubtitle)
	http.HandleFunc("/status", handleStatus)

	port := getenvInt("HTTP_PORT", 8080)
	addr := ":" + strconv.Itoa(port)

	log.Printf("🚀 OMNISENSE Server starting...")
	log.Printf("📍 Server: http://localhost:%d", port)

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("HTTP Server error: ", err)
	}
}
