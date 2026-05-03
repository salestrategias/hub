#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Instala cron diário de backup às 3h da manhã
#
# Uso (na VPS, como root ou com sudo):
#   ./scripts/setup-cron.sh
#
# Idempotente: se já existir entrada do SAL Hub no crontab, atualiza.
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/backup.sh"
LOG="$ROOT/backups/cron.log"

chmod +x "$ROOT/scripts/"*.sh

mkdir -p "$ROOT/backups"

# Linha do cron: todo dia às 03:00, redireciona output para log
LINE="0 3 * * * cd $ROOT && $SCRIPT >> $LOG 2>&1 # SAL_HUB_BACKUP"

# Mantém o crontab atual sem a linha SAL_HUB_BACKUP, depois adiciona a nova
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "SAL_HUB_BACKUP" > "$TMP" || true
echo "$LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "✓ Cron instalado. Backups diários às 03:00 → $ROOT/backups/"
echo "  Verificar com:    crontab -l | grep SAL_HUB"
echo "  Ver logs com:     tail -f $LOG"
echo "  Rodar agora:      $SCRIPT"
