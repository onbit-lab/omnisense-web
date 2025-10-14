package main

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"strconv"
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
