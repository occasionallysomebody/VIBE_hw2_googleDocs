# Collaborative Text Editor Architecture

## Technology Stack
- **Server**: Node.js with Socket.io (WebSocket library)
- **Client**: HTML/CSS/JavaScript (vanilla JS, no frameworks)
- **Protocol**: WebSocket for real-time bidirectional communication

## File Structure
```
collaborative-editor/
├── server.js           # WebSocket server
├── client.html         # Client GUI
└── package.json        # Node.js dependencies
```

## Data Models

### Document
```javascript
{
  id: string,
  name: string,
  content: string,
  lastModified: timestamp,
  activeUsers: Set<userId>
}
```

### User/Client
```javascript
{
  id: string (socket.id),
  currentDocument: string (documentId),
  connectedAt: timestamp
}
```

## Communication Protocol

### Client → Server Events
- `join-document`: Join a specific document for editing
- `text-change`: Send text changes to server
- `create-document`: Create a new document
- `list-documents`: Request list of available documents

### Server → Client Events
- `document-list`: Send available documents
- `document-content`: Send current document content
- `text-update`: Broadcast text changes to all clients
- `user-joined`: Notify when another user joins
- `user-left`: Notify when a user leaves

## Synchronization Strategy
1. Server is the single source of truth
2. Client sends every keystroke/change to server
3. Server broadcasts changes to all other clients on same document
4. Simple last-write-wins for MVP (stretch: operational transformation)

## Concurrent Edit Handling (Stretch Goal)
- Document-level locking OR
- Operational Transformation for character-level merge OR
- Simple timestamp-based conflict resolution
