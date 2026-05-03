# Deploy do SAL Hub na Hostinger VPS

Guia direto, copy-paste. Tempo total estimado: **20–30 minutos**.

## Pré-requisitos

- ✅ VPS Hostinger Ubuntu 22.04+ (qualquer plano com 2 GB RAM ou mais)
- ✅ Domínio com DNS configurável (ex: `hub.sal.com.br`)
- ✅ Repositório do projeto no GitHub/GitLab/Bitbucket (público ou com deploy key)

---

## Passo 1 — Criar a VPS na Hostinger

1. Painel Hostinger → **VPS → Comprar/Criar**
2. Sistema operacional: **Ubuntu 22.04 LTS** (limpo, sem painel)
3. Após criar, anote:
   - **IP público**
   - **Senha root** (ou suba sua chave SSH)

## Passo 2 — Apontar o domínio

Em **Hostinger → Domínios → DNS** (ou no provedor de DNS que você usa):

| Tipo | Nome | Valor |
|------|------|-------|
| A | `hub` (ou `@` para raiz) | `IP_DA_VPS` |
| A | `www.hub` (opcional) | `IP_DA_VPS` |

Aguarde propagação (geralmente 5–15 min). Confira com:

```bash
dig +short hub.sal.com.br
```

Deve retornar o IP da VPS.

## Passo 3 — Criar credenciais Google OAuth

> Pode pular se ainda não tem. Drive/Agenda não funcionarão até preencher, mas o resto do sistema sim.

1. [console.cloud.google.com](https://console.cloud.google.com) → criar projeto **sal-hub**
2. **APIs & Services → Enable APIs** → habilitar **Google Drive API** e **Google Calendar API**
3. **OAuth consent screen** → External, name "SAL Hub", adicionar scopes `userinfo.email`, `userinfo.profile`, `auth/drive`, `auth/calendar`. Adicionar seu email em "Test users".
4. **Credentials → Create OAuth Client ID** (Web app):
   - **Authorized redirect URIs**: `https://hub.sal.com.br/api/auth/callback/google`
5. Anotar **Client ID** e **Client Secret**

## Passo 4 — Setup automatizado da VPS

SSH na VPS:

```bash
ssh root@IP_DA_VPS
```

Rode o setup automático (substitua a URL do repo):

```bash
curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/sal-hub/main/scripts/setup-vps.sh -o setup.sh
chmod +x setup.sh
DOMINIO=hub.sal.com.br REPO_URL=https://github.com/SEU_USUARIO/sal-hub.git bash setup.sh
```

O script:
- ✅ Instala Docker + Compose + Certbot + UFW
- ✅ Configura firewall (SSH, 80, 443)
- ✅ Clona o repo em `/opt/sal-hub`
- ✅ Gera `.env` com `POSTGRES_PASSWORD` e `NEXTAUTH_SECRET` aleatórios
- ✅ Emite certificado SSL Let's Encrypt
- ✅ Configura cron diário de backup
- ✅ Builda e sobe os containers
- ✅ Roda seed inicial (admin@sal.com.br / sal@2024 + 7 clientes SAL)

Tempo: **~10 minutos** (build do Next.js leva metade desse tempo).

## Passo 5 — Adicionar credenciais Google

Editar o `.env` para colocar as credenciais Google que você gerou no Passo 3:

```bash
cd /opt/sal-hub
nano .env
```

Preencher:
```bash
GOOGLE_CLIENT_ID=...obtido-do-google
GOOGLE_CLIENT_SECRET=...obtido-do-google
```

Reiniciar o app:
```bash
docker compose restart app
```

## Passo 6 — Primeiro acesso

Abrir `https://hub.sal.com.br` no navegador.

1. Login: `admin@sal.com.br` / `sal@2024`
2. Ir em **Meu perfil** (canto superior direito) → **trocar a senha imediatamente**
3. Voltar e clicar em **"Entrar com Google"** — uma vez — para conceder escopos do Drive e Agenda
4. Sidebar → **Administração → Claude / MCP** → **Novo token** para conectar Claude Desktop

## Passo 7 — Conectar Claude Desktop ao MCP

1. No Hub, vá em `/admin/mcp`, clique **"Novo token"**, copie o token
2. No seu computador, em **Claude Desktop → Settings → Developer → Edit Config**:

```json
{
  "mcpServers": {
    "sal-hub": {
      "url": "https://hub.sal.com.br/api/mcp",
      "headers": {
        "Authorization": "Bearer salhub_seu_token_aqui"
      }
    }
  }
}
```

3. Reinicie o Claude Desktop. Pergunte *"liste os clientes ativos do SAL Hub"* — se voltar dados, está conectado.

---

## Comandos do dia-a-dia

```bash
cd /opt/sal-hub

# Atualizar código (puxa do git, builda, reinicia, faz backup automático antes)
./scripts/deploy.sh

# Ver logs em tempo real
docker compose logs -f app

# Restart manual
docker compose restart app

# Backup manual
./scripts/backup.sh

# Restaurar backup
./scripts/restore.sh backups/salhub-YYYYMMDD-HHMMSS.sql.gz
docker compose restart app

# Acessar o banco direto
docker compose exec db psql -U sal -d salhub
```

---

## Troubleshooting

### Erro 502 Bad Gateway no Nginx

Container `app` ainda está startando ou crashou. Cheque:
```bash
docker compose logs app --tail=100
```

### "Error: Migrate Engine not found"

Reconstrua o container — Prisma client precisa ser gerado:
```bash
docker compose build --no-cache app
docker compose up -d app
```

### Certificado SSL expirou

```bash
certbot renew
docker compose restart nginx
```

### Banco corrompido / preciso voltar pra estado anterior

```bash
ls backups/                                       # liste backups disponíveis
./scripts/restore.sh backups/salhub-XXXX.sql.gz   # restaure um
docker compose restart app
```

### Quero acessar o Postgres com Prisma Studio do meu laptop

Abra um túnel SSH:
```bash
ssh -L 5432:localhost:5432 root@SEU_IP
# E descomente as portas em docker-compose.yml > db.ports
```

### Limpar cache de imagens Docker (recuperar disco)

```bash
docker image prune -a -f
docker volume prune -f  # CUIDADO: não rode isso, apaga o volume do Postgres
```

---

## Custos típicos na Hostinger

| Item | Valor |
|---|---|
| VPS (KVM 2, 2 GB RAM, 50 GB SSD) | ~R$ 30/mês |
| Domínio `.com.br` | ~R$ 40/ano |
| SSL Let's Encrypt | grátis |
| Backblaze B2 (5 GB de backups off-site, opcional) | ~R$ 0,10/mês |
| Claude Max (você já tem) | — |
| **Total** | **~R$ 30/mês** |

Comparado a SaaS equivalente (Notion + Asana + ferramenta de transcrição + reporting): **R$ 800–2.000/mês**.

---

## Rollback rápido

Se um deploy quebrar tudo:

```bash
cd /opt/sal-hub
git log --oneline -10                # ver commits recentes
git reset --hard <hash_anterior>     # volta o código
./scripts/restore.sh backups/...     # opcional: restaura banco
docker compose up -d --build app
```

`./scripts/deploy.sh` já faz **backup automático antes de cada deploy**, então você sempre tem ponto de restauração.

---

## Próximos passos (opcionais)

- [ ] Configurar upload S3 dos backups (seção 9.5 do README)
- [ ] Conectar SMTP para alertas de vencimento de contrato
- [ ] Adicionar 2FA para o admin
- [ ] Configurar monitoring externo (UptimeRobot grátis, ping a cada 5min)
