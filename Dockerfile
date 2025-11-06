# Multi-Stage Build für Metadata Agent Canvas
# Stage 1: Build Angular App
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Set deployment platform for Docker (uses relative /api/* paths)
ENV DEPLOYMENT_PLATFORM=vercel

# Build Angular app for production
RUN npm run build -- --configuration production

# Stage 2: Node.js Runtime with Proxy
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies for server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

WORKDIR /app

# Copy built Angular app from builder
# Angular outputs to /app/dist/browser in newer versions
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node server/healthcheck.js || exit 1

# Start server
CMD ["node", "server/index.js"]
