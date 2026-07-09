#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SAL Blog — Provisiona a automação diária de artigos no VPS do Hub.
# Rodar UMA VEZ como root. Idempotente.
#
#   curl -fsSL <raw-url>/blog/vps/setup-blog-vps.sh -o setup-blog.sh
#   sudo bash setup-blog.sh
#
# O que faz:
#   1. Cria usuário dedicado `salblog` (sem sudo)
#   2. Instala Node 20 (se ausente) — gerador de capas
#   3. Instala Claude Code CLI para o salblog
#   4. Gera deploy key SSH (você adiciona no GitHub com write)
#   5. Clona o repo Hub em /home/salblog/hub
#   6. Cria templates de credenciais (token Claude + WP)
#   7. Agenda o cron diário (08:00 America/Sao_Paulo)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_SSH="${REPO_SSH:-git@github.com:salestrategias/hub.git}"
USUARIO=salblog
HOME_DIR=/home/$USUARIO
HUB_DIR=$HOME_DIR/hub

log() { echo -e "\033[0;34m▸\033[0m $*"; }
ok()  { echo -e "\033[0;32m✓\033[0m $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Execute como root (sudo)"; exit 1; }

# 1. Usuário dedicado
if ! id "$USUARIO" >/dev/null 2>&1; then
  log "Criando usuário $USUARIO..."
  useradd -m -s /bin/bash "$USUARIO"
fi
ok "Usuário $USUARIO ok"

# 2. Node 20+
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  log "Instalando Node 20 (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
fi
ok "Node $(node -v)"

# 3. Claude Code CLI (instala no home do salblog)
if [ ! -x "$HOME_DIR/.local/bin/claude" ]; then
  log "Instalando Claude Code CLI para $USUARIO..."
  sudo -u "$USUARIO" bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
fi
ok "Claude Code: $(sudo -u $USUARIO $HOME_DIR/.local/bin/claude --version 2>/dev/null || echo instalado)"

# 4. Deploy key
KEY=$HOME_DIR/.ssh/blog_deploy
if [ ! -f "$KEY" ]; then
  log "Gerando deploy key..."
  sudo -u "$USUARIO" mkdir -p "$HOME_DIR/.ssh"
  sudo -u "$USUARIO" ssh-keygen -t ed25519 -N '' -f "$KEY" -C "sal-blog-vps" >/dev/null
  sudo -u "$USUARIO" bash -c "cat >> $HOME_DIR/.ssh/config" <<EOF
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
fi
ok "Deploy key pronta"

# 5. Clone do repo
if [ ! -d "$HUB_DIR/.git" ]; then
  log "Clonando o repo (se falhar, adicione a deploy key no GitHub e rode de novo)..."
  sudo -u "$USUARIO" git clone "$REPO_SSH" "$HUB_DIR" || {
    echo ""
    echo "⚠ Clone falhou. Adicione esta chave em GitHub → repo hub → Settings → Deploy keys (MARCAR write access):"
    echo ""
    cat "$KEY.pub"
    echo ""
    echo "Depois rode este script de novo."
    exit 1
  }
  sudo -u "$USUARIO" git -C "$HUB_DIR" config user.name "SAL Blog Bot"
  sudo -u "$USUARIO" git -C "$HUB_DIR" config user.email "blog-bot@salestrategias.com.br"
fi
ok "Repo em $HUB_DIR"

# 6. Dependências do gerador de capas
log "Instalando deps do gerador de capas..."
sudo -u "$USUARIO" bash -c "cd $HUB_DIR/blog/capa && npm install --no-audit --no-fund --silent"
ok "Gerador de capas pronto"

# 6b. Allowlist de permissões do agente (sem --dangerously-skip-permissions)
sudo -u "$USUARIO" mkdir -p "$HOME_DIR/.claude"
sudo -u "$USUARIO" bash -c "cat > $HOME_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": [
      "WebSearch",
      "WebFetch(*)",
      "Bash(curl *)",
      "Bash(node *)",
      "Bash(mkdir *)",
      "Bash(ls *)",
      "Bash(base64 *)"
    ],
    "deny": [
      "Bash(git push*)",
      "Bash(sudo *)",
      "Bash(rm -rf *)"
    ]
  }
}
EOF
ok "Allowlist de permissões do agente criada"

# 7. Templates de credenciais
if [ ! -f "$HOME_DIR/blog-automacao.env" ]; then
  sudo -u "$USUARIO" bash -c "cat > $HOME_DIR/blog-automacao.env" <<'EOF'
# Token da assinatura Claude (Max). Gerar na SUA máquina com: claude setup-token
CLAUDE_CODE_OAUTH_TOKEN=
EOF
  chmod 600 "$HOME_DIR/blog-automacao.env"
fi
if [ ! -f "$HUB_DIR/blog/.env" ]; then
  sudo -u "$USUARIO" cp "$HUB_DIR/blog/.env.exemplo" "$HUB_DIR/blog/.env"
  chmod 600 "$HUB_DIR/blog/.env"
fi
ok "Templates de credenciais criados (preencher!)"

# 8. Cron diário — 08:00 em America/Sao_Paulo
chmod +x "$HUB_DIR/blog/vps/rodar-artigo.sh"
TZ_ATUAL=$(timedatectl show -p Timezone --value 2>/dev/null || echo UTC)
if [ "$TZ_ATUAL" = "America/Sao_Paulo" ]; then HORA=8; else HORA=11; fi
CRON_LINHA="0 $HORA * * * $HUB_DIR/blog/vps/rodar-artigo.sh # SAL_BLOG_DIARIO"
# crontab -l falha se o usuário ainda não tem crontab; com pipefail isso mataria o script
CRON_ATUAL=$(sudo -u "$USUARIO" crontab -l 2>/dev/null | grep -v SAL_BLOG_DIARIO || true)
printf '%s\n%s\n' "$CRON_ATUAL" "$CRON_LINHA" | sed '/^$/d' | sudo -u "$USUARIO" crontab -
ok "Cron agendado: $CRON_LINHA (TZ do servidor: $TZ_ATUAL)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Setup concluído. Faltam 3 passos manuais:"
echo "  1. Na sua máquina: claude setup-token → colar em $HOME_DIR/blog-automacao.env"
echo "  2. Preencher $HUB_DIR/blog/.env (WP_USER + WP_APP_PASSWORD)"
echo "  3. Testar: sudo -u $USUARIO $HUB_DIR/blog/vps/rodar-artigo.sh"
echo "     (acompanhar: tail -f $HOME_DIR/logs/blog-\$(date +%F).log)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
