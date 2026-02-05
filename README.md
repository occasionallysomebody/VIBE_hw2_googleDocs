# Collaborative Text Editor

A real-time collaborative text editor built using the **Persona Pattern** for AI-assisted development.

## 🎯 Project Overview

This project fulfills the CS 29000-004 "Vibe Coding" assignment requirements:
- ✅ Real-time client-server application
- ✅ Supports 2+ simultaneous clients
- ✅ Server maintains authoritative state
- ✅ Client has GUI (web-based)
- ✅ Built entirely using AI with Persona Pattern
- ✅ Separate client and server files

## 🏗️ Architecture

**Technology Stack:**
- **Server**: Node.js + Socket.io (WebSocket)
- **Client**: HTML/CSS/JavaScript (vanilla)
- **Protocol**: WebSocket for real-time communication
- **Design**: Vercel/Framer inspired dark theme with glassmorphism

**Key Features:**
- Multiple document support
- Real-time text synchronization
- Active user tracking
- Document creation
- Premium dark-mode UI with minimal design language

## 📋 Persona Pattern Documentation

This project was built using the following personas:

### Phase 1: Architecture Design
**Persona**: "I am an experienced software architect specializing in real-time collaborative applications with expertise in WebSocket protocols and conflict resolution."

**Task**: Design the overall system architecture, data models, and communication protocol.

### Phase 2: Backend Development
**Persona**: "I am an expert Node.js backend developer with deep knowledge of Socket.io, WebSocket servers, and real-time data synchronization. I write clean, well-commented code."

**Task**: Implement the WebSocket server with document management, user tracking, and event handling.

### Phase 3: Frontend Development
**Persona**: "I am a skilled frontend developer specializing in real-time user interfaces and WebSocket connections. I create clean, intuitive GUIs with great user experience."

**Task**: Build the client GUI with text editor, document list, and real-time updates.

### Phase 4: Testing & Optimization
**Persona**: "I am a QA engineer and code reviewer focused on concurrent systems. I identify edge cases, race conditions, and user experience issues."

**Task**: Review code, test functionality, and add improvements.

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Step 1: Install Dependencies
```bash
cd /path/to/collaborative-editor
npm install
```

This will install:
- `express` - Web server framework
- `socket.io` - WebSocket library for real-time communication

### Step 2: Start the Server
```bash
npm start
# or
node server.js
```

You should see:
```
============================================================
  COLLABORATIVE TEXT EDITOR SERVER
============================================================
  Server running on http://localhost:3000
  Open http://localhost:3000/client.html in multiple tabs
============================================================
```

### Step 3: Open Clients
Open **2 or more** browser tabs/windows and navigate to:
```
http://localhost:3000/client.html
```

## 🧪 Testing Instructions

### Basic Functionality Test
1. Start the server
2. Open `client.html` in **Browser Tab 1**
3. Open `client.html` in **Browser Tab 2** (or separate window)
4. Click on "Welcome Document" in both tabs
5. Type in Tab 1 - text should appear in Tab 2 in real-time
6. Type in Tab 2 - text should appear in Tab 1 in real-time
7. Verify "active users" count shows 2

### Document Creation Test
1. In Tab 1, enter a document name (e.g., "Test Doc")
2. Click "Create"
3. New document should appear in document list in BOTH tabs
4. Click on the new document in both tabs
5. Test real-time editing

### Multi-User Test
1. Open 3+ browser tabs
2. All join the same document
3. Each tab types different text
4. Verify all changes propagate to all clients
5. Close one tab - verify "active users" count decreases

### Disconnect/Reconnect Test
1. Open 2 tabs editing the same document
2. Stop the server (Ctrl+C)
3. Notice "Disconnected" status in clients
4. Restart server
5. Notice "Connected" status returns
6. Refresh both tabs and verify document persists (in-memory, so it resets on restart)

## 🎓 Assignment Requirements Checklist

### Required Goals
- ✅ **2+ simultaneous clients**: Tested with multiple browser tabs
- ✅ **Server holds state**: Documents stored on server, clients receive updates
- ✅ **No direct client-to-client**: All communication goes through server
- ✅ **GUI on client**: Modern web interface with text editor
- ✅ **Persona Pattern used**: Documented in this README

### Stretch Goals
- ⚠️ **Data synchronization**: Basic last-write-wins implemented
  - To implement proper locking (stretch goal), see improvement suggestions below

## 🎬 Video Presentation Guide

For your 5-minute video, cover:

1. **Introduction** (30 sec)
   - Team members
   - Chose collaborative text editor option
   - Used Persona Pattern with AI

2. **Architecture Overview** (1 min)
   - Show `ARCHITECTURE.md`
   - Explain client-server design
   - WebSocket for real-time communication

3. **Code Walkthrough** (1.5 min)
   - Show `server.js` - document storage, event handlers
   - Show `client.html` - GUI, WebSocket client
   - Highlight key functions

4. **Live Demo** (1.5 min)
   - Start server
   - Open 2-3 tabs
   - Create document
   - Type in different tabs simultaneously
   - Show real-time synchronization
   - Show active user count

5. **Persona Pattern Documentation** (30 sec)
   - Show the different personas used
   - Explain how each contributed

6. **Challenges & Learnings** (30 sec)
   - What worked well with AI
   - Any iterations needed

## 🔧 Stretch Goal: Adding Synchronization

To implement proper data synchronization (stretch goal), you could prompt with this persona:

**Persona**: "You are a distributed systems expert specializing in conflict resolution, operational transformation, and concurrent data structures. You have deep experience with collaborative editing systems like Google Docs."

**Prompt**: "Add document-level locking to prevent race conditions. When a user starts typing, acquire a lock for 2 seconds. Other users should see a 'User X is typing...' indicator and their edits should be queued."

Or for more advanced:

**Prompt**: "Implement operational transformation (OT) to handle concurrent edits. Each edit should include position and content. Transform operations based on concurrent changes to maintain consistency."

## 📁 File Structure
```
collaborative-editor/
├── server.js           # WebSocket server (195 lines)
├── client.html         # Client GUI (373 lines)
├── package.json        # Dependencies
├── ARCHITECTURE.md     # Design documentation
└── README.md          # This file
```

## 🐛 Troubleshooting

**Problem**: Can't connect to server
- Solution: Ensure server is running, check firewall settings

**Problem**: Changes not syncing
- Solution: Check browser console for errors, verify both clients joined same document

**Problem**: Port 3000 already in use
- Solution: Change PORT in server.js or stop other application using port 3000

**Problem**: npm install fails
- Solution: Check internet connection, try `npm install --legacy-peer-deps`

## 📝 Individual Contributions

[Add your contributions here for the video/submission]

- **Member 1**: Architecture design, server implementation
- **Member 2**: Client implementation, testing, documentation

## 🎉 Success Criteria Met

This project demonstrates:
- ✅ Full understanding of client-server architecture
- ✅ Proper use of WebSockets for real-time communication
- ✅ Clean separation of concerns
- ✅ Professional code quality from AI generation
- ✅ Effective use of Persona Pattern throughout development

---

**Honor Pledge**: All code in this project was generated using AI. No lines of code (except the team member comment) were written manually.
