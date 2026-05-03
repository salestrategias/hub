#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Deploy incremental
#
# Use ESTE script após o setup-vps.sh inicial, sempre que quiser
# atualizar o código no VPS.
#
# Faz:
#   1. git pull do main
#   2. backup automático antes de qualquer mudança no banco
#   3. docker compose build + up
#   4. roda migrations (se houver) ou db push
#   5. healthcheck pós-deploy
#
# Uso (no VPS):
#   cd /opt/sal-hub && ./scripts/deploy.sh
#
# Uso remoto (do seu laptop):
#   ssh root@SEU_VPS "cd /opt/sal-hub && ./scripts/deploy.sh"
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${BLUE}▸${RESET} $*"; }
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "${RED}✗${RESET} $*"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f .env ] || fail ".env não encontrado em $ROOT — rode setup-vps.sh primeiro"
[ -f docker-compose.yml ] || fail "docker-compose.yml não encontrado"

# ─── 1. Backup antes de mudar qualquer coisa ─────────────────────
if docker compose ps db --format json 2>/dev/null | grep -q '"State":"running"'; then
  log "Backup pré-deploy..."
  ./scripts/backup.sh || warn "Backup falhou (continua mesmo assim)"
else
  warn "DB não está rodando — pulando backup pré-deploy"
fi

# ─── 2. Pull do código ────────────────────────────────────────────
log "Atualizando código..."
git fetch --all --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
if [ "$LOCAL" = "$REMOTE" ]; then
  ok "Já está atualizado ($(git rev-parse --short HEAD))"
else
  CHANGES=$(git log --oneline "$LOCAL..$REMOTE" | head -20)
  log "Mudanças a aplicar:"
  echo "$CHANGES" | sed 's/^/     /'
  git pull --ff-only
  ok "Pull concluído ($(git rev-parse --short HEAD))"
fi

chmod +x scripts/*.sh 2>/dev/null || true

# ─── 3. Build + up ────────────────────────────────────────────────
log "Building app (multi-stage)..."
docker compose build app

log "Reiniciando containers..."
docker compose up -d --no-deps app

# ─── 4. Aguardar healthcheck ──────────────────────────────────────
log "Aguardando app ficar saudável..."
HEALTHY=false
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://localhost:3000/api/mcp 2>/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 2
done

if [ "$HEALTHY" = true ]; then
  ok "App respondendo em http://localhost:3000"
else
  warn "App não respondeu em 60s — checar logs com: docker compose logs -f app"
fi

# ─── 5. Limpar imagens antigas ────────────────────────────────────
log "Limpando imagens antigas..."
docker image prune -f >/dev/null

# ─── Resumo ───────────────────────────────────────────────────────
echo ""
ok "Deploy concluído"
echo "   Commit:  $(git rev-parse --short HEAD)"
echo "   Status:  $(docker compose ps --format 'table {{.Service}}\t{{.Status}}' | tail -n +2)"
echo ""
echo "   Logs em tempo real: docker compose logs -f app"
