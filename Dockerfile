# ── Stage 1: Build client ──
FROM node:22-alpine AS client-builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Stage 2: Build server ──
FROM node:22-alpine AS server-builder

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
COPY --from=client-builder /app/client/dist ../client/dist
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production image ──
FROM node:22-alpine

WORKDIR /app

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=server-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server/dist/server.js"]
