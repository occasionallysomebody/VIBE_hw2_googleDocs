# Collaborative Design Canvas — Documentation

Enterprise-grade real-time collaborative design tool built with Y.js CRDTs, WebSocket synchronization, and conflict-free distributed data types. Inspired by Canva's technical excellence, designed for technical writers creating YouTube video documentation.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Features & Usage](#features--usage)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Future Enhancements](#future-enhancements)

---

## Quick Start

### Installation

```bash
npm install
```

### Run Server

```bash
# Production
npm start

# Or use the quick-start script (Unix/macOS)
./start.sh
```

Server runs on `http://localhost:1234` by default.

### Open Client

1. Open `http://localhost:1234` in your browser
2. Or open `http://localhost:1234?id=my-doc` for a named document/room

### Test Collaboration

Open multiple browser tabs/windows pointing to the same URL. Changes sync in real-time across all clients.

---

## Architecture

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+ modules)
- Y.js 13.x (CRDT library)
- y-websocket provider
- Custom design system (Outfit + Space Mono)

**Backend:**
- Node.js 16+
- ws (WebSocket server)
- Y.js server utilities (y-websocket)
- File-based persistence

### Key Features

- **CRDT-based synchronization** — Automatic conflict resolution
- **Real-time cursor tracking** — See where collaborators are working
- **Optimistic updates** — Zero latency for local changes
- **Document persistence** — Auto-save to disk
- **Graceful reconnection** — Handles network interruptions
- **Horizontal scalability** — Ready for Redis adapter
- **Production monitoring** — Health checks and metrics endpoints

### How CRDTs Work

Unlike traditional operational transformation (OT), Y.js uses **Conflict-free Replicated Data Types (CRDTs)** which:

1. **Never require conflict resolution** — Concurrent edits merge automatically
2. **Work offline** — Changes sync when reconnected
3. **Scale horizontally** — No central coordination needed
4. **Preserve intention** — User intent is maintained even with conflicts

### Data Flow

```
Client A                  Server                    Client B
   │                        │                          │
   ├─ Create Element ──────>│                          │
   │  (CRDT Update)         │                          │
   │                        ├─ Persist to Disk         │
   │                        │                          │
   │                        ├──── Broadcast ─────────> │
   │                        │     (CRDT Update)        │
   │                        │                          │
   │                        │ <──── Move Element ───── │
   │                        │      (CRDT Update)       │
   │                        │                          │
   │ <──── Broadcast ───────┤                          │
   │     (Auto-merged)      │                          │
```

### Project Structure

```
VIBE_hw2_googleDocs/
├── server.js                 # Y.js WebSocket server
├── collaborative-canvas.html # Client application
├── index.html                # Redirects to canvas
├── package.json              # Dependencies
├── persistence/               # Document storage (auto-created)
│   └── canvas-collab-*.yjs
├── DOCS.md                   # This file
├── Dockerfile
├── docker-compose.yml
└── start.sh
```

---

## Features & Usage

### Element Types

| Type | Usage |
|------|-------|
| **Text** | Click canvas with Text tool selected. Double-click to edit. Use position inputs in Properties to move. |
| **Image** | Click canvas with Image tool. Select element, then add URL or upload image in Properties panel. |
| **Video** | Click canvas with Video tool. Select element, add YouTube URL or direct mp4 link in Properties. |
| **Rectangle** | Click canvas with Rectangle tool. |
| **Circle** | Click canvas with Circle tool. |

### Tools

- **Select** — Click elements to select. Click empty canvas to deselect. Drag to move (except when editing text).
- **Text** — Click to add text block. Double-click to edit.
- **Image** — Click to add image placeholder. Upload or paste URL in Properties.
- **Video** — Click to add video placeholder. Paste YouTube or mp4 URL in Properties.
- **Rectangle / Circle** — Click to add shapes.

### Properties Panel

When an element is selected, the right panel shows:
- Position (X, Y)
- Type-specific options (font size for text, URL/upload for image/video)
- Delete button

### Version Control

- **Save Version** — Saves a snapshot of the current canvas. Up to 20 versions kept.
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (or Cmd on Mac).

### Keyboard Shortcuts

- `Ctrl/Cmd + Z` — Undo
- `Ctrl/Cmd + Shift + Z` — Redo
- `Ctrl/Cmd + Y` — Redo

---

## Configuration

### Environment Variables

```bash
# Server host (default: 0.0.0.0)
export HOST=localhost

# Server port (default: 1234)
export PORT=3000

# Persistence directory (default: ./persistence)
export PERSISTENCE_DIR=/var/data/canvas

# Garbage collection interval in ms (default: 60000)
export GC_INTERVAL=120000
```

### Client Configuration

The client auto-detects WebSocket URL from the page origin. For file:// or custom setups, use:

- `?wsPort=1234` — Override WebSocket port
- `?id=room-name` — Document/room name

---

## Deployment

### Docker

```bash
docker build -t collaborative-canvas .
docker run -p 1234:1234 -v $(pwd)/persistence:/app/persistence collaborative-canvas
```

### Docker Compose

```bash
docker-compose up -d
```

### Cloud Deployment (Railway, Render, Fly.io)

1. Push code to GitHub
2. Connect repository to cloud platform
3. Set environment variables: `PORT`, `PERSISTENCE_DIR`
4. Deploy

**Important:** Use `wss://` (secure WebSocket) in production.

### Nginx Reverse Proxy

```nginx
upstream canvas_backend {
    server localhost:1234;
}

server {
    listen 80;
    server_name canvas.yourdomain.com;

    location / {
        proxy_pass http://canvas_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

### Scaling to Production

**Redis Persistence** (for multiple server instances):

```bash
npm install y-redis
```

Update `server.js` to use `RedisPersistence` with `setupWSConnection`.

**Load Balancing:** Use sticky sessions (e.g. `ip_hash` in Nginx).

---

## API Reference

### WebSocket Protocol

Y.js uses a binary protocol for efficient synchronization. The y-websocket provider handles messages automatically.

### Shared Data Structure

```javascript
// Y.js Document
const ydoc = new Y.Doc();
const yElements = ydoc.getMap('elements');
const yVersions = ydoc.getArray('versions');

// Element structure
{
  id: 'element-123',
  type: 'text' | 'image' | 'video' | 'rect' | 'circle',
  x: number,
  y: number,
  width: number | 'auto',
  height: number | 'auto',
  content: string | null,
  src: string | null,
  color: string,
  fontSize: number,
  createdBy: string,
  createdAt: number
}
```

### HTTP Endpoints

- **Health:** `GET http://localhost:1234/health`
- **Metrics:** `GET http://localhost:1234/metrics`

---

## Troubleshooting

### Connection Issues

**Can't connect to WebSocket**
- Check server is running: `curl http://localhost:1234/health`
- Verify port is open
- For production, use `wss://` not `ws://`

**Connection drops frequently**
- Check network stability
- Increase timeout settings

### Performance Issues

**Slow synchronization**
- Check network latency
- Reduce update frequency (throttle drag events)

**High memory usage**
- Reduce `GC_INTERVAL` to clean up unused documents faster

### Data Issues

**Elements not syncing**
- Check browser console for Y.js errors
- Verify both clients use the same room (`?id=...`)
- Check document persistence directory permissions

---

## Future Enhancements

### Phase 2
- Comments and annotations
- @mentions with notifications
- Multi-level undo/redo
- Export to PDF/video

### Phase 3
- AI-powered layout suggestions
- Presentation mode
- Mobile-responsive UI
- Offline-first architecture

### Phase 4
- Plugin system
- Custom element types
- Advanced animations
- Enterprise SSO integration

---

## License

MIT

## Support

- Y.js documentation: https://docs.yjs.dev
- Enable verbose logging in browser console for WebSocket debugging

---

Built with Y.js CRDTs for conflict-free collaboration.
