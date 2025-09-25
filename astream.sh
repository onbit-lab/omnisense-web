#!/bin/bash
# astream.sh - GStreamer audio streaming script

set -e

# Default audio device (system default)
HOST="192.168.0.81"
PORT=5006

echo "Starting audio stream to $HOST:$PORT..."

# Much simpler pipeline that should work with default settings
gst-launch-1.0 -e \
  pulsesrc do-timestamp=true ! \
  audioconvert ! \
  audioresample ! \
  opusenc bitrate=64000 ! \
  rtpopuspay pt=97 ! \
  udpsink host="$HOST" port=$PORT sync=false async=false