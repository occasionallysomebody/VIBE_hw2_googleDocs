# Production Deployment Guide

## Overview

This guide covers deploying the collaborative editor to production environments with high availability, scalability, and performance.

## Prerequisites

- Node.js 18+ LTS
- Redis 7.0+
- PostgreSQL 14+
- Nginx or similar load balancer
- SSL certificates
- Monitoring infrastructure (Prometheus/Grafana)

## Architecture Decisions for Production

### 1. Persistent Storage

**Replace in-memory storage with:**

```typescript
// server/storage/redis-store.ts
import { createClient } from 'redis';

class RedisDocumentStore {
  private client: ReturnType<typeof createClient>;
  
  async initialize() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });
    
    await this.client.connect();
  }
  
  async getDocument(id: string): Promise<Document | null> {
    const data = await this.client.get(`doc:${id}`);
    return data ? JSON.parse(data) : null;
  }
  
  async saveDocument(doc: Document): Promise<void> {
    await this.client.set(`doc:${doc.id}`, JSON.stringify(doc));
  }
  
  async addOperation(documentId: string, operation: Operation): Promise<void> {
    // Use Redis Streams for operation log
    await this.client.xAdd(`ops:${documentId}`, '*', {
      data: JSON.stringify(operation)
    });
  }
  
  // Pub/Sub for cross-server synchronization
  async publishOperation(documentId: string, operation: Operation): Promise<void> {
    await this.client.publish(
      `channel:${documentId}`,
      JSON.stringify(operation)
    );
  }
  
  async subscribeToDocument(documentId: string, handler: (op: Operation) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(`channel:${documentId}`, (message) => {
      handler(JSON.parse(message));
    });
  }
}
```

### 2. Database Schema (PostgreSQL)

```sql
-- Documents table
CREATE TABLE documents (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_modified_at (modified_at)
);

-- Permissions table
CREATE TABLE document_permissions (
  document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  permission_level VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_id),
  INDEX idx_user_docs (user_id)
);

-- Versions table
CREATE TABLE document_versions (
  id VARCHAR(255) PRIMARY KEY,
  document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  description TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_doc_versions (document_id, version_number)
);

-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_email (email)
);

-- Operations log (for audit trail)
CREATE TABLE operations_log (
  id BIGSERIAL PRIMARY KEY,
  operation_id VARCHAR(255) UNIQUE NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  operation_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  INDEX idx_doc_ops (document_id, timestamp),
  INDEX idx_user_ops (user_id, timestamp)
);
```

### 3. Environment Configuration

```bash
# .env.production

# Server
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# WebSocket
WS_MAX_CONNECTIONS=10000
WS_HEARTBEAT_INTERVAL=30000
WS_IDLE_TIMEOUT=300000

# Redis
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=your-secure-password
REDIS_TLS_ENABLED=true

# PostgreSQL
DATABASE_URL=postgresql://user:pass@postgres-primary:5432/collab_editor
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50

# Authentication
JWT_SECRET=your-very-long-secure-random-secret
JWT_EXPIRY=86400

# Storage
S3_BUCKET=collab-editor-assets
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
SENTRY_DSN=https://your-sentry-dsn

# Rate Limiting
RATE_LIMIT_OPERATIONS_PER_MINUTE=1000
RATE_LIMIT_CONNECTIONS_PER_IP=10

# Feature Flags
FEATURE_AI_SUGGESTIONS=true
FEATURE_VIDEO_PROCESSING=true
```

### 4. Load Balancer Configuration (Nginx)

```nginx
# /etc/nginx/sites-available/collab-editor

upstream websocket_backend {
    # Sticky sessions based on IP
    ip_hash;
    
    server server1:8080 max_fails=3 fail_timeout=30s;
    server server2:8080 max_fails=3 fail_timeout=30s;
    server server3:8080 max_fails=3 fail_timeout=30s;
}

# WebSocket server
server {
    listen 443 ssl http2;
    server_name ws.example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # Buffer settings
        proxy_buffering off;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://websocket_backend/health;
    }
}

# Static client assets
server {
    listen 443 ssl http2;
    server_name app.example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    root /var/www/collab-editor/client;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;
    gzip_min_length 1000;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. Docker Deployment

```dockerfile
# Dockerfile.server
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy source
COPY server/ ./
COPY shared/ ../shared/

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Run as non-root
USER node

EXPOSE 8080
CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  # WebSocket servers
  server1:
    build:
      context: .
      dockerfile: Dockerfile.server
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/collab_editor
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    
  server2:
    build:
      context: .
      dockerfile: Dockerfile.server
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/collab_editor
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
  
  # Redis for caching and Pub/Sub
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  # PostgreSQL for persistent storage
  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=collab_editor
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  # Nginx load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - server1
      - server2
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

### 6. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collab-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: collab-server
  template:
    metadata:
      labels:
        app: collab-server
    spec:
      containers:
      - name: server
        image: your-registry/collab-server:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: collab-server-service
spec:
  type: LoadBalancer
  selector:
    app: collab-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  sessionAffinity: ClientIP
```

### 7. Monitoring Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'collab-server'
    static_configs:
      - targets: ['server1:9090', 'server2:9090', 'server3:9090']
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### 8. Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

# Backup PostgreSQL
pg_dump -h postgres-primary -U postgres collab_editor | \
  gzip > /backups/postgres_$(date +%Y%m%d).sql.gz

# Backup Redis (RDB snapshot)
redis-cli --rdb /backups/redis_$(date +%Y%m%d).rdb

# Upload to S3
aws s3 sync /backups/ s3://your-backup-bucket/collab-editor/

# Cleanup old backups (keep 30 days)
find /backups/ -name "*.gz" -mtime +30 -delete
find /backups/ -name "*.rdb" -mtime +30 -delete
```

### 9. Deployment Checklist

- [ ] Set all environment variables
- [ ] Configure SSL certificates
- [ ] Set up database migrations
- [ ] Configure Redis persistence
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation (ELK/CloudWatch)
- [ ] Test failover scenarios
- [ ] Load test with expected traffic
- [ ] Configure backup automation
- [ ] Document incident response procedures
- [ ] Set up CI/CD pipeline
- [ ] Configure auto-scaling rules
- [ ] Test disaster recovery

### 10. Performance Tuning

**Node.js**
```bash
# Use cluster mode for multi-core utilization
node --max-old-space-size=4096 --optimize-for-size dist/server.js
```

**PostgreSQL**
```sql
-- Optimize for read-heavy workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_connections = 200;
```

**Redis**
```
# redis.conf
maxmemory 8gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 11. Security Hardening

```typescript
// server/middleware/security.ts
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'Too many requests'
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss://ws.example.com']
    }
  }
}));

// Input sanitization
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .substring(0, 10000);
}
```

### 12. Cost Optimization

**AWS Estimates** (1000 concurrent users):
- EC2 (t3.xlarge × 3): $450/month
- RDS PostgreSQL (db.r5.large): $300/month
- ElastiCache Redis (cache.r5.large): $250/month
- S3 + CloudFront: $100/month
- Load Balancer: $30/month
- **Total: ~$1,130/month**

**Scaling Guidelines**:
- 1-100 users: 1 server, small DB
- 100-1000 users: 2-3 servers, medium DB
- 1000-10000 users: 5+ servers, large DB with read replicas
- 10000+ users: Auto-scaling cluster, sharded DB

---

## Deployment Commands

```bash
# Build and deploy
npm run build
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f server1

# Scale servers
docker-compose up -d --scale server=5

# Rollback
docker-compose down
git checkout previous-tag
docker-compose up -d
```

---

**Production deployment requires careful planning and testing. Always test in staging first!**
