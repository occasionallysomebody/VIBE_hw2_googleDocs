#!/bin/bash

# Collaborative Editor - Quick Start Script
# Sets up and runs both server and client

set -e

echo "🚀 Collaborative Rich-Media Editor"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node --version) found"

# Setup server
echo ""
echo -e "${BLUE}Setting up server...${NC}"
cd server

if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo ""
echo -e "${GREEN}✓${NC} Server ready"

# Start server in background
echo ""
echo -e "${BLUE}Starting collaboration server...${NC}"
npm run dev &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
sleep 2

# Setup client
cd ../client
echo ""
echo -e "${BLUE}Starting client server...${NC}"

# Check for Python
if command -v python3 &> /dev/null; then
    echo "Using Python HTTP server on port 3000"
    python3 -m http.server 3000 &
    CLIENT_PID=$!
elif command -v python &> /dev/null; then
    echo "Using Python HTTP server on port 3000"
    python -m http.server 3000 &
    CLIENT_PID=$!
elif command -v npx &> /dev/null; then
    echo "Using Node.js HTTP server on port 3000"
    npx http-server -p 3000 &
    CLIENT_PID=$!
else
    echo "⚠️  No HTTP server found. Please open client/index.html manually."
    CLIENT_PID=0
fi

echo ""
echo -e "${GREEN}✓${NC} Client ready"

echo ""
echo "=================================="
echo "✅ System is running!"
echo ""
echo "📡 WebSocket Server: ws://localhost:8080"
echo "🌐 Client Interface: http://localhost:3000"
echo ""
echo "To test collaboration:"
echo "  1. Open http://localhost:3000?id=test-doc"
echo "  2. Open another browser window with the same URL"
echo "  3. Make changes and watch them sync in real-time!"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=================================="

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVER_PID 2>/dev/null || true
    if [ $CLIENT_PID -ne 0 ]; then
        kill $CLIENT_PID 2>/dev/null || true
    fi
    echo "✓ Services stopped"
    exit 0
}

trap cleanup INT TERM

# Wait indefinitely
wait
