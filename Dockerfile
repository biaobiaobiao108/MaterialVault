# ==========================================
# Stage 1: Build Frontend Assets
# ==========================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy source code and build Vite frontend
COPY . .
RUN bun run build

# ==========================================
# Stage 2: Production Lightweight Runner
# ==========================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Copy built frontend dist, public assets, and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

# Persistent storage for SQLite database & assets pool
VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/stats || exit 1

CMD ["bun", "server/index.ts"]
