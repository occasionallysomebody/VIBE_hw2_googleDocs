# System Architecture Documentation

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser 1  │  │   Browser 2  │  │   Browser N  │      │
│  │              │  │              │  │              │      │
│  │  Canvas      │  │  Canvas      │  │  Canvas      │      │
│  │  Renderer    │  │  Renderer    │  │  Renderer    │      │
│  │              │  │              │  │              │      │
│  │  State Mgr   │  │  State Mgr   │  │  State Mgr   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         │   WebSocket      │   WebSocket      │   WebSocket  │
│         │   (Persistent)   │   (Persistent)   │   (Persistent)│
└─────────┼──────────────────┼──────────────────┼───────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         WebSocket Server (Port 8080)                  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Connection Manager                          │   │  │
│  │  │  - Client registry                           │   │  │
│  │  │  - Presence tracking                         │   │  │
│  │  │  - Heartbeat monitoring                      │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Operation Processor                         │   │  │
│  │  │  - CRDT reconciliation                       │   │  │
│  │  │  - Permission validation                     │   │  │
│  │  │  - Operation batching (50ms)                 │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Document Store                              │   │  │
│  │  │  - In-memory Maps (dev)                      │   │  │
│  │  │  - Redis/PostgreSQL (prod)                   │   │  │
│  │  │  - Version snapshots                         │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Redis     │  │ PostgreSQL  │  │     S3      │         │
│  │             │  │             │  │             │         │
│  │ Operations  │  │ Documents   │  │   Media     │         │
│  │ Pub/Sub     │  │ Metadata    │  │   Assets    │         │
│  │ Sessions    │  │ Users       │  │ Templates   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Real-Time Operation Flow

```
User A                     Server                      User B
  │                          │                           │
  │  1. Drag element         │                           │
  ├──────────────────────────>                           │
  │  OPERATION: move_element │                           │
  │                          │                           │
  │  2. Optimistic update    │                           │
  │  (instant UI feedback)   │                           │
  │                          │                           │
  │                          │  3. Validate & apply      │
  │                          │  (permission check)       │
  │                          │                           │
  │                          │  4. Queue for batch       │
  │  <────────────────────── │  (50ms window)           │
  │  ACK: operation received │                           │
  │                          │                           │
  │                          │  5. Flush batch           │
  │                          ├──────────────────────────>│
  │                          │  BATCH_OPERATIONS         │
  │                          │                           │
  │                          │                           │  6. Apply & render
  │                          │                           │  (update canvas)
  │                          │                           │
```

### Document Join Flow

```
Client                     Server
  │                          │
  │  1. WebSocket connect    │
  ├──────────────────────────>
  │  CONNECT: user info      │
  │                          │
  │  <────────────────────── │
  │  ACK: connection OK      │
  │                          │
  │  2. Join document        │
  ├──────────────────────────>
  │  JOIN: doc-id-123        │
  │                          │
  │                          │  3. Load document
  │                          │  (from store)
  │                          │
  │                          │  4. Check permissions
  │                          │  (grant if new user)
  │                          │
  │  <────────────────────── │
  │  DOCUMENT_STATE:         │
  │  - All elements          │
  │  - Active users          │
  │  - Permissions           │
  │                          │
  │  5. Render canvas        │
  │  (initial state)         │
  │                          │
  │  <────────────────────── │
  │  BATCH_OPERATIONS:       │
  │  (ongoing updates)       │
  │                          │
```

## Component Architecture

### Client Components

```typescript
┌─────────────────────────────────────┐
│         HTML/CSS/JavaScript          │
├─────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐ │
│  │  UI Layer                      │ │
│  │  - Sidebar (templates)         │ │
│  │  - Toolbar (actions)           │ │
│  │  - Canvas (elements)           │ │
│  │  - Properties panel            │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  State Management              │ │
│  │  - EditorState                 │ │
│  │  - Elements Map                │ │
│  │  - Selection tracking          │ │
│  │  - User presence               │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Collaboration Client          │ │
│  │  - WebSocket manager           │ │
│  │  - Message handlers            │ │
│  │  - Auto-reconnect logic        │ │
│  │  - Operation sender            │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Rendering Engine              │ │
│  │  - Canvas renderer             │ │
│  │  - Element factories           │ │
│  │  - Cursor renderer             │ │
│  │  - Performance optimizer       │ │
│  └────────────────────────────────┘ │
│                                      │
└─────────────────────────────────────┘
```

### Server Components

```typescript
┌─────────────────────────────────────┐
│         Node.js + TypeScript         │
├─────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐ │
│  │  CollaborationServer           │ │
│  │  - WebSocketServer setup       │ │
│  │  - Connection lifecycle        │ │
│  │  - Message routing             │ │
│  │  - Cleanup on disconnect       │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  DocumentStore                 │ │
│  │  - getDocument()               │ │
│  │  - saveDocument()              │ │
│  │  - createDocument()            │ │
│  │  - addOperation()              │ │
│  │  - getOperations()             │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Operation Processor           │ │
│  │  - applyOperation()            │ │
│  │  - validatePermissions()       │ │
│  │  - batchOperations()           │ │
│  │  - conflictResolution()        │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Session Manager               │ │
│  │  - Client connections          │ │
│  │  - Document sessions           │ │
│  │  - Presence tracking           │ │
│  │  - Broadcast routing           │ │
│  └────────────────────────────────┘ │
│                                      │
└─────────────────────────────────────┘
```

## Data Models

### Document Structure

```typescript
Document {
  id: string
  title: string
  
  state: {
    elements: Map<elementId, Element>
    width: number
    height: number
    backgroundColor: string
  }
  
  permissions: Map<userId, PermissionLevel>
  versions: Version[]
  
  createdAt: timestamp
  modifiedAt: timestamp
}
```

### Element Structure

```typescript
Element {
  id: string
  type: 'text' | 'image' | 'video' | 'moodboard' | 'template'
  
  transform: {
    position: { x, y }
    size: { width, height }
    rotation: degrees
    zIndex: number
  }
  
  locked: boolean
  visible: boolean
  
  createdAt: timestamp
  createdBy: userId
  modifiedAt: timestamp
  modifiedBy: userId
  
  // Type-specific properties
  ...
}
```

### Operation Structure

```typescript
Operation {
  id: string (unique)
  type: OperationType
  documentId: string
  userId: string
  timestamp: number
  version: number
  
  // Type-specific payload
  elementId?: string
  element?: Element
  changes?: Partial<Element>
  position?: Position
  size?: Size
  content?: string
  ...
}
```

## Performance Characteristics

### Latency Targets

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| Element creation | <50ms | 10-20ms | Optimistic update |
| Operation sync | <100ms | 50-80ms | Batched |
| Cursor update | <50ms | 20-30ms | Throttled 20Hz |
| Canvas render | <16ms | 8-12ms | 60 FPS |
| Version save | <200ms | 100-150ms | Snapshot creation |

### Scalability Metrics

| Metric | Dev (1 server) | Production (scaled) |
|--------|---------------|---------------------|
| Concurrent users | 100-500 | 10,000+ |
| Active documents | 10-50 | 1,000+ |
| Operations/sec | 1,000 | 100,000+ |
| Memory usage | 1-2 GB | Distributed |
| Network bandwidth | 10 Mbps | 1+ Gbps |

### Optimization Techniques

1. **Operation Batching**
   - Collect operations over 50ms window
   - Send single batch instead of N messages
   - Reduces network overhead by 10-50x

2. **Optimistic Updates**
   - Apply changes immediately in UI
   - Rollback on server rejection (rare)
   - Perceived latency: near-zero

3. **Cursor Throttling**
   - Limit updates to 20 Hz (50ms)
   - Interpolate between updates
   - Smooth visual experience

4. **Canvas Rendering**
   - Only re-render changed elements
   - Use CSS transforms (GPU accelerated)
   - Avoid DOM reflows

5. **Asset Pre-loading**
   - Templates loaded on connect
   - Fonts cached
   - Instant drag-drop experience

## Security Considerations

### Authentication
- Token-based auth (not implemented in demo)
- OAuth 2.0 integration for production
- Session management

### Authorization
- Permission-based access control
- Owner/Editor/Viewer/Commenter roles
- Operation validation before apply

### Data Protection
- HTTPS/WSS in production
- Input sanitization
- XSS prevention
- CSRF tokens

### Rate Limiting
- Operations per user per second
- Connection limits per IP
- Backpressure on overload

## Deployment Architecture

### Development
```
Single Machine
├── Server (Node.js)
│   └── Port 8080
└── Client (Static)
    └── Port 3000
```

### Production
```
Load Balancer
├── WebSocket Servers (3+)
│   ├── Sticky sessions
│   └── Health checks
├── Redis Cluster
│   ├── Pub/Sub
│   └── Session store
├── PostgreSQL (Primary + Replicas)
│   └── Document storage
├── S3 / CDN
│   └── Media assets
└── Monitoring
    ├── Prometheus
    ├── Grafana
    └── Alert manager
```

## Canva-Inspired Design Patterns

### 1. Service-Aligned Architecture
- Each document is a logical service boundary
- Data ownership clear (document owns elements)
- Independent scaling per document

### 2. Real-Time First
- WebSocket persistent connections
- Not request/response
- Push updates immediately

### 3. Template-Driven UX
- Pre-designed templates
- Drag-drop simplicity
- Consistent layouts

### 4. Infrastructure as Code
- TypeScript for type safety
- Shared data model
- Version controlled config

### 5. Performance Obsession
- Operation batching
- Optimistic updates
- Pre-loaded assets
- GPU-accelerated rendering

## Future Enhancements

### Phase 2
- Comments and annotations
- @mentions with notifications
- Comprehensive keyboard shortcuts
- Multi-level undo/redo
- Export to PDF/video

### Phase 3
- AI-powered layout suggestions
- Voice comments
- Presentation mode
- Mobile native apps
- Offline-first architecture

### Phase 4
- Plugin system
- Custom element types
- Advanced animations
- Collaborative AI assistant
- Enterprise SSO integration

## Monitoring & Observability

### Key Metrics
```javascript
// Server-side
metrics.increment('operations.received')
metrics.timing('operation.process_time', duration)
metrics.gauge('websocket.connections', count)
metrics.gauge('documents.active', count)

// Client-side
metrics.timing('render.canvas', duration)
metrics.timing('operation.round_trip', latency)
metrics.increment('errors.websocket_disconnect')
```

### Logging
```javascript
// Structured logging
logger.info('operation_applied', {
  documentId,
  operationType,
  userId,
  duration,
  elementsCount
})
```

### Alerts
- WebSocket connection failures
- High operation latency (>500ms)
- Memory usage >80%
- Error rate >1%

---

**End of Architecture Documentation**

This architecture delivers Canva-level performance and reliability while remaining simple enough to understand and extend.
