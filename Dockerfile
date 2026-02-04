FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for production
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY server.js ./
COPY collaborative-canvas.html ./

# Create persistence directory
RUN mkdir -p /app/persistence && \
    chown -R node:node /app

# Use non-root user
USER node

# Expose port
EXPOSE 1234

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1234/health', (r) => { if (r.statusCode !== 200) throw new Error(); })"

# Start server
CMD ["node", "server.js"]
