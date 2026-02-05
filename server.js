// Team Members: [Your names here - this is the ONLY line you can write manually]

/**
 * Collaborative Text Editor - Server
 * Real-time WebSocket server managing multiple documents and clients
 * Generated using Persona Pattern with AI assistance
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (client.html)
app.use(express.static(__dirname));

// In-memory storage for documents
const documents = new Map();
// Track active users per document
const documentUsers = new Map();

// Initialize with a default document
documents.set('welcome', {
  id: 'welcome',
  name: 'Welcome Document',
  content: 'Welcome to the Collaborative Text Editor!\n\nStart typing to see real-time collaboration in action.\n\nOpen this in multiple browser tabs to test!',
  lastModified: Date.now(),
  activeUsers: new Set()
});
documentUsers.set('welcome', new Set());

/**
 * Handle new WebSocket connections
 */
io.on('connection', (socket) => {
  console.log(`[CONNECTION] New client connected: ${socket.id}`);
  
  // Track current document for this socket
  let currentDocument = null;

  /**
   * Send list of available documents to client
   */
  socket.on('list-documents', () => {
    const docList = Array.from(documents.values()).map(doc => ({
      id: doc.id,
      name: doc.name,
      lastModified: doc.lastModified,
      activeUsers: documentUsers.get(doc.id)?.size || 0
    }));
    socket.emit('document-list', docList);
    console.log(`[LIST] Sent ${docList.length} documents to ${socket.id}`);
  });

  /**
   * Handle client joining a document
   */
  socket.on('join-document', (documentId) => {
    // Leave previous document if any
    if (currentDocument) {
      socket.leave(currentDocument);
      documentUsers.get(currentDocument)?.delete(socket.id);
      io.to(currentDocument).emit('user-left', {
        userId: socket.id,
        activeUsers: documentUsers.get(currentDocument)?.size || 0
      });
    }

    // Join new document
    currentDocument = documentId;
    socket.join(documentId);
    
    // Add user to document's active users
    if (!documentUsers.has(documentId)) {
      documentUsers.set(documentId, new Set());
    }
    documentUsers.get(documentId).add(socket.id);

    // Send document content to the joining client
    const doc = documents.get(documentId);
    if (doc) {
      socket.emit('document-content', {
        id: doc.id,
        name: doc.name,
        content: doc.content
      });
      
      // Notify other users in the document
      socket.to(documentId).emit('user-joined', {
        userId: socket.id,
        activeUsers: documentUsers.get(documentId).size
      });

      console.log(`[JOIN] Client ${socket.id} joined document "${doc.name}" (${documentUsers.get(documentId).size} active users)`);
    } else {
      socket.emit('error', { message: 'Document not found' });
    }
  });

  /**
   * Handle text changes from client
   */
  socket.on('text-change', (data) => {
    if (!currentDocument) {
      return;
    }

    const doc = documents.get(currentDocument);
    if (doc) {
      // Update document content
      doc.content = data.content;
      doc.lastModified = Date.now();
      
      // Broadcast to all other clients in the same document
      socket.to(currentDocument).emit('text-update', {
        content: data.content,
        userId: socket.id,
        timestamp: doc.lastModified
      });

      console.log(`[UPDATE] Document "${doc.name}" updated by ${socket.id}`);
    }
  });

  /**
   * Handle new document creation
   */
  socket.on('create-document', (data) => {
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newDoc = {
      id: docId,
      name: data.name || 'Untitled Document',
      content: '',
      lastModified: Date.now(),
      activeUsers: new Set()
    };
    
    documents.set(docId, newDoc);
    documentUsers.set(docId, new Set());
    
    // Notify all clients of new document
    io.emit('document-created', {
      id: newDoc.id,
      name: newDoc.name,
      lastModified: newDoc.lastModified
    });

    console.log(`[CREATE] New document created: "${newDoc.name}" (${docId})`);
    
    // Automatically join the creator to the new document
    socket.emit('join-document-response', { documentId: docId });
  });

  /**
   * Handle client disconnect
   */
  socket.on('disconnect', () => {
    if (currentDocument) {
      documentUsers.get(currentDocument)?.delete(socket.id);
      io.to(currentDocument).emit('user-left', {
        userId: socket.id,
        activeUsers: documentUsers.get(currentDocument)?.size || 0
      });
      console.log(`[DISCONNECT] Client ${socket.id} left document "${currentDocument}"`);
    }
    console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  COLLABORATIVE TEXT EDITOR SERVER');
  console.log('='.repeat(60));
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Open http://localhost:${PORT}/client.html in multiple tabs`);
  console.log('='.repeat(60));
});
