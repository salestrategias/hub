#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Preflight check
#
# Verifica se o ambiente está pronto pra subir/deployar.
# Roda local ANTES de fazer push, ou no VPS antes do primeiro setup.
# ─────────────────────────────────────────────────────────────────

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "${RED}✗${RESET} $*"; FAILED=1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

echo "🔎 Verificando ambiente do SAL Hub..."
echo ""

# ─── Arquivos críticos ───────────────────────────────────────────
echo "Arquivos:"
[ -f package.json ]     && ok "package.json"     || fail "package.json ausente"
[ -f docker-compose.yml ] && ok "docker-compose.yml" || fail "docker-compose.yml ausente"
[ -f Dockerfile ]       && ok "Dockerfile"       || fail "Dockerfile ausente"
[ -f nginx.conf ]       && ok "nginx.conf"       || fail "nginx.conf ausente"
[ -f prisma/schema.prisma ] && ok "prisma/schema.prisma" || fail "prisma/schema.prisma ausente"
[ -f .env.example ]     && ok ".env.example"     || fail ".env.example ausente"
echo ""

# ─── .env (se existir, validar) ──────────────────────────────────
if [ -f .env ]; then
  echo ".env presente — validando variáveis críticas:"
  set -a; source .env 2>/dev/null || true; set +a

  [ -n "${POSTGRES_PASSWORD:-}" ] && [ "${POSTGRES_PASSWORD}" != "sal" ] \
    && ok "POSTGRES_PASSWORD definida e não-padrão" \
    || fail "POSTGRES_PASSWORD ausente ou ainda é o valor de exemplo"

  [ -n "${NEXTAUTH_SECRET:-}" ] && [ "${#NEXTAUTH_SECRET}" -ge 32 ] \
    && ok "NEXTAUTH_SECRET com comprimento adequado" \
    || fail "NEXTAUTH_SECRET ausente ou < 32 chars (gere com: openssl rand -base64 32)"

  [ -n "${NEXTAUTH_URL:-}" ] \
    && ok "NEXTAUTH_URL = $NEXTAUTH_URL" \
    || fail "NEXTAUTH_URL ausente"

  if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
    ok "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET preenchidos"
  else
    warn "GOOGLE_CLIENT_ID/SECRET vazios — Drive e Agenda não funcionarão até preencher"
  fi
else
  warn ".env não existe — será criado no setup-vps.sh"
fi
echo ""

# ─── Docker ──────────────────────────────────────────────────────
echo "Docker:"
if command -v docker >/dev/null 2>&1; then
  ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"
  if docker compose version >/dev/null 2>&1; then
    ok "compose plugin disponível"
  else
    fail "Plugin compose ausente — instale docker-compose-plugin"
  fi
else
  warn "Docker não instalado localmente (ok se for rodar só no VPS)"
fi
echo ""

# ─── Permissões dos scripts ──────────────────────────────────────
echo "Scripts:"
for s in scripts/*.sh; do
  if [ -x "$s" ]; then
    ok "$s executável"
  else
    warn "$s sem permissão de execução (rode: chmod +x $s)"
  fi
done
echo ""

# ─── Tamanho do build context ────────────────────────────────────
if [ -d node_modules ]; then
  warn "node_modules está presente — confira se .dockerignore o ignora"
fi
if [ -d .next ]; then
  warn ".next está presente — confira se .dockerignore o ignora"
fi
echo ""

# ─── Resultado ───────────────────────────────────────────────────
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}✓ Tudo OK${RESET}. Pode prosseguir com:"
  echo "    docker compose up -d --build  (local)"
  echo "    ./scripts/deploy.sh           (no VPS após setup-vps.sh)"
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${RED}✗ $FAILED problema(s)${RESET} — corrija antes de subir"
  exit 1
fi
