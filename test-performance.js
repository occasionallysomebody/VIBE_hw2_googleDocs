// Performance Testing Script
// Run with: node test-performance.js

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8080';
const NUM_CLIENTS = 10;
const OPERATIONS_PER_CLIENT = 100;
const TEST_DOCUMENT_ID = 'perf-test-doc';

// Performance metrics
const metrics = {
  connectionTimes: [],
  operationLatencies: [],
  messageSizes: [],
  errors: 0,
  totalOperations: 0,
  startTime: null,
  endTime: null
};

// Test client
class TestClient {
  constructor(id) {
    this.id = id;
    this.user = {
      id: `test-user-${id}`,
      name: `Tester ${id}`,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };
    this.operationsSent = 0;
    this.operationsAcked = 0;
    this.connected = false;
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      this.ws = new WebSocket(SERVER_URL);
      
      this.ws.on('open', () => {
        const connectionTime = Date.now() - startTime;
        metrics.connectionTimes.push(connectionTime);
        this.connected = true;
        
        // Send connect message
        this.send({
          type: 'connect',
          user: this.user,
          timestamp: Date.now()
        });
        
        // Join test document
        setTimeout(() => {
          this.send({
            type: 'join_document',
            documentId: TEST_DOCUMENT_ID,
            timestamp: Date.now()
          });
          resolve();
        }, 100);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', (error) => {
        metrics.errors++;
        console.error(`Client ${this.id} error:`, error.message);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }
  
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data = JSON.stringify(message);
      metrics.messageSizes.push(data.length);
      this.ws.send(data);
    }
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'operation_ack':
        this.operationsAcked++;
        const latency = Date.now() - message.operation.timestamp;
        metrics.operationLatencies.push(latency);
        break;
        
      case 'document_state':
        console.log(`Client ${this.id} received document state`);
        break;
        
      case 'batch_operations':
        // Received operations from other clients
        break;
        
      case 'error':
        metrics.errors++;
        console.error(`Client ${this.id} server error:`, message.message);
        break;
    }
  }
  
  async sendOperations(count) {
    for (let i = 0; i < count; i++) {
      const operation = this.generateRandomOperation();
      this.send({
        type: 'operation',
        operation,
        timestamp: Date.now()
      });
      this.operationsSent++;
      metrics.totalOperations++;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  generateRandomOperation() {
    const types = ['create_element', 'move_element', 'update_text'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const baseOp = {
      id: `op-${Date.now()}-${Math.random()}`,
      type,
      documentId: TEST_DOCUMENT_ID,
      userId: this.user.id,
      timestamp: Date.now(),
      version: ++this.operationsSent
    };
    
    switch (type) {
      case 'create_element':
        return {
          ...baseOp,
          element: {
            id: `el-${Date.now()}-${Math.random()}`,
            type: 'text',
            content: `Test element ${this.operationsSent}`,
            transform: {
              position: { x: Math.random() * 1000, y: Math.random() * 1000 },
              size: { width: 200, height: 100 },
              rotation: 0,
              zIndex: 1
            },
            fontSize: 24,
            fontFamily: 'Inter',
            color: '#000000',
            bold: false,
            italic: false,
            underline: false,
            align: 'left',
            locked: false,
            visible: true,
            createdAt: Date.now(),
            createdBy: this.user.id,
            modifiedAt: Date.now(),
            modifiedBy: this.user.id
          }
        };
        
      case 'move_element':
        return {
          ...baseOp,
          elementId: `el-${Math.floor(Math.random() * 100)}`,
          position: {
            x: Math.random() * 1000,
            y: Math.random() * 1000
          }
        };
        
      case 'update_text':
        return {
          ...baseOp,
          elementId: `el-${Math.floor(Math.random() * 100)}`,
          content: `Updated at ${Date.now()}`
        };
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Calculate statistics
function calculateStats(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

// Run performance test
async function runTest() {
  console.log('🚀 Performance Test Starting');
  console.log('============================');
  console.log(`Clients: ${NUM_CLIENTS}`);
  console.log(`Operations per client: ${OPERATIONS_PER_CLIENT}`);
  console.log(`Total operations: ${NUM_CLIENTS * OPERATIONS_PER_CLIENT}`);
  console.log('');
  
  metrics.startTime = Date.now();
  
  // Create clients
  console.log('Creating test clients...');
  const clients = [];
  for (let i = 0; i < NUM_CLIENTS; i++) {
    clients.push(new TestClient(i));
  }
  
  // Connect all clients
  console.log('Connecting clients...');
  try {
    await Promise.all(clients.map(client => client.connect()));
    console.log(`✓ All ${NUM_CLIENTS} clients connected`);
  } catch (error) {
    console.error('Failed to connect clients:', error);
    return;
  }
  
  // Wait for initial sync
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send operations from all clients concurrently
  console.log('');
  console.log('Sending operations...');
  await Promise.all(clients.map(client => client.sendOperations(OPERATIONS_PER_CLIENT)));
  
  // Wait for all operations to be processed
  console.log('Waiting for server to process...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  metrics.endTime = Date.now();
  
  // Disconnect clients
  console.log('Disconnecting clients...');
  clients.forEach(client => client.disconnect());
  
  // Calculate results
  console.log('');
  console.log('============================');
  console.log('📊 Performance Results');
  console.log('============================');
  console.log('');
  
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const throughput = metrics.totalOperations / duration;
  
  console.log('Overall Metrics:');
  console.log(`  Total duration: ${duration.toFixed(2)}s`);
  console.log(`  Operations sent: ${metrics.totalOperations}`);
  console.log(`  Throughput: ${throughput.toFixed(2)} ops/sec`);
  console.log(`  Errors: ${metrics.errors}`);
  console.log('');
  
  const connStats = calculateStats(metrics.connectionTimes);
  console.log('Connection Times (ms):');
  console.log(`  Min: ${connStats.min}`);
  console.log(`  Max: ${connStats.max}`);
  console.log(`  Avg: ${connStats.avg.toFixed(2)}`);
  console.log(`  P50: ${connStats.p50}`);
  console.log(`  P95: ${connStats.p95}`);
  console.log('');
  
  const latencyStats = calculateStats(metrics.operationLatencies);
  console.log('Operation Latency (ms):');
  console.log(`  Min: ${latencyStats.min}`);
  console.log(`  Max: ${latencyStats.max}`);
  console.log(`  Avg: ${latencyStats.avg.toFixed(2)}`);
  console.log(`  P50: ${latencyStats.p50}`);
  console.log(`  P95: ${latencyStats.p95}`);
  console.log(`  P99: ${latencyStats.p99}`);
  console.log('');
  
  const sizeStats = calculateStats(metrics.messageSizes);
  console.log('Message Sizes (bytes):');
  console.log(`  Min: ${sizeStats.min}`);
  console.log(`  Max: ${sizeStats.max}`);
  console.log(`  Avg: ${sizeStats.avg.toFixed(2)}`);
  console.log('');
  
  // Performance assessment
  console.log('Assessment:');
  const passed = {
    throughput: throughput > 100,
    latencyP95: latencyStats.p95 < 200,
    latencyP99: latencyStats.p99 < 500,
    errors: metrics.errors === 0
  };
  
  console.log(`  Throughput (>100 ops/sec): ${passed.throughput ? '✓ PASS' : '✗ FAIL'} (${throughput.toFixed(2)})`);
  console.log(`  P95 Latency (<200ms): ${passed.latencyP95 ? '✓ PASS' : '✗ FAIL'} (${latencyStats.p95}ms)`);
  console.log(`  P99 Latency (<500ms): ${passed.latencyP99 ? '✓ PASS' : '✗ FAIL'} (${latencyStats.p99}ms)`);
  console.log(`  No Errors: ${passed.errors ? '✓ PASS' : '✗ FAIL'} (${metrics.errors} errors)`);
  console.log('');
  
  const allPassed = Object.values(passed).every(v => v);
  if (allPassed) {
    console.log('🎉 All performance targets met!');
  } else {
    console.log('⚠️  Some performance targets not met');
  }
  
  console.log('');
  console.log('============================');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
