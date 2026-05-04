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

# Prisma: schema + client gerado para a app rodar
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI global — usado pelo command do compose (db push / migrate deploy)
RUN npm install -g prisma@5.22.0 && rm -rf /root/.npm

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Sem HEALTHCHECK no container: o Traefik 3 filtra containers em "starting",
# e o standalone do Next não tem rota HEAD pública pra checar com --spider sem auth.
# A saúde da app é monitorada via uptime externo (UptimeRobot, etc.).

CMD ["node", "server.js"]
