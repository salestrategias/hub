#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Hub — Provisionamento completo de VPS Hostinger (Ubuntu 22.04+)
#
# Roda UMA VEZ no VPS recém-criado. Faz:
#   1. Atualiza pacotes
#   2. Instala Docker, Compose, ufw, certbot, git
#   3. Configura firewall (SSH, 80, 443)
#   4. Cria usuário não-root para o app (opcional)
#   5. Clona o repo em /opt/sal-hub
#   6. Gera .env com NEXTAUTH_SECRET aleatório
#   7. Sobe os containers
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/sal-hub/main/scripts/setup-vps.sh -o setup.sh
#   chmod +x setup.sh
#   sudo bash setup.sh
#
# Variáveis de ambiente aceitas:
#   REPO_URL    URL do git (default: prompt interativo)
#   APP_DIR     Onde clonar (default: /opt/sal-hub)
#   DOMINIO     Domínio (ex: hub.sal.com.br) — usado em NEXTAUTH_URL
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

# ─── Verificações iniciais ───────────────────────────────────────
[ "$(id -u)" -eq 0 ] || fail "Execute como root (use sudo)"
. /etc/os-release 2>/dev/null || fail "Não detectei o OS"
case "$ID" in
  ubuntu|debian) ;;
  *) warn "OS '$ID' não testado. Continuando assim mesmo." ;;
esac

# ─── Inputs ──────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/sal-hub}"
REPO_URL="${REPO_URL:-}"
DOMINIO="${DOMINIO:-}"

if [ -z "$REPO_URL" ]; then
  read -r -p "URL do repositório git (https://github.com/seuuser/sal-hub.git): " REPO_URL
fi
if [ -z "$DOMINIO" ]; then
  read -r -p "Domínio (ex: hub.sal.com.br) [pode deixar vazio para usar IP]: " DOMINIO
fi

[ -n "$REPO_URL" ] || fail "REPO_URL é obrigatório"

# ─── 1. Pacotes do sistema ───────────────────────────────────────
log "Atualizando apt..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "Instalando dependências..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release ufw certbot git openssl

# ─── 2. Docker ───────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker (engine + compose plugin)..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') instalado"
else
  ok "Docker já está instalado"
fi

# ─── 3. Firewall ─────────────────────────────────────────────────
log "Configurando firewall (UFW)..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ok "Firewall ativo: SSH, 80, 443"

# ─── 4. Clone do repo ────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  log "Clonando $REPO_URL em $APP_DIR..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Repo já existe em $APP_DIR — atualizando..."
  git -C "$APP_DIR" pull
fi
cd "$APP_DIR"
chmod +x scripts/*.sh 2>/dev/null || true

# ─── 5. .env ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
  log "Gerando .env inicial..."
  POSTGRES_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 24)"
  NEXTAUTH_SECRET="$(openssl rand -base64 32)"

  if [ -n "$DOMINIO" ]; then
    NEXTAUTH_URL="https://$DOMINIO"
  else
    IP="$(curl -s -4 https://api.ipify.org || echo '127.0.0.1')"
    NEXTAUTH_URL="http://$IP"
  fi

  cat > .env <<EOF
# Gerado por setup-vps.sh em $(date -Iseconds)

# ─── Banco ───────────────────────────────────────────────────
POSTGRES_USER=sal
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=salhub
DATABASE_URL=postgresql://sal:$POSTGRES_PASSWORD@db:5432/salhub?schema=public

# ─── NextAuth ────────────────────────────────────────────────
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=$NEXTAUTH_URL

# ─── Google OAuth (preencha após criar Client ID no Cloud Console) ─
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Misc ────────────────────────────────────────────────────
NODE_ENV=production
TZ=America/Sao_Paulo
EOF
  chmod 600 .env
  ok ".env criado (POSTGRES_PASSWORD e NEXTAUTH_SECRET aleatórios)"
  warn "Edite o .env para preencher GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET"
  warn "  $APP_DIR/.env"
else
  ok ".env já existe — preservado"
fi

# ─── 6. SSL (se domínio fornecido) ──────────────────────────────
if [ -n "$DOMINIO" ]; then
  if [ ! -d "/etc/letsencrypt/live/$DOMINIO" ]; then
    log "Emitindo certificado SSL para $DOMINIO via Certbot..."
    warn "Aponte o DNS A do $DOMINIO para $(curl -s -4 https://api.ipify.org) ANTES de continuar."
    read -r -p "DNS já está apontando? [s/N] " RESP
    if [[ "$RESP" =~ ^[Ss]$ ]]; then
      certbot certonly --standalone -d "$DOMINIO" \
        --agree-tos --register-unsafely-without-email --non-interactive || warn "Certbot falhou — reemita depois com: certbot certonly --standalone -d $DOMINIO"
      mkdir -p ./certbot/conf/live ./certbot/conf/archive
      cp -L -r "/etc/letsencrypt/live/$DOMINIO" ./certbot/conf/live/ 2>/dev/null || true
      cp -L -r "/etc/letsencrypt/archive/$DOMINIO" ./certbot/conf/archive/ 2>/dev/null || true

      # Atualiza nginx.conf para o domínio
      sed -i "s/hub\.sal\.com\.br/$DOMINIO/g" nginx.conf

      # Renovação automática
      ( crontab -l 2>/dev/null | grep -v "SAL_HUB_CERT" ; echo "0 4 1 * * certbot renew --quiet --post-hook 'cd $APP_DIR && docker compose restart nginx' # SAL_HUB_CERT" ) | crontab -
      ok "SSL emitido + renovação mensal agendada"
    else
      warn "Pulando SSL. Reemita depois: certbot certonly --standalone -d $DOMINIO"
    fi
  else
    ok "Certificado SSL já existe para $DOMINIO"
  fi
fi

# ─── 7. Pasta de backups + cron ──────────────────────────────────
mkdir -p backups
log "Instalando cron diário de backup às 3h..."
./scripts/setup-cron.sh

# ─── 8. Build + subir containers ─────────────────────────────────
log "Buildando e subindo containers..."
docker compose pull db nginx 2>/dev/null || true
docker compose up -d --build

log "Aguardando banco ficar saudável..."
for i in $(seq 1 30); do
  if docker compose ps db --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
    break
  fi
  sleep 2
done

log "Rodando seed inicial..."
docker compose exec -T app npm run prisma:seed || warn "Seed falhou ou já foi executado"

# ─── Resumo final ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
ok "SAL Hub instalado com sucesso!"
echo ""
if [ -n "$DOMINIO" ]; then
  echo "   URL:    https://$DOMINIO"
else
  echo "   URL:    http://$(curl -s -4 https://api.ipify.org)"
fi
echo "   Login:  admin@sal.com.br"
echo "   Senha:  sal@2024 (TROQUE imediatamente em /perfil)"
echo ""
echo -e "${YELLOW}Próximos passos:${RESET}"
echo "  1. Editar $APP_DIR/.env com GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET"
echo "     (criar no console.cloud.google.com — ver README seção 1)"
echo "  2. Reiniciar: cd $APP_DIR && docker compose restart app"
echo "  3. Acessar e fazer login"
echo "  4. Trocar senha em /perfil"
echo "  5. Configurar token MCP em /admin/mcp"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
