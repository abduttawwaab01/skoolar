# ============================================
# Skoolar Next.js App — Production Build
# ============================================

# ─── Stage 1: Build ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Generate Prisma client and build Next.js (standalone output)
ENV NEXT_DEPLOY_TARGET=docker
RUN npx prisma generate && npx next build

# Copy resvg WASM into server chunks for SVG rendering
RUN node -e "var fs=require('fs'),p=require('path');var src=p.resolve('node_modules/@resvg/resvg-wasm/index_bg.wasm');[p.resolve('.next/server/chunks/index_bg.wasm'),p.resolve('.next/standalone/.next/server/chunks/index_bg.wasm')].forEach(function(dst){if(fs.existsSync(src)){fs.mkdirSync(p.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);console.log('WASM copied to '+dst);}else{console.warn('WASM not found at '+src);}});"

# ─── Stage 2: Production ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the full .next build output (preserves standalone directory structure)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Render sets PORT=10000 at runtime; next start reads PORT automatically
CMD node .next/standalone/server.js
