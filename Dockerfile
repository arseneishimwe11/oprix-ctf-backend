# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies (devDependencies for build)
RUN npm install -g pnpm && \
    pnpm install && \
    pnpm store prune

# Copy TypeScript config and NestJS config (needed for build)
COPY tsconfig*.json nest-cli.json ./

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN pnpm run build

# Production
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init and OpenSSL for Prisma
RUN apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files, prisma schema, and built app from builder
COPY --chown=nestjs:nodejs package*.json pnpm-lock.yaml ./
COPY --chown=nestjs:nodejs prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Install pnpm and ALL dependencies with flat structure
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --shamefully-hoist && \
    pnpm exec prisma generate && \
    pnpm store prune

# Create uploads directory
RUN mkdir -p uploads && chown -R nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/src/main.js"]
