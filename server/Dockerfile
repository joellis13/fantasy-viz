FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY ../package*.json ./
COPY package*.json ./server/
COPY ../client/package*.json ./client/

# Install all dependencies
RUN npm ci --workspaces

# Copy source code
COPY . ./server/
COPY ../client ./client/

# Build client
WORKDIR /app/client
RUN npm run build

# Build server (includes tsoa generation)
WORKDIR /app/server
RUN npm run build

# Production stage - smaller image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY ../package*.json ./
COPY package*.json ./server/

# Install production dependencies only
RUN npm ci --workspace=server --omit=dev

# Copy built server files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/routes.ts ./server/src/routes.ts
COPY --from=builder /app/server/src/swagger.json ./server/src/swagger.json

# Copy built client files
COPY --from=builder /app/client/dist ./client/dist

# Create directories for runtime data
RUN mkdir -p /app/server/cache /app/server/tokens /app/server/certs

WORKDIR /app/server

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
