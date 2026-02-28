# ─────────────────────────────────────────────
# Stage 1: deps  – install ALL dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm once; leverage Docker layer cache
RUN npm install -g pnpm@latest --prefer-offline

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 2: builder – compile client + server
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@latest --prefer-offline

COPY package*.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build both client (Vite) and server (ESM)
RUN pnpm run build

# Prune to production-only modules AFTER build
RUN pnpm prune --prod

# ─────────────────────────────────────────────
# Stage 3: runner – lean production image
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# dumb-init: PID-1 signal reaping; docker-cli for code execution sandbox
RUN apk add --no-cache dumb-init docker-cli ca-certificates tini \
  && addgroup -S appgroup \
  && adduser  -S appuser -G appgroup

WORKDIR /app

# Copy only what is needed at runtime
COPY --from=builder --chown=appuser:appgroup /app/dist          ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules  ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json  ./package.json

# Drop to non-root
USER appuser

# ── Environment ───────────────────────────────
ENV NODE_ENV=production \
  PORT=8080 \
  # V8 tweaks: expose GC, limit old-space to ~384 MB inside container
  NODE_OPTIONS="--max-old-space-size=384 --expose-gc" \
  # Disable colour codes in production logs
  NO_COLOR=1

EXPOSE 8080

# ── Health check ──────────────────────────────
HEALTHCHECK --interval=20s --timeout=8s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# tini ensures proper signal forwarding and zombie reaping
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server/cluster.mjs"]
