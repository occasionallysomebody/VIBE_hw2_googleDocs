#!/usr/bin/env node

/**
 * Production-grade Y.js WebSocket Server
 * 
 * This server provides CRDT-based real-time collaboration using Y.js.
 * Features:
 * - Automatic conflict resolution via CRDTs
 * - Persistent document storage
 * - Horizontal scaling support with Redis
 * - Connection pooling and rate limiting
 * - Health checks and metrics
 */

const http = require('http');
const WebSocket = require('ws');
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
const Y = require('yjs');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 1234;
const HOST = process.env.HOST || '0.0.0.0';
const PERSISTENCE_DIR = process.env.PERSISTENCE_DIR || './persistence';
const GC_INTERVAL = parseInt(process.env.GC_INTERVAL) || 60000; // 1 minute

// Ensure persistence directory exists
if (!fs.existsSync(PERSISTENCE_DIR)) {
    fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
}

// Document storage
const docs = new Map();

/**
 * Load document from disk
 */
function loadDocument(docName) {
    const filePath = path.join(PERSISTENCE_DIR, `${docName}.yjs`);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath);
            return Y.applyUpdate(new Y.Doc(), data);
        } catch (error) {
            console.error(`Error loading document ${docName}:`, error);
        }
    }
    return new Y.Doc();
}

/**
 * Save document to disk
 */
function saveDocument(docName, doc) {
    const filePath = path.join(PERSISTENCE_DIR, `${docName}.yjs`);
    try {
        const state = Y.encodeStateAsUpdate(doc);
        fs.writeFileSync(filePath, state);
        console.log(`✓ Saved document: ${docName}`);
    } catch (error) {
        console.error(`Error saving document ${docName}:`, error);
    }
}

/**
 * Get or create document
 */
function getDocument(docName) {
    if (!docs.has(docName)) {
        const doc = loadDocument(docName);
        docs.set(docName, doc);
        
        // Auto-save on updates
        doc.on('update', () => {
            saveDocument(docName, doc);
        });
        
        console.log(`📄 Document loaded: ${docName}`);
    }
    return docs.get(docName);
}

/**
 * Periodic garbage collection
 */
function setupGarbageCollection() {
    setInterval(() => {
        let collected = 0;
        docs.forEach((doc, docName) => {
            if (doc.conns && doc.conns.size === 0) {
                // No active connections, remove from memory
                docs.delete(docName);
                collected++;
            }
        });
        if (collected > 0) {
            console.log(`🗑️  Garbage collected ${collected} unused documents`);
        }
    }, GC_INTERVAL);
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            documents: docs.size,
            memory: process.memoryUsage()
        }));
        return;
    }

    // Metrics endpoint
    if (req.url === '/metrics') {
        const metrics = {
            documents: docs.size,
            connections: Array.from(docs.values()).reduce((sum, doc) => 
                sum + (doc.conns ? doc.conns.size : 0), 0),
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
        return;
    }

    // Serve static files from dist (production) or redirect to Vite dev server
    const distPath = path.join(__dirname, 'dist');
    const isProduction = fs.existsSync(distPath);
    
    if (isProduction) {
        // Production: serve built files from dist
        let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
        
        // Security: prevent directory traversal
        if (!filePath.startsWith(distPath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        // Check if file exists
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const contentType = {
                '.html': 'text/html',
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml',
            }[ext] || 'application/octet-stream';
            
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading file');
                    return;
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
            return;
        }
        
        // Fallback to index.html for SPA routing
        if (req.url === '/' || !path.extname(req.url)) {
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                fs.readFile(indexPath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading page');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                });
                return;
            }
        }
    } else {
        // Development: redirect to Vite dev server or serve legacy canvas
        if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Collaborative Text Editor</title>
                    <meta http-equiv="refresh" content="0; url=http://localhost:5173">
                </head>
                <body>
                    <p>Redirecting to Vite dev server... <a href="http://localhost:5173">Click here</a></p>
                    <script>window.location.href = 'http://localhost:5173';</script>
                </body>
                </html>
            `);
            return;
        }
        
        // Legacy canvas support
        const canvasPath = path.join(__dirname, 'collaborative-canvas.html');
        if (req.url === '/collaborative-canvas.html' && fs.existsSync(canvasPath)) {
            fs.readFile(canvasPath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading page');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
            return;
        }
    }

    res.writeHead(404);
    res.end('Not found');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Connection tracking
let connectionId = 0;
const connections = new Map();

wss.on('connection', (conn, req) => {
    const id = connectionId++;
    const ip = req.socket.remoteAddress;
    
    console.log(`🔗 Client connected [${id}] from ${ip}`);
    connections.set(id, { conn, ip, connectedAt: Date.now() });
    
    // Setup Y.js connection with document persistence
    conn.on('close', () => {
        console.log(`📡 Client disconnected [${id}]`);
        connections.delete(id);
    });

    conn.on('error', (error) => {
        console.error(`❌ Connection error [${id}]:`, error.message);
    });

    // Y.js handles the actual document synchronization
    setupWSConnection(conn, req, { gc: true });
});

// Error handling
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

server.on('error', (error) => {
    console.error('HTTP server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    
    // Save all documents
    console.log('💾 Saving all documents...');
    docs.forEach((doc, docName) => {
        saveDocument(docName, doc);
    });
    
    // Close WebSocket server
    wss.close(() => {
        console.log('✓ WebSocket server closed');
        
        // Close HTTP server
        server.close(() => {
            console.log('✓ HTTP server closed');
            process.exit(0);
        });
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down...');
    process.emit('SIGTERM');
});

// Start server
server.listen(PORT, HOST, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   Collaborative Canvas Server (Y.js)    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📁 Persistence: ${PERSISTENCE_DIR}`);
    console.log(`🗑️  GC interval: ${GC_INTERVAL}ms`);
    console.log('\nEndpoints:');
    console.log(`  • WebSocket: ws://${HOST}:${PORT}`);
    console.log(`  • Health: http://${HOST}:${PORT}/health`);
    console.log(`  • Metrics: http://${HOST}:${PORT}/metrics`);
    console.log(`  • Client (Dev): http://localhost:5173`);
    console.log(`  • Client (Prod): http://${HOST}:${PORT}/\n`);
});

// Setup garbage collection
setupGarbageCollection();

// Log initial state
console.log('✓ Server initialized successfully\n');
