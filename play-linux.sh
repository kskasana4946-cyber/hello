#!/usr/bin/env bash
# play-linux.sh - 1-Click Offline Launcher for Linux
cd "$(dirname "$0")" || exit 1

echo "====================================================================="
echo "  APEX GRAND PRIX: UNCAPPED NEXT-GEN EDITION - LINUX OFFLINE LAUNCHER"
echo "====================================================================="
echo ""
echo "Starting local offline server on port 8080..."
python3 -m http.server 8080 &
SERVER_PID=$!

sleep 1
xdg-open "http://localhost:8080" 2>/dev/null || sensible-browser "http://localhost:8080" 2>/dev/null || x-www-browser "http://localhost:8080" 2>/dev/null || echo "Open http://localhost:8080 in your browser."

echo ""
echo "Apex Grand Prix is running at http://localhost:8080 !"
echo "Press [ENTER] to stop the server and exit."
echo ""
read -r
kill $SERVER_PID 2>/dev/null
