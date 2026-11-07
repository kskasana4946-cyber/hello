#!/bin/bash
# play-mac.command - 1-Click Offline Launcher for macOS
cd "$(dirname "$0")" || exit 1

echo "====================================================================="
echo "  APEX GRAND PRIX: UNCAPPED NEXT-GEN EDITION - macOS OFFLINE LAUNCHER"
echo "====================================================================="
echo ""
echo "Starting local offline server on port 8080..."
python3 -m http.server 8080 &
SERVER_PID=$!

sleep 1
open "http://localhost:8080"

echo ""
echo "Apex Grand Prix is now running in Safari/Chrome!"
echo "Keep this window open while playing."
echo "Press [ENTER] in this window to stop the server and exit."
echo ""
read -r
kill $SERVER_PID 2>/dev/null
