# Production Collaborative Canvas

Enterprise-grade real-time collaborative design tool built with Y.js CRDTs, WebSocket synchronization, and conflict-free distributed data types.

## Architecture Overview

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+ modules)
- Y.js 13.x (CRDT library)
- y-websocket provider
- Custom design system (Outfit + Space Mono)

**Backend:**
- Node.js 16+
- ws (WebSocket server)
- Y.js server utilities
- File-based persistence

**Key Features:**
- ✅ **CRDT-based synchronization** - Automatic conflict resolution
- ✅ **Real-time cursor tracking** - See where collaborators are working
- ✅ **Optimistic updates** - Zero latency for local changes
- ✅ **Document persistence** - Auto-save to disk
- ✅ **Graceful reconnection** - Handles network interruptions
- ✅ **Horizontal scalability** - Ready for Redis adapter
- ✅ **Production monitoring** - Health checks and metrics endpoints

## How It Works

### CRDT Synchronization

Unlike traditional operational transformation (OT), Y.js uses **Conflict-free Replicated Data Types (CRDTs)** which:

1. **Never require conflict resolution** - Concurrent edits merge automatically
2. **Work offline** - Changes sync when reconnected
3. **Scale horizontally** - No central coordination needed
4. **Preserve intention** - User intent is maintained even with conflicts

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

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Run Server

```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

Server runs on `http://localhost:1234` by default.

### 3. Open Client

**Option A:** Browser directly
```bash
open http://localhost:1234
```

**Option B:** Open HTML file
```bash
# Update line 218 in collaborative-canvas.html to use your server:
const wsUrl = 'ws://localhost:1234';

# Then open the file in your browser
```

### 4. Test Multi-Client

Open multiple browser tabs/windows pointing to the same URL. Changes sync in real-time across all clients.

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

Edit `collaborative-canvas.html` line 218-220:

```javascript
// Development - use demo server
const wsUrl = 'wss://demos.yjs.dev';
const roomName = 'canvas-collab-' + (window.location.hash.slice(1) || 'default');

// Production - use your server
const wsUrl = 'ws://your-domain.com:1234';
const roomName = 'canvas-collab-' + (window.location.hash.slice(1) || 'default');
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Create persistence directory
RUN mkdir -p /app/persistence

EXPOSE 1234

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t collaborative-canvas .
docker run -p 1234:1234 -v $(pwd)/persistence:/app/persistence collaborative-canvas
```

### Docker Compose

```yaml
version: '3.8'

services:
  canvas-server:
    build: .
    ports:
      - "1234:1234"
    volumes:
      - ./persistence:/app/persistence
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=1234
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:1234/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### Cloud Deployment (Railway, Render, Fly.io)

1. Push code to GitHub
2. Connect repository to cloud platform
3. Set environment variables:
   - `PORT`: Usually auto-set by platform
   - `PERSISTENCE_DIR`: `/data` or persistent volume path
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

## Scaling to Production

### Redis Persistence (Horizontal Scaling)

For multiple server instances, use Redis as shared storage:

```bash
npm install y-redis
```

Update `server.js`:

```javascript
const { RedisPersistence } = require('y-redis');

const persistence = new RedisPersistence({
  host: 'redis://localhost:6379'
});

setupWSConnection(conn, req, {
  gc: true,
  persistence
});
```

### Load Balancing

Use sticky sessions with your load balancer to ensure clients stay connected to the same server:

```nginx
upstream canvas_cluster {
    ip_hash;  # Sticky sessions
    server canvas1.internal:1234;
    server canvas2.internal:1234;
    server canvas3.internal:1234;
}
```

### Monitoring

**Health Check:**
```bash
curl http://localhost:1234/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600.5,
  "documents": 12,
  "memory": { "rss": 45678912, "heapUsed": 23456789 }
}
```

**Metrics:**
```bash
curl http://localhost:1234/metrics
```

Response:
```json
{
  "documents": 12,
  "connections": 47,
  "memory": { ... },
  "uptime": 3600.5
}
```

### Performance Tuning

**Memory:**
```bash
# Increase Node.js heap size
node --max-old-space-size=4096 server.js
```

**Connections:**
```bash
# Increase file descriptor limit (Linux)
ulimit -n 65536
```

**GC Tuning:**
```bash
# Adjust garbage collection interval
export GC_INTERVAL=30000  # 30 seconds for high-traffic
export GC_INTERVAL=300000  # 5 minutes for low-traffic
```

## API Reference

### WebSocket Protocol

Y.js uses a binary protocol for efficient synchronization. You don't need to manually handle messages - the Y.js provider does this automatically.

### Shared Data Structure

```javascript
// Y.js Document
const ydoc = new Y.Doc();

// Shared types
const yElements = ydoc.getMap('elements');  // Canvas elements
const yAwareness = ydoc.getMap('awareness'); // User presence

// Element structure
{
  id: 'element-123',
  type: 'text' | 'image' | 'video' | 'rect' | 'circle',
  x: number,
  y: number,
  width: number | 'auto',
  height: number | 'auto',
  content: string | null,
  color: string,
  fontSize: number,
  createdBy: string,
  createdAt: number
}
```

### Awareness (Presence)

```javascript
awareness.setLocalStateField('user', {
  id: string,
  color: string,
  name: string
});

awareness.setLocalStateField('cursor', {
  x: number,
  y: number
});
```

## Security Considerations

### Authentication

Add authentication middleware:

```javascript
wss.on('connection', (conn, req) => {
  const token = req.headers['authorization'];
  
  if (!isValidToken(token)) {
    conn.close(4001, 'Unauthorized');
    return;
  }
  
  setupWSConnection(conn, req, { gc: true });
});
```

### Rate Limiting

```javascript
const clients = new Map();

wss.on('connection', (conn, req) => {
  const ip = req.socket.remoteAddress;
  const client = clients.get(ip) || { count: 0, lastReset: Date.now() };
  
  if (Date.now() - client.lastReset > 60000) {
    client.count = 0;
    client.lastReset = Date.now();
  }
  
  if (client.count > 100) {  // 100 connections per minute per IP
    conn.close(4029, 'Rate limit exceeded');
    return;
  }
  
  client.count++;
  clients.set(ip, client);
  
  setupWSConnection(conn, req, { gc: true });
});
```

### Data Validation

Validate element updates:

```javascript
yElements.observe(event => {
  event.changes.keys.forEach((change, key) => {
    if (change.action === 'add' || change.action === 'update') {
      const element = yElements.get(key);
      
      // Validate element structure
      if (!isValidElement(element)) {
        yElements.delete(key);  // Remove invalid element
      }
    }
  });
});
```

## Troubleshooting

### Connection Issues

**Problem:** Can't connect to WebSocket
- Check server is running: `curl http://localhost:1234/health`
- Verify port is open: `netstat -an | grep 1234`
- Check firewall settings
- For production, ensure you're using `wss://` not `ws://`

**Problem:** Connection drops frequently
- Check network stability
- Increase timeout settings
- Enable reconnection logging in browser console

### Performance Issues

**Problem:** Slow synchronization
- Check network latency
- Reduce update frequency (throttle drag events)
- Consider reducing GC interval for active documents

**Problem:** High memory usage
- Reduce GC_INTERVAL to clean up unused documents faster
- Implement document size limits
- Enable Redis persistence to offload memory

### Data Issues

**Problem:** Elements not syncing
- Check browser console for Y.js errors
- Verify both clients are in the same room
- Check document persistence directory permissions

**Problem:** Conflicts/inconsistencies
- This shouldn't happen with CRDTs, but if it does:
  - Clear persistence directory
  - Restart server
  - Reconnect all clients

## Development

### Project Structure

```
collaborative-canvas-pro/
├── server.js                    # Y.js WebSocket server
├── collaborative-canvas.html    # Client application
├── package.json                 # Dependencies
├── persistence/                 # Document storage (auto-created)
│   └── canvas-collab-*.yjs
└── README.md                    # This file
```

### Adding Features

**New element types:**
1. Add type to `createElement()` function
2. Add rendering logic in `renderElement()`
3. Update property panel in `updatePropertiesPanel()`

**Custom properties:**
1. Add to element data structure
2. Update property panel UI
3. Add event listeners for changes

### Testing

```bash
# Open multiple terminals

# Terminal 1: Start server
npm start

# Terminal 2: Open first client
open http://localhost:1234

# Terminal 3: Open second client
open http://localhost:1234
```

## License

MIT

## Support

For issues or questions:
- Check existing GitHub issues
- Review Y.js documentation: https://docs.yjs.dev
- WebSocket debugging: Enable verbose logging in browser console

---

Built with ❤️ using Y.js CRDTs for conflict-free collaboration.
