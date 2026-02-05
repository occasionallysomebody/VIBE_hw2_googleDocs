#!/bin/bash

# Collaborative Editor - Quick Start Script
# Sets up and runs the server (which serves the client UI)

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

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo ""
echo -e "${GREEN}✓${NC} Server ready"

# Start server in background
echo ""
echo -e "${BLUE}Starting collaboration server...${NC}"
npm start &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
sleep 2

echo ""
echo "=================================="
echo "✅ System is running!"
echo ""
echo "📡 WebSocket Server: ws://localhost:1234"
echo "🌐 Client Interface: http://localhost:1234"
echo ""
echo "To test collaboration:"
echo "  1. Open http://localhost:1234?id=test-doc"
echo "  2. Open another browser window with the same URL"
echo "  3. Make changes and watch them sync in real-time!"
echo ""
echo "Press Ctrl+C to stop the service"
echo "=================================="

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVER_PID 2>/dev/null || true
    echo "✓ Service stopped"
    exit 0
}

trap cleanup INT TERM

# Wait indefinitely
wait
