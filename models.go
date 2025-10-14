package main

import (
	"github.com/gorilla/websocket"
)

// ---------- Subtitle structures ----------

type SubtitleData struct {
	Text      string `json:"text"`
	Emotion   string `json:"emotion"`
	Language  string `json:"language"`
	Timestamp string `json:"timestamp"`
	Speaker   int    `json:"speaker"`
	IsFinal   bool   `json:"is_final"`
	Emoji     string `json:"emoji"`
	LangCode  string `json:"lang_code"`
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
