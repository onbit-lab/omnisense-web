#!/bin/bash
# vstream.sh - GStreamer video streaming script

set -e

DEVICE="/dev/video11"
WIDTH=1280
HEIGHT=720
FRAMERATE=30
BPS=3500000
# Use server's actual IP address or hostname for external access
# Priority: 1. HOST env var (if explicitly set) 2. SERVER_IP env var 3. PUBLIC_IP env var 4. Detected IP
HOST="${HOST:-${SERVER_IP:-${PUBLIC_IP:-$(hostname -I | awk '{print $1}')}}}"
PORT="${PORT:-5004}"

# Log the IP being used
echo "Using IP address for video streaming: $HOST:$PORT"
echo "Make sure this IP is accessible from client devices"

echo "Starting video stream from $DEVICE to $HOST:$PORT..."

gst-launch-1.0 -e \
  v4l2src device="$DEVICE" io-mode=mmap do-timestamp=true ! \
  video/x-raw,width=$WIDTH,height=$HEIGHT,framerate=${FRAMERATE}/1 ! \
  videoconvert ! video/x-raw,format=I420 ! \
  queue max-size-buffers=12 leaky=upstream ! \
  mpph264enc bps=$BPS rc-mode=cbr gop=30 profile=baseline ! \
  h264parse ! \
  rtph264pay pt=96 mtu=1200 config-interval=1 ! \
  udpsink host="$HOST" port=$PORT sync=false async=false