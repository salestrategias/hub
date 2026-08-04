#!/bin/bash
# =============================================================================
# SAL — instala o tema do blog 2.0 no WordPress (VPS com CloudPanel)
#
#   1. acha a pasta do WordPress (a que tem o wp-config.php)
#   2. copia o tema para wp-content/themes/sal-blog, com o dono certo
#   3. se o wp-cli existir, ativa o tema na hora; senão, mostra o caminho
#      no wp-admin
#
# A troca visual só acontece quando os snippets antigos do WPCode forem
# desativados — instruções no fim.
# =============================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
TEMA="$AQUI/sal-blog"
[ -d "$TEMA" ] || { echo "ERRO: pasta $TEMA não existe. O zip foi extraído inteiro?"; exit 1; }

RAIZ=""
for c in "${SAL_DOCROOT:-}" /home/*/htdocs/*salestrategias* /home/*/htdocs/* "$HOME/public_html"; do
  [ -n "$c" ] && [ -f "$c/wp-config.php" ] && { RAIZ="$c"; break; }
done
[ -n "$RAIZ" ] || { echo "ERRO: não achei o wp-config.php. Rode: SAL_DOCROOT=/caminho bash $0"; exit 1; }
echo "WordPress em: $RAIZ"

DONO="$(stat -c '%U:%G' "$RAIZ")"
DESTINO="$RAIZ/wp-content/themes/sal-blog"

if [ -d "$DESTINO" ]; then
  BK="$HOME/backup-tema-$(date +%Y%m%d-%H%M%S)"
  mv "$DESTINO" "$BK"
  echo "versão anterior do tema guardada em: $BK"
fi

cp -a "$TEMA" "$DESTINO"
chown -R "$DONO" "$DESTINO"
chmod -R u=rwX,go=rX "$DESTINO"
echo "tema copiado para $DESTINO (dono $DONO)."

USUARIO="${DONO%%:*}"
if command -v wp >/dev/null 2>&1; then
  echo "wp-cli encontrado; ativando o tema..."
  sudo -u "$USUARIO" -- wp theme activate sal-blog --path="$RAIZ" && echo "tema ATIVO." || \
    echo "não consegui ativar pelo wp-cli — ative no wp-admin (Aparência → Temas → SAL Blog)."
else
  echo
  echo ">>> Para ativar: wp-admin → Aparência → Temas → \"SAL Blog\" → Ativar."
fi

cat <<'FIM'

============================================================
DEPOIS DE ATIVAR O TEMA, no wp-admin → Snippets (WPCode),
DESATIVE estes três — é isso que faz o desenho novo aparecer:

  · SAL — Blog Portal 2026
  · SAL — Artigo 2026
  · SAL — Enxuga o carregamento do blog   (o tema já faz isso)

Depois limpe o cache do Cloudflare (Purge Everything).

Para voltar atrás: reative os snippets e o tema anterior.
============================================================
FIM
