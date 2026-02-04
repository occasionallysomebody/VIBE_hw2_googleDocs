import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { 
  Document, 
  DocumentElement, 
  Operation, 
  Message, 
  MessageType,
  User,
  PermissionLevel,
  OperationType,
  DocumentVersion,
  Template,
  AssetManifest,
  ElementType,
  DocumentState
} from '../shared/types';

// Server configuration
const PORT = 8080;
const OPERATION_BATCH_INTERVAL = 50; // ms - batch operations for efficiency

// In-memory storage (production would use Redis/PostgreSQL)
class DocumentStore {
  private documents: Map<string, Document> = new Map();
  private operations: Map<string, Operation[]> = new Map(); // documentId -> operations
  
  getDocument(id: string): Document | null {
    return this.documents.get(id) || null;
  }
  
  saveDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }
  
  createDocument(id: string, title: string, ownerId: string): Document {
    const doc: Document = {
      id,
      title,
      state: {
        elements: new Map(),
        width: 1920,
        height: 1080,
        backgroundColor: '#ffffff'
      },
      permissions: new Map([[ownerId, PermissionLevel.OWNER]]),
      versions: [],
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };
    this.documents.set(id, doc);
    return doc;
  }
  
  addOperation(documentId: string, operation: Operation): void {
    if (!this.operations.has(documentId)) {
      this.operations.set(documentId, []);
    }
    this.operations.get(documentId)!.push(operation);
  }
  
  getOperations(documentId: string, since: number = 0): Operation[] {
    const ops = this.operations.get(documentId) || [];
    return ops.filter(op => op.timestamp > since);
  }
}

// Connection management
interface ClientConnection {
  ws: WebSocket;
  user: User;
  documentId: string | null;
  lastActivity: number;
}

class CollaborationServer {
  private wss: WebSocketServer;
  private store: DocumentStore;
  private clients: Map<string, ClientConnection> = new Map(); // userId -> connection
  private documentSessions: Map<string, Set<string>> = new Map(); // documentId -> Set<userId>
  private operationQueue: Map<string, Operation[]> = new Map(); // documentId -> pending ops
  private assetManifest: AssetManifest;
  
  constructor() {
    this.store = new DocumentStore();
    this.assetManifest = this.loadAssetManifest();
    
    // Create HTTP server for WebSocket
    const server = createServer();
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection');
      this.handleConnection(ws);
    });
    
    // Start operation batching
    setInterval(() => this.flushOperationBatches(), OPERATION_BATCH_INTERVAL);
    
    server.listen(PORT, () => {
      console.log(`Collaboration server running on port ${PORT}`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
    });
  }
  
  private loadAssetManifest(): AssetManifest {
    // Pre-loaded templates for instant drag-drop
    const templates: Template[] = [
      {
        id: 'template-youtube-intro',
        name: 'YouTube Intro Card',
        category: 'video-documentation',
        thumbnail: '/assets/templates/youtube-intro.png',
        defaultWidth: 1920,
        defaultHeight: 1080,
        tags: ['youtube', 'intro', 'video'],
        elements: [
          {
            id: 'title-text',
            type: ElementType.TEXT,
            content: 'Your Title Here',
            transform: {
              position: { x: 960, y: 400 },
              size: { width: 800, height: 100 },
              rotation: 0,
              zIndex: 2
            },
            fontSize: 48,
            fontFamily: 'Inter',
            color: '#000000',
            bold: true,
            italic: false,
            underline: false,
            align: 'center',
            locked: false,
            visible: true,
            createdAt: Date.now(),
            createdBy: 'system',
            modifiedAt: Date.now(),
            modifiedBy: 'system'
          }
        ]
      },
      {
        id: 'template-step-by-step',
        name: 'Step-by-Step Tutorial',
        category: 'video-documentation',
        thumbnail: '/assets/templates/step-by-step.png',
        defaultWidth: 1920,
        defaultHeight: 1080,
        tags: ['tutorial', 'steps', 'documentation'],
        elements: [
          {
            id: 'step-number',
            type: ElementType.TEXT,
            content: 'STEP 1',
            transform: {
              position: { x: 100, y: 100 },
              size: { width: 200, height: 80 },
              rotation: 0,
              zIndex: 3
            },
            fontSize: 36,
            fontFamily: 'Inter',
            color: '#3b82f6',
            bold: true,
            italic: false,
            underline: false,
            align: 'left',
            locked: false,
            visible: true,
            createdAt: Date.now(),
            createdBy: 'system',
            modifiedAt: Date.now(),
            modifiedBy: 'system'
          },
          {
            id: 'step-description',
            type: ElementType.TEXT,
            content: 'Describe this step here',
            transform: {
              position: { x: 100, y: 200 },
              size: { width: 600, height: 200 },
              rotation: 0,
              zIndex: 2
            },
            fontSize: 24,
            fontFamily: 'Inter',
            color: '#1f2937',
            bold: false,
            italic: false,
            underline: false,
            align: 'left',
            locked: false,
            visible: true,
            createdAt: Date.now(),
            createdBy: 'system',
            modifiedAt: Date.now(),
            modifiedBy: 'system'
          }
        ]
      }
    ];
    
    return {
      templates,
      fonts: [
        { family: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap' }
      ],
      images: {},
      videos: {}
    };
  }
  
  private handleConnection(ws: WebSocket): void {
    let userId: string | null = null;
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        if (message.type === MessageType.CONNECT) {
          userId = message.user.id;
          this.clients.set(userId, {
            ws,
            user: message.user,
            documentId: null,
            lastActivity: Date.now()
          });
          console.log(`User ${message.user.name} connected`);
        } else if (userId) {
          this.handleMessage(userId, message);
        }
      } catch (err) {
        console.error('Error handling message:', err);
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        this.handleDisconnect(userId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  private handleMessage(userId: string, message: Message): void {
    const client = this.clients.get(userId);
    if (!client) return;
    
    client.lastActivity = Date.now();
    
    switch (message.type) {
      case MessageType.JOIN_DOCUMENT:
        this.handleJoinDocument(userId, message.documentId);
        break;
        
      case MessageType.LEAVE_DOCUMENT:
        this.handleLeaveDocument(userId);
        break;
        
      case MessageType.OPERATION:
        this.handleOperation(userId, message.operation);
        break;
        
      case MessageType.CURSOR_UPDATE:
        this.broadcastToDocument(client.documentId!, message, userId);
        break;
        
      case MessageType.SELECTION_UPDATE:
        this.broadcastToDocument(client.documentId!, message, userId);
        break;
        
      case MessageType.GET_VERSIONS:
        this.handleGetVersions(userId);
        break;
        
      case MessageType.RESTORE_VERSION:
        // Handle version restoration
        break;
    }
  }
  
  private handleJoinDocument(userId: string, documentId: string): void {
    const client = this.clients.get(userId);
    if (!client) return;
    
    // Get or create document
    let doc = this.store.getDocument(documentId);
    if (!doc) {
      doc = this.store.createDocument(documentId, 'Untitled Document', userId);
    }
    
    // Check permissions
    const permission = doc.permissions.get(userId);
    if (!permission) {
      // Auto-grant viewer permission for now (production would require invitation)
      doc.permissions.set(userId, PermissionLevel.VIEWER);
    }
    
    // Add to document session
    if (!this.documentSessions.has(documentId)) {
      this.documentSessions.set(documentId, new Set());
    }
    this.documentSessions.get(documentId)!.add(userId);
    client.documentId = documentId;
    
    // Get active users
    const activeUsers = Array.from(this.documentSessions.get(documentId)!)
      .map(uid => this.clients.get(uid)?.user)
      .filter((u): u is User => u !== undefined);
    
    // Send document state to joining user
    this.send(client.ws, {
      type: MessageType.DOCUMENT_STATE,
      timestamp: Date.now(),
      document: this.serializeDocument(doc),
      activeUsers
    });
    
    // Notify others
    this.broadcastToDocument(documentId, {
      type: MessageType.USER_JOINED,
      timestamp: Date.now(),
      user: client.user
    }, userId);
    
    console.log(`User ${client.user.name} joined document ${documentId}`);
  }
  
  private handleLeaveDocument(userId: string): void {
    const client = this.clients.get(userId);
    if (!client || !client.documentId) return;
    
    const documentId = client.documentId;
    this.documentSessions.get(documentId)?.delete(userId);
    client.documentId = null;
    
    this.broadcastToDocument(documentId, {
      type: MessageType.USER_LEFT,
      timestamp: Date.now(),
      userId
    });
  }
  
  private handleOperation(userId: string, operation: Operation): void {
    const client = this.clients.get(userId);
    if (!client || !client.documentId) return;
    
    const doc = this.store.getDocument(client.documentId);
    if (!doc) return;
    
    // Check permissions
    const permission = doc.permissions.get(userId);
    if (permission === PermissionLevel.VIEWER || permission === PermissionLevel.COMMENTER) {
      this.sendError(client.ws, 'PERMISSION_DENIED', 'Insufficient permissions');
      return;
    }
    
    // Apply operation
    this.applyOperation(doc, operation);
    this.store.saveDocument(doc);
    this.store.addOperation(client.documentId, operation);
    
    // Queue for batched broadcast
    if (!this.operationQueue.has(client.documentId)) {
      this.operationQueue.set(client.documentId, []);
    }
    this.operationQueue.get(client.documentId)!.push(operation);
    
    // Send acknowledgment
    this.send(client.ws, {
      type: MessageType.OPERATION_ACK,
      timestamp: Date.now(),
      operation
    });
  }
  
  private applyOperation(doc: Document, op: Operation): void {
    switch (op.type) {
      case OperationType.CREATE_ELEMENT:
        doc.state.elements.set(op.element.id, op.element);
        break;
        
      case OperationType.UPDATE_ELEMENT:
        const element = doc.state.elements.get(op.elementId);
        if (element) {
          Object.assign(element, op.changes);
          element.modifiedAt = op.timestamp;
          element.modifiedBy = op.userId;
        }
        break;
        
      case OperationType.DELETE_ELEMENT:
        doc.state.elements.delete(op.elementId);
        break;
        
      case OperationType.MOVE_ELEMENT:
        const moveEl = doc.state.elements.get(op.elementId);
        if (moveEl) {
          moveEl.transform.position = op.position;
          moveEl.modifiedAt = op.timestamp;
          moveEl.modifiedBy = op.userId;
        }
        break;
        
      case OperationType.RESIZE_ELEMENT:
        const resizeEl = doc.state.elements.get(op.elementId);
        if (resizeEl) {
          resizeEl.transform.size = op.size;
          resizeEl.modifiedAt = op.timestamp;
          resizeEl.modifiedBy = op.userId;
        }
        break;
        
      case OperationType.UPDATE_TEXT:
        const textEl = doc.state.elements.get(op.elementId);
        if (textEl && textEl.type === ElementType.TEXT) {
          textEl.content = op.content;
          textEl.modifiedAt = op.timestamp;
          textEl.modifiedBy = op.userId;
        }
        break;
        
      case OperationType.CREATE_VERSION:
        const version: DocumentVersion = {
          id: `v-${Date.now()}`,
          timestamp: op.timestamp,
          userId: op.userId,
          userName: this.clients.get(op.userId)?.user.name || 'Unknown',
          description: op.description,
          snapshot: this.cloneDocumentState(doc.state)
        };
        doc.versions.push(version);
        break;
    }
    
    doc.modifiedAt = Date.now();
  }
  
  private cloneDocumentState(state: DocumentState): DocumentState {
    return {
      elements: new Map(state.elements),
      width: state.width,
      height: state.height,
      backgroundColor: state.backgroundColor
    };
  }
  
  private flushOperationBatches(): void {
    for (const [documentId, operations] of this.operationQueue.entries()) {
      if (operations.length > 0) {
        this.broadcastToDocument(documentId, {
          type: MessageType.BATCH_OPERATIONS,
          timestamp: Date.now(),
          operations: [...operations]
        });
        this.operationQueue.set(documentId, []);
      }
    }
  }
  
  private handleGetVersions(userId: string): void {
    const client = this.clients.get(userId);
    if (!client || !client.documentId) return;
    
    const doc = this.store.getDocument(client.documentId);
    if (!doc) return;
    
    this.send(client.ws, {
      type: MessageType.VERSIONS_LIST,
      timestamp: Date.now(),
      versions: doc.versions
    });
  }
  
  private handleDisconnect(userId: string): void {
    const client = this.clients.get(userId);
    if (client?.documentId) {
      this.handleLeaveDocument(userId);
    }
    this.clients.delete(userId);
    console.log(`User ${userId} disconnected`);
  }
  
  private broadcastToDocument(documentId: string, message: Message, excludeUserId?: string): void {
    const userIds = this.documentSessions.get(documentId);
    if (!userIds) return;
    
    for (const uid of userIds) {
      if (uid === excludeUserId) continue;
      const client = this.clients.get(uid);
      if (client) {
        this.send(client.ws, message);
      }
    }
  }
  
  private send(ws: WebSocket, message: Message): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, {
      type: MessageType.ERROR,
      timestamp: Date.now(),
      code,
      message
    });
  }
  
  private serializeDocument(doc: Document): any {
    return {
      ...doc,
      state: {
        ...doc.state,
        elements: Array.from(doc.state.elements.entries())
      },
      permissions: Array.from(doc.permissions.entries())
    };
  }
}

// Start server
new CollaborationServer();
