# ─────────────────────────────────────────────────────────────────
# SAL Hub — multi-stage build otimizado
# Imagem final: ~180 MB (Node 20 alpine + standalone Next.js + Prisma client)
# ─────────────────────────────────────────────────────────────────

# ───── Stage 1: deps (instala node_modules) ──────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copia manifest e prisma schema para gerar client durante install
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Usa npm ci se houver lock; cai para npm install em primeiro deploy.
# --legacy-peer-deps necessário porque eslint-config-next@14 ainda exige eslint@8.
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# ───── Stage 2: builder (build do Next.js) ───────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ───── Stage 3: runner (imagem final mínima) ─────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tzdata
ENV TZ=America/Sao_Paulo
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output do Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: schema + client gerado + CLI para migrate/push em runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck de container
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --spider http://localhost:3000/api/mcp || exit 1

CMD ["node", "server.js"]
