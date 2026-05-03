#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Backup automatizado do Postgres
#
# Uso:
#   ./scripts/backup.sh                    # backup local com rotação
#   BACKUP_KEEP=60 ./scripts/backup.sh     # mantém últimos 60 backups
#
# Configuração via .env:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#
# Para enviar a S3-compatible (Backblaze B2, Wasabi, R2, AWS S3),
# defina as variáveis abaixo antes de rodar:
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#   S3_BUCKET, S3_PREFIX (opcional, default "sal-hub")
#   S3_ENDPOINT (opcional, ex: https://s3.us-west-002.backblazeb2.com)
#
# Cron diário 3h: ./scripts/setup-cron.sh
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve diretório do projeto (script deve ficar em ./scripts/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Carrega .env se existir
if [ -f .env ]; then
  set -a; source .env; set +a
fi

DB_USER="${POSTGRES_USER:-sal}"
DB_NAME="${POSTGRES_DB:-salhub}"
KEEP="${BACKUP_KEEP:-30}"
DEST_DIR="${BACKUP_DIR:-$ROOT/backups}"

mkdir -p "$DEST_DIR"

TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
FILENAME="salhub-${TIMESTAMP}.sql.gz"
FULL_PATH="$DEST_DIR/$FILENAME"

echo "[$(date -Is)] Iniciando backup do banco $DB_NAME..."

# pg_dump dentro do container db; pipe para gzip no host
if ! docker compose ps db --format json | grep -q '"State":"running"'; then
  echo "ERRO: container 'db' não está rodando" >&2
  exit 1
fi

docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$FULL_PATH"

SIZE=$(du -h "$FULL_PATH" | cut -f1)
echo "[$(date -Is)] Backup concluído: $FILENAME ($SIZE)"

# Rotação: mantém só os últimos $KEEP arquivos
TOTAL=$(ls -1 "$DEST_DIR"/salhub-*.sql.gz 2>/dev/null | wc -l)
if [ "$TOTAL" -gt "$KEEP" ]; then
  REMOVER=$((TOTAL - KEEP))
  echo "[$(date -Is)] Rotação: removendo $REMOVER backup(s) antigo(s)..."
  ls -1t "$DEST_DIR"/salhub-*.sql.gz | tail -n "$REMOVER" | xargs -r rm -f
fi

# Upload S3-compatible (opcional)
if [ -n "${S3_BUCKET:-}" ]; then
  PREFIX="${S3_PREFIX:-sal-hub}"
  S3_PATH="s3://${S3_BUCKET}/${PREFIX}/${FILENAME}"
  ENDPOINT_FLAG=""
  if [ -n "${S3_ENDPOINT:-}" ]; then
    ENDPOINT_FLAG="--endpoint-url=${S3_ENDPOINT}"
  fi
  if command -v aws >/dev/null 2>&1; then
    echo "[$(date -Is)] Enviando para $S3_PATH..."
    aws $ENDPOINT_FLAG s3 cp "$FULL_PATH" "$S3_PATH" --quiet
    echo "[$(date -Is)] Upload S3 OK"
  else
    echo "AVISO: AWS CLI não instalado, pulando upload S3" >&2
  fi
fi

echo "[$(date -Is)] ✓ Backup finalizado"
