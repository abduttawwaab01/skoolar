# ============================================
# Skoolar Next.js App — Production Build
# ============================================

# ─── Stage 1: Build ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Must set NEXT_DEPLOY_TARGET=docker so next.config.ts enables standalone output
ENV NEXT_DEPLOY_TARGET=docker
RUN npx prisma generate && npx next build

# Postbuild: copy resvg WASM into standalone chunks so Sharp/SVG rendering works
RUN node -e "var fs=require('fs'),p=require('path');var src=p.resolve('node_modules/@resvg/resvg-wasm/index_bg.wasm'),dst=p.resolve('.next/server/chunks/index_bg.wasm');if(fs.existsSync(src)){fs.mkdirSync(p.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);console.log('WASM copied');}else{console.warn('WASM not found at '+src);}"

# ─── Stage 2: Production ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Render overrides PORT at runtime; server.js reads process.env.PORT
CMD ["node", "server.js"]
