# ==========================================
# Stage 1: Build & Compile Native Addons
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install native build tools for compiling C++ addons (better-sqlite3)
RUN apk add --no-cache python3 make g++ git

# Copy package manifests first for optimal layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ==========================================
# Stage 2: Ultra-Lightweight Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install essential runtime utilities for WhatsApp media processing
RUN apk add --no-cache \
    ffmpeg \
    libwebp-tools \
    git \
    curl \
    tzdata

# Set environment
ENV NODE_ENV=production \
    PORT=5000 \
    DB_URL="./data/baileys_store.db"

# Copy pre-compiled dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source files
COPY . .

# Expose HTTP healthcheck port
EXPOSE 5000

# Start bot directly with memory limit (instant boot, zero PM2 overhead)
CMD ["node", "--max-old-space-size=256", "index.js"]
