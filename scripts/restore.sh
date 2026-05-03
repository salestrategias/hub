#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Restore de backup do Postgres
#
# Uso:
#   ./scripts/restore.sh <arquivo.sql.gz>
#   ./scripts/restore.sh backups/salhub-20260503-031500.sql.gz
#
# ATENÇÃO: SOBRESCREVE o banco atual. Faça backup do estado atual antes
# se houver algo importante.
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a; source .env; set +a
fi

DB_USER="${POSTGRES_USER:-sal}"
DB_NAME="${POSTGRES_DB:-salhub}"

if [ $# -lt 1 ]; then
  echo "Uso: $0 <arquivo.sql.gz>" >&2
  echo "" >&2
  echo "Backups disponíveis:" >&2
  ls -lh backups/salhub-*.sql.gz 2>/dev/null || echo "  (nenhum)" >&2
  exit 1
fi

ARQUIVO="$1"
if [ ! -f "$ARQUIVO" ]; then
  echo "ERRO: arquivo $ARQUIVO não encontrado" >&2
  exit 1
fi

if ! docker compose ps db --format json | grep -q '"State":"running"'; then
  echo "ERRO: container 'db' não está rodando" >&2
  exit 1
fi

echo ""
echo "⚠️  ATENÇÃO: você está prestes a SOBRESCREVER o banco $DB_NAME"
echo "   Arquivo: $ARQUIVO"
echo "   Tamanho: $(du -h "$ARQUIVO" | cut -f1)"
echo ""
read -r -p "Digite 'restaurar' para confirmar: " CONFIRM
if [ "$CONFIRM" != "restaurar" ]; then
  echo "Cancelado."
  exit 0
fi

echo "[$(date -Is)] Restaurando..."
gunzip -c "$ARQUIVO" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"
echo "[$(date -Is)] ✓ Restore concluído"
echo ""
echo "Recomendação: rode 'docker compose restart app' para o app re-conectar"
