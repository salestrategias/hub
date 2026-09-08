#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL — puxa a última publicação do site estático (branch
# publicacao-site) e aplica no docroot do www.
#
# Instalado em /root/sal-site-pull.sh e chamado pelo cron a cada
# 5 minutos. Só toca no disco quando o branch tem commit novo;
# depois de aplicar, limpa o Varnish para a mudança aparecer na hora.
#
# Uso manual:  /root/sal-site-pull.sh          (aplica se houver novidade)
#              /root/sal-site-pull.sh --forca  (aplica de qualquer jeito)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="git@github.com:salestrategias/hub.git"
BRANCH="publicacao-site"
CLONE="/root/.sal-site-pub"
DOCROOT="/home/marcelofreitas/htdocs/www.salestrategias.com.br"
DONO="marcelofreitas:marcelofreitas"

if [ ! -d "$CLONE/.git" ]; then
  git clone --depth 1 --branch "$BRANCH" --single-branch "$REPO" "$CLONE"
  FORCA=1
fi

cd "$CLONE"
git fetch --depth 1 origin "$BRANCH" --quiet
LOCAL=$(git rev-parse HEAD)
REMOTO=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTO" ] && [ "${FORCA:-0}" != "1" ] && [ "${1:-}" != "--forca" ]; then
  exit 0
fi

git reset --hard "origin/$BRANCH" --quiet

# Sem --delete, de propósito: o docroot é compartilhado com o WordPress.
rsync -a --exclude='.git' --chown="$DONO" "$CLONE/" "$DOCROOT/"

# Varnish: derruba o cache do host inteiro (páginas estáticas ficam nele)
varnishadm "ban req.http.host == www.salestrategias.com.br" 2>/dev/null \
  || varnishadm "ban req.url ~ ." 2>/dev/null \
  || true

echo "$(date '+%F %T') site atualizado para $REMOTO"
