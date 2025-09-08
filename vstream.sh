#!/bin/bash
# vstream.sh - GStreamer video streaming script

set -e

DEVICE="/dev/video11"
WIDTH=1280
HEIGHT=720
FRAMERATE=30
BPS=3500000
HOST="192.168.0.81"
PORT=5004

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