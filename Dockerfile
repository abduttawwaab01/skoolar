FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
RUN node node_modules/prisma/build/index.js generate
COPY --from=builder /app/package.json ./package.json
EXPOSE 10000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
