ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/
RUN npm ci && cd server && npm ci && cd ../client && npm ci

COPY server/prisma ./server/prisma
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY client/src ./client/src
COPY client/tsconfig.json client/tsconfig.app.json client/tsconfig.node.json ./client/
COPY client/vite.config.ts ./client/
COPY client/index.html ./client/
COPY client/public ./client/public

RUN cd server && npx prisma generate
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN cd client && npm run build
RUN cd server && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/
ENV PORT=7860
EXPOSE 7860
CMD sh -c "cd server && npx prisma migrate deploy && node dist/server.js"
