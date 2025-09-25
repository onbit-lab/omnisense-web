#!/bin/bash
# start_streaming.sh - Start both video and audio streaming

set -e

echo "Starting video and audio streaming..."

# Get the device's IP address to use for streaming
HOST="192.168.0.81"  # Change this to match your vstream.sh setting
VIDEO_PORT=5004
AUDIO_PORT=5006

# Start video stream in background
echo "Starting video stream..."
bash ./vstream.sh &
VIDEO_PID=$!

# Wait a moment before starting audio
sleep 2

# Start audio stream in background
echo "Starting audio stream..."
bash ./astream.sh &
AUDIO_PID=$!

echo "Both streams started. Video PID: $VIDEO_PID, Audio PID: $AUDIO_PID"
echo "Press Ctrl+C to stop both streams"

# Function to handle termination and kill both processes
function cleanup {
  echo "Stopping streams..."
  kill $VIDEO_PID $AUDIO_PID 2>/dev/null || true
  echo "Streams stopped."
  exit 0
}

# Set up trap to call cleanup function on Ctrl+C
trap cleanup INT TERM

# Wait for background processes
wait