#!/bin/bash
# =============================================================================
# SAL — implantação do site novo na Hostinger
#
# O que este script faz, nesta ordem:
#   1. encontra a pasta pública do site (a que tem o wp-config.php)
#   2. guarda uma cópia de segurança do .htaccess e de qualquer arquivo
#      que seria sobrescrito
#   3. copia os arquivos do site novo, sem tocar em NADA do WordPress
#   4. cola as regras novas no COMEÇO do .htaccess, antes do bloco do WordPress
#   5. confere no ar se a home nova respondeu, se um post antigo continua
#      de pé e se um redirecionamento antigo está valendo
#
# Ele grava um script de desfazer dentro da pasta de backup. Para voltar
# tudo como estava: bash ~/backup-sal-<data>/desfazer.sh
# =============================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
CARGA="$AQUI/site"
DOMINIO="${SAL_DOMINIO:-www.salestrategias.com.br}"

echo "== SAL: implantação do site novo =="

# ---- 1. pasta pública ------------------------------------------------------
RAIZ=""
for c in "${SAL_DOCROOT:-}" "$HOME/domains/salestrategias.com.br/public_html" "$HOME/public_html"; do
  [ -n "$c" ] && [ -f "$c/wp-config.php" ] && { RAIZ="$c"; break; }
done
if [ -z "$RAIZ" ]; then
  echo "ERRO: não achei a pasta com o wp-config.php."
  echo "Rode de novo indicando a pasta: SAL_DOCROOT=/caminho/da/pasta bash $0"
  exit 1
fi
echo "pasta do site: $RAIZ"

[ -d "$CARGA" ] || { echo "ERRO: a pasta '$CARGA' não existe. O zip foi extraído inteiro?"; exit 1; }

# ---- 2. backup -------------------------------------------------------------
BK="$HOME/backup-sal-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK/sobrescritos"
cp -a "$RAIZ/.htaccess" "$BK/htaccess.original" 2>/dev/null || touch "$BK/htaccess.original"
echo "backup em: $BK"

MANIFESTO="$BK/itens-novos.txt"; : > "$MANIFESTO"
for item in "$CARGA"/*; do
  nome="$(basename "$item")"
  case "$nome" in wp-*|index.php|xmlrpc.php|.htaccess) echo "PULANDO '$nome' (é do WordPress)"; continue;; esac
  if [ -e "$RAIZ/$nome" ]; then
    cp -a "$RAIZ/$nome" "$BK/sobrescritos/$nome"
  else
    echo "$nome" >> "$MANIFESTO"
  fi
done

# ---- 3. copiar -------------------------------------------------------------
for item in "$CARGA"/*; do
  nome="$(basename "$item")"
  case "$nome" in wp-*|index.php|xmlrpc.php|.htaccess) continue;; esac
  rm -rf "$RAIZ/$nome"
  cp -a "$item" "$RAIZ/$nome"
done
chmod -R u=rwX,go=rX "$RAIZ/_astro" "$RAIZ/fonts" "$RAIZ/img" 2>/dev/null || true
echo "arquivos copiados."

# ---- 4. .htaccess ----------------------------------------------------------
if grep -q "SAL Estratégias de Marketing — configuração do servidor" "$RAIZ/.htaccess" 2>/dev/null; then
  echo ".htaccess: as regras da SAL já estão lá, não mexi."
else
  { cat "$AQUI/htaccess-sal.txt"; echo; cat "$BK/htaccess.original"; } > "$RAIZ/.htaccess.novo"
  mv "$RAIZ/.htaccess.novo" "$RAIZ/.htaccess"
  echo ".htaccess: regras novas coladas antes do bloco do WordPress."
fi

# ---- desfazer --------------------------------------------------------------
cat > "$BK/desfazer.sh" <<DESFAZ
#!/bin/bash
# Volta o site exatamente como estava antes da implantação.
set -e
RAIZ="$RAIZ"
BK="$BK"
cp -a "\$BK/htaccess.original" "\$RAIZ/.htaccess"
while read -r nome; do rm -rf "\$RAIZ/\$nome"; done < "\$BK/itens-novos.txt"
for f in "\$BK/sobrescritos"/* ; do [ -e "\$f" ] && cp -a "\$f" "\$RAIZ/\$(basename "\$f")"; done
echo "pronto: site restaurado como era antes."
DESFAZ
chmod +x "$BK/desfazer.sh"

# ---- 5. conferir no ar -----------------------------------------------------
if [ "${SAL_PULAR_CHECAGEM:-0}" = "1" ]; then
  echo "(checagens puladas a pedido)"
else
  echo
  echo "== conferindo no ar =="
  home_ok=$(curl -sk --max-time 20 "https://$DOMINIO/" | grep -c 'Marketing na medida certa' || true)
  echo "home nova no ar ................ $( [ "$home_ok" -ge 1 ] && echo SIM || echo 'NÃO (pode ser cache — limpe o cache do hPanel)' )"
  post=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/drive-to-store-como-funciona/")
  echo "post antigo do blog ............ HTTP $post $( [ "$post" = 200 ] && echo '(ok)' || echo '(esperava 200!)' )"
  red=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/servicos/gestao-de-trafego-pago/")
  echo "redirecionamento antigo ........ HTTP $red $( [ "$red" = 301 ] && echo '(ok)' || echo '(esperava 301)' )"
  ag=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/agenda/")
  echo "página /agenda/ ................ HTTP $ag $( [ "$ag" = 200 ] && echo '(ok)' || echo '(esperava 200)' )"
fi

echo
echo "== pronto =="
echo "se algo saiu errado:  bash $BK/desfazer.sh"
