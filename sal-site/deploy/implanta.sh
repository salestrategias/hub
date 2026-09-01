#!/bin/bash
# =============================================================================
# SAL — implantação do site novo
#
# Funciona nos dois cenários:
#   • hospedagem compartilhada com Apache (usa .htaccess)
#   • VPS com CloudPanel/nginx (copia os arquivos e entrega o trecho de
#     configuração para colar no Vhost Editor)
#
# O que faz, nesta ordem:
#   1. encontra a pasta pública do site (a que tem o wp-config.php)
#   2. guarda backup do que seria sobrescrito
#   3. copia os arquivos do site novo, sem tocar em NADA do WordPress
#   4. Apache: cola as regras no .htaccess | nginx: mostra o que colar no vhost
#   5. confere no ar
#
# Para desfazer: bash ~/backup-sal-<data>/desfazer.sh
# =============================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
CARGA="$AQUI/site"
DOMINIO="${SAL_DOMINIO:-www.salestrategias.com.br}"

echo "== SAL: implantação do site novo =="

# ---- 1. pasta pública ------------------------------------------------------
RAIZ=""
if [ -n "${SAL_DOCROOT:-}" ] && [ -f "${SAL_DOCROOT}/wp-config.php" ]; then
  RAIZ="$SAL_DOCROOT"
fi
if [ -z "$RAIZ" ]; then
  for c in "$HOME/domains/salestrategias.com.br/public_html" "$HOME/public_html" \
           /home/*/htdocs/*salestrategias* /home/*/htdocs/*; do
    [ -f "$c/wp-config.php" ] && { RAIZ="$c"; break; }
  done
fi
if [ -z "$RAIZ" ]; then
  echo "ERRO: não achei a pasta com o wp-config.php."
  echo "Rode de novo indicando: SAL_DOCROOT=/caminho/da/pasta bash $0"
  exit 1
fi
echo "pasta do site: $RAIZ"

DONO="$(stat -c '%U:%G' "$RAIZ")"
echo "dono dos arquivos: $DONO"

if pgrep -x nginx >/dev/null 2>&1 || [ -d /etc/nginx/sites-enabled ]; then
  MODO=nginx
else
  MODO=apache
fi
[ -n "${SAL_MODO:-}" ] && MODO="$SAL_MODO"
echo "servidor web: $MODO"

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
COPIADOS=()
for item in "$CARGA"/*; do
  nome="$(basename "$item")"
  case "$nome" in wp-*|index.php|xmlrpc.php|.htaccess) continue;; esac
  rm -rf "$RAIZ/$nome"
  cp -a "$item" "$RAIZ/$nome"
  COPIADOS+=("$RAIZ/$nome")
done
# os arquivos precisam pertencer ao usuário do site, não ao root
if [ "$(id -u)" = "0" ] && [ ${#COPIADOS[@]} -gt 0 ]; then
  chown -R "$DONO" "${COPIADOS[@]}"
fi
chmod -R u=rwX,go=rX "${COPIADOS[@]}" 2>/dev/null || true
echo "arquivos copiados (${#COPIADOS[@]} itens, dono $DONO)."

# ---- 4. regras do servidor -------------------------------------------------
if [ "$MODO" = "apache" ]; then
  if grep -q "SAL Estratégias de Marketing — configuração do servidor" "$RAIZ/.htaccess" 2>/dev/null; then
    echo ".htaccess: as regras da SAL já estão lá, não mexi."
  else
    { cat "$AQUI/htaccess-sal.txt"; echo; cat "$BK/htaccess.original"; } > "$RAIZ/.htaccess.novo"
    mv "$RAIZ/.htaccess.novo" "$RAIZ/.htaccess"
    echo ".htaccess: regras novas coladas antes do bloco do WordPress."
  fi
else
  cp -a "$AQUI/nginx-sal.conf" "$BK/nginx-sal.conf"
  echo
  echo ">>> FALTA UM PASSO MANUAL (nginx não usa .htaccess):"
  echo ">>> abra o CloudPanel → Sites → $DOMINIO → Vhost Editor e cole o"
  echo ">>> conteúdo de: $AQUI/nginx-sal.conf"
  echo ">>> dentro do bloco server { }, antes das locations existentes."
  echo ">>> (uma cópia ficou também em $BK/nginx-sal.conf)"
fi

# ---- desfazer --------------------------------------------------------------
cat > "$BK/desfazer.sh" <<DESFAZ
#!/bin/bash
# Volta o site exatamente como estava antes da implantação.
set -e
RAIZ="$RAIZ"
BK="$BK"
[ -s "\$BK/htaccess.original" ] && cp -a "\$BK/htaccess.original" "\$RAIZ/.htaccess" || true
while read -r nome; do rm -rf "\$RAIZ/\$nome"; done < "\$BK/itens-novos.txt"
for f in "\$BK/sobrescritos"/* ; do [ -e "\$f" ] && cp -a "\$f" "\$RAIZ/\$(basename "\$f")"; done
echo "pronto: arquivos restaurados. Se você colou regras no Vhost Editor do"
echo "CloudPanel, remova-as por lá também."
DESFAZ
chmod +x "$BK/desfazer.sh"

# ---- 5. conferir no ar -----------------------------------------------------
if [ "${SAL_PULAR_CHECAGEM:-0}" = "1" ]; then
  echo "(checagens puladas a pedido)"
else
  echo
  echo "== conferindo no ar =="
  home_ok=$(curl -sk --max-time 20 "https://$DOMINIO/" | grep -c 'Marketing na medida certa' || true)
  echo "home nova no ar ................ $( [ "$home_ok" -ge 1 ] && echo SIM || echo 'AINDA NÃO (no nginx é normal: falta o passo do Vhost Editor; depois dele, limpe o cache)' )"
  post=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/drive-to-store-como-funciona/")
  echo "post antigo do blog ............ HTTP $post $( [ "$post" = 200 ] && echo '(ok)' || echo '(esperava 200!)' )"
  red=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/servicos/gestao-de-trafego-pago/")
  echo "redirecionamento antigo ........ HTTP $red $( [ "$red" = 301 ] && echo '(ok)' || echo '(esperava 301 — no nginx vem com o passo do Vhost Editor)' )"
  ag=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "https://$DOMINIO/agenda/")
  echo "página /agenda/ ................ HTTP $ag $( [ "$ag" = 200 ] && echo '(ok)' || echo '(esperava 200)' )"
fi

echo
echo "== pronto =="
echo "se algo saiu errado:  bash $BK/desfazer.sh"
