#!/usr/bin/env bash
# SAL Blog — wrapper do cron: roda a rotina diária de artigo no VPS.
# Executar como usuário salblog. Instalado por setup-blog-vps.sh.
set -euo pipefail

HUB_DIR="${HUB_DIR:-$HOME/hub}"
ENV_FILE="${ENV_FILE:-$HOME/blog-automacao.env}"
LOG_DIR="$HOME/logs"
LOCK="/tmp/sal-blog-artigo.lock"

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/blog-$(date +%F).log"
exec >>"$LOG" 2>&1

echo "═══ $(date -Iseconds) — início da execução ═══"

# Evita execuções sobrepostas
exec 9>"$LOCK"
flock -n 9 || { echo "Já existe execução em andamento. Abortando."; exit 0; }

# Token da assinatura Claude (gerado com: claude setup-token)
[ -f "$ENV_FILE" ] || { echo "ERRO: $ENV_FILE não existe (CLAUDE_CODE_OAUTH_TOKEN)"; exit 1; }
set -a; . "$ENV_FILE"; set +a
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || { echo "ERRO: CLAUDE_CODE_OAUTH_TOKEN vazio em $ENV_FILE"; exit 1; }

cd "$HUB_DIR"

# Sincroniza estado antes de trabalhar
git pull --rebase origin main || { echo "ERRO: git pull falhou"; exit 1; }

# Roda a rotina (prompt versionado no repo)
"$HOME/.local/bin/claude" -p "$(cat blog/prompt-rotina.md)" \
  --dangerously-skip-permissions \
  --output-format text
STATUS_CLAUDE=$?

# Persiste estado (calendário, log, fila-local) de volta pro repo
git add blog/calendario-editorial.md blog/log-publicacoes.md 2>/dev/null || true
git add blog/fila-local 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit -m "chore(blog): execucao diaria $(date +%F)"
  git push origin main || echo "AVISO: git push falhou — estado só local no VPS"
else
  echo "AVISO: nenhuma mudança de estado pra commitar (execução pode ter falhado)"
fi

echo "═══ $(date -Iseconds) — fim (claude exit=$STATUS_CLAUDE) ═══"
exit "$STATUS_CLAUDE"
