#!/bin/bash
# astream.sh - GStreamer audio streaming script

set -e

# Default audio device (system default)
# Use server's actual IP address or hostname for external access
# Priority: 1. HOST env var (if explicitly set) 2. SERVER_IP env var 3. PUBLIC_IP env var 4. Detected IP
HOST="${HOST:-${SERVER_IP:-${PUBLIC_IP:-$(hostname -I | awk '{print $1}')}}}"
PORT="${PORT:-5006}"

# Log the IP being used
echo "Using IP address for audio streaming: $HOST:$PORT"
echo "Make sure this IP is accessible from client devices"

echo "Starting audio stream to $HOST:$PORT..."

# Much simpler pipeline that should work with default settings
gst-launch-1.0 -e \
  pulsesrc do-timestamp=true ! \
  audioconvert ! \
  audioresample ! \
  opusenc bitrate=64000 ! \
  rtpopuspay pt=97 ! \
  udpsink host="$HOST" port=$PORT sync=false async=false