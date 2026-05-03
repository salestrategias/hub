# SAL Hub

Sistema interno de gestão da **SAL Estratégias de Marketing**. Self-hosted em VPS Ubuntu 22.04, com integração ao Google Drive e Google Agenda da própria conta.

**Stack:** Next.js 14 (App Router) · TypeScript strict · PostgreSQL + Prisma · NextAuth v5 (Credentials + Google OAuth) · googleapis · Tailwind + shadcn/ui · Docker + Nginx.

---

## Módulos

| Módulo | Rota | Descrição |
|---|---|---|
| Dashboard | `/` | KPIs, receita 12m, distribuição por cliente, próximas entregas, agenda |
| CRM | `/clientes` | CRUD com tags livres, filtros, integração Drive, abas detalhadas |
| Editorial | `/editorial` | Calendário com sync ao Google Calendar quando status = AGENDADO |
| Projetos | `/projetos` | Kanban (Briefing → Entregue) com drag-and-drop |
| Tarefas | `/tarefas` | Lista com checklist, filtros, "Adicionar à agenda" |
| **Reuniões** | `/reunioes` | **Lista + detalhe estilo Notion: transcrição com timestamps + speakers, action items, capítulos, resumo IA** |
| **Notas** | `/notas` | **Bloco de notas estilo Obsidian: 3 colunas (pastas / lista / editor markdown), wikilinks, tags, auto-save** |
| **Mapas Mentais** | `/mapas` | **Canvas livre estilo Excalidraw: nós, conexões, sticky notes, exportação SVG, persistência em JSON** |
| Financeiro | `/financeiro` | PJ/PF, MRR, projeção 3m, gráfico receita vs despesa |
| Contratos | `/contratos` | Vencimentos, multa, reajuste, evento de aviso 30 dias antes |
| Drive | `/drive` | Navegador completo, busca, criar pasta, vincular a cliente |
| Agenda | `/agenda` | Calendário sincronizado com Google, criar/editar/deletar eventos |
| Relatórios | `/relatorios` | Redes Sociais · SEO · Tráfego Pago — exportação PDF cada |
| **MCP / Claude** | `/admin/mcp` | **Servidor MCP que conecta Claude Desktop/Code ao Hub para automação completa via linguagem natural** |

---

## 1. Setup do Google Cloud Console

> Necessário para o login com Google e para as integrações com Drive/Agenda.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e **crie um novo projeto**, ex: `sal-hub`.
2. Menu lateral → **APIs & Services → Enabled APIs** → habilite:
   - **Google Drive API**
   - **Google Calendar API**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (ou Internal se for Workspace)
   - App name: `SAL Hub`
   - User support email + Developer contact: seu email
   - **Scopes**: adicione `auth/userinfo.email`, `auth/userinfo.profile`, `auth/drive`, `auth/calendar`
   - **Test users**: adicione seu próprio email Google (até publicar o app)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `SAL Hub Web`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://hub.sal.com.br` (produção)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://hub.sal.com.br/api/auth/callback/google`
5. Copie `Client ID` e `Client Secret` para o `.env`.

---

## 2. Setup local de desenvolvimento

```bash
git clone <seu-repo> sal-hub
cd sal-hub

cp .env.example .env
# Edite .env com:
#   - GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET
#   - NEXTAUTH_SECRET (openssl rand -base64 32)

# Subir só o banco em Docker:
docker compose up -d db

npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Acesse `http://localhost:3000` → login `admin@sal.com.br` / `sal@2024`.

> Para que o módulo Drive/Agenda funcione, **clique em "Entrar com Google"** ao menos uma vez para conceder os escopos.

---

## 3. Deploy em VPS Ubuntu 22.04

### 3.1 Preparação do servidor

```bash
# Como root ou usuário com sudo:
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git ufw

# Firewall:
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Aponte o DNS A do seu domínio (ex: hub.sal.com.br) para o IP do VPS antes de continuar.
```

### 3.2 Clone e build

```bash
mkdir -p /opt/sal-hub && cd /opt/sal-hub
git clone <seu-repo> .

cp .env.example .env
nano .env
# Configure:
#   DATABASE_URL=postgresql://sal:SENHA_FORTE@db:5432/salhub?schema=public
#   POSTGRES_PASSWORD=SENHA_FORTE   (mesma senha)
#   NEXTAUTH_URL=https://hub.sal.com.br
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Build e subir:
docker compose up -d --build

# Rodar migrations + seed (apenas na primeira vez):
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run prisma:seed
```

### 3.3 SSL com Certbot (Let's Encrypt)

```bash
# Para o nginx temporariamente:
docker compose stop nginx

# Instale certbot host:
apt install -y certbot

# Gere o certificado (modo standalone usa porta 80):
certbot certonly --standalone -d hub.sal.com.br --agree-tos -m voce@sal.com.br --no-eff-email

# Os certificados ficam em /etc/letsencrypt/live/hub.sal.com.br/
# Mapeie no docker-compose.yml: volume já está apontando para ./certbot/conf

# Copie:
mkdir -p ./certbot/conf
cp -L -r /etc/letsencrypt/live/hub.sal.com.br ./certbot/conf/live/
cp -L -r /etc/letsencrypt/archive/hub.sal.com.br ./certbot/conf/archive/

# Edite nginx.conf — descomente o bloco HTTPS (server :443).
docker compose up -d nginx

# Renovação automática (cron):
echo "0 3 * * * certbot renew --quiet --post-hook 'cd /opt/sal-hub && docker compose restart nginx'" | crontab -
```

### 3.4 Verificação

- Abra `https://hub.sal.com.br` → deve carregar a tela de login
- Login com `admin@sal.com.br` / `sal@2024`
- **Importante:** clique em "Entrar com Google" para liberar Drive/Agenda

---

## 4. Comandos úteis

```bash
# Logs:
docker compose logs -f app
docker compose logs -f nginx

# Acessar o banco:
docker compose exec db psql -U sal -d salhub

# Re-seedar (CUIDADO - destrutivo se tiver dados):
docker compose exec app npm run prisma:seed

# Backup do banco:
docker compose exec db pg_dump -U sal salhub > backup-$(date +%F).sql

# Restore:
cat backup.sql | docker compose exec -T db psql -U sal -d salhub

# Atualizar app:
git pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

---

## 5. Troubleshooting

| Problema | Solução |
|---|---|
| **"Conta Google não conectada"** ao usar Drive/Agenda | Saia e faça login com "Entrar com Google" — o login por senha não concede escopos do Drive/Calendar |
| **Token Google expirado / 401** | A app faz refresh automático. Se persistir, deslogue e faça login novamente com Google |
| **Migrations falham no container** | `docker compose exec app npx prisma migrate deploy` manualmente. Verifique o `DATABASE_URL` |
| **Nginx 502 Bad Gateway** | App ainda iniciando ou crashou. `docker compose logs app` |
| **"redirect_uri_mismatch" ao logar com Google** | Adicione exatamente `https://hub.sal.com.br/api/auth/callback/google` em Authorized redirect URIs do Cloud Console |
| **Drive/Agenda em branco mesmo após login Google** | OAuth consent screen pode estar em modo "Testing" — adicione seu email em "Test users" ou publique o app |
| **PDFs em branco / erro ao exportar** | `@react-pdf/renderer` exige Node 20+ no container — confirme `node:20-alpine` no Dockerfile |
| **Hora errada nos eventos** | Confirme `TZ=America/Sao_Paulo` no `.env` e que o container db também tem essa env |

---

## 6. Estrutura de arquivos

```
sal-hub/
├── prisma/
│   ├── schema.prisma          # Schema completo (todos os módulos)
│   └── seed.ts                # Clientes SAL pré-cadastrados
├── src/
│   ├── app/
│   │   ├── (app)/             # Rotas autenticadas com sidebar
│   │   ├── api/               # API routes (REST padrão)
│   │   ├── login/             # Tela de login
│   │   └── layout.tsx
│   ├── components/            # UI + componentes de módulo
│   │   └── ui/                # shadcn/ui primitives
│   ├── lib/
│   │   ├── db.ts              # Singleton Prisma
│   │   ├── google-auth.ts     # OAuth2 client com refresh
│   │   ├── google-drive.ts    # Helpers Drive
│   │   ├── google-calendar.ts # Helpers Calendar
│   │   ├── pdf.tsx            # Estilos compartilhados de PDF
│   │   ├── schemas.ts         # Zod schemas de todos os models
│   │   └── utils.ts           # cn(), formatBRL, formatDate...
│   ├── auth.ts                # Configuração NextAuth v5
│   ├── auth.config.ts         # Edge-safe config (middleware)
│   └── middleware.ts          # Proteção de rotas
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .env.example
```

---

## 7. Conectar Claude Desktop / Claude Code ao SAL Hub (MCP)

O SAL Hub é também um **servidor Model Context Protocol (MCP)** — Claude pode ler e escrever em todos os módulos via linguagem natural, autenticando com bearer token.

### Custo
- **Servidor MCP**: 100% gratuito, roda no mesmo VPS.
- **Uso do Claude**: incluído na sua assinatura Claude Pro/Max. Sem assinatura, vai pela API direta (~US$ 5–20/mês de uso pesado).

### 7.1 Gerar token (com sub-escopos)

1. Faça login como ADMIN no Hub
2. Acesse **Administração → Claude / MCP** na sidebar
3. Clique em **"Novo token"**, dê um nome (ex: "Claude Desktop pessoal")
4. **Escolha os escopos** — cada token pode ter permissões limitadas:
   - **Acesso total** (`*`): todas as 31 tools (default)
   - **Somente leitura**: apenas `:read` em todos os módulos — útil para chats de consulta
   - **Sem financeiro**: tudo exceto financeiro/contratos — automações operacionais sem risco
   - **Produtividade**: Reuniões + Notas + Tarefas + Editorial + Busca — sem CRM nem dinheiro
   - **Customizado**: liga/desliga `:read` e `:write` por módulo individualmente
5. **Copie o token imediatamente** — ele só aparece uma vez

### 7.2 Conectar Claude Desktop

Settings → Developer → Edit Config, e adicione:

```json
{
  "mcpServers": {
    "sal-hub": {
      "url": "https://hub.sal.com.br/api/mcp",
      "headers": {
        "Authorization": "Bearer salhub_SEU_TOKEN_AQUI"
      }
    }
  }
}
```

Reinicie o Claude Desktop. Em **Settings → Connectors** confirme que `sal-hub` aparece como conectado.

### 7.3 Conectar Claude Code

```bash
claude mcp add sal-hub --transport http \
  https://hub.sal.com.br/api/mcp \
  --header "Authorization: Bearer salhub_SEU_TOKEN_AQUI"

claude mcp list   # confirma conexão
```

### 7.4 Tools disponíveis (~31)

| Módulo | Tools |
|---|---|
| Clientes | `cliente_listar`, `cliente_buscar`, `cliente_criar`, `cliente_atualizar`, `cliente_excluir` |
| Reuniões | `reuniao_listar`, `reuniao_buscar`, `reuniao_criar`, `reuniao_adicionar_bloco`, `reuniao_adicionar_action`, `reuniao_atualizar`, `reuniao_action_toggle` |
| Notas | `nota_listar`, `nota_buscar`, `nota_criar`, `nota_atualizar`, `nota_anexar`, `nota_excluir` |
| Tarefas | `tarefa_listar`, `tarefa_criar`, `tarefa_atualizar`, `tarefa_excluir` |
| Editorial | `post_listar`, `post_criar`, `post_atualizar` |
| Projetos | `projeto_listar`, `projeto_criar`, `projeto_mover` |
| Contratos | `contrato_listar`, `contrato_criar` |
| Financeiro | `lancamento_listar`, `lancamento_criar`, `metricas_financeiras` |
| Outros | `agenda_proximos_eventos`, `buscar_tudo` |

A lista detalhada com descrições e exemplos de uso aparece em **/admin/mcp** dentro do Hub.

### 7.5 Exemplos de comandos no Claude

> "Liste as reuniões da Pipeline Services dessa semana, pegue a transcrição da última, gere um resumo em 5 bullets e crie os action items extraídos. Salve o resumo no campo resumoIA."

> "Para cada cliente ativo, calcule o LTV até hoje somando os lançamentos RECEITA, liste os contratos vencendo nos próximos 60 dias e crie uma nota com o resumo na pasta Relatórios."

> "Vou ter reunião com a Pipeline. Busque tudo que tenha menção a Pipeline nos últimos 3 meses (notas, reuniões, tarefas) e me dê um briefing executivo de 1 página."

### 7.6 Catálogo de escopos

Convenção: `<recurso>:<acao>` onde acao ∈ {`read`, `write`}.

| Recurso | Read | Write |
|---|---|---|
| `clientes` | `cliente_listar`, `cliente_buscar` | `cliente_criar`, `cliente_atualizar`, `cliente_excluir` |
| `reunioes` | `reuniao_listar`, `reuniao_buscar` | `reuniao_criar`, `reuniao_adicionar_bloco`, `reuniao_adicionar_action`, `reuniao_atualizar`, `reuniao_action_toggle` |
| `notas` | `nota_listar`, `nota_buscar` | `nota_criar`, `nota_atualizar`, `nota_anexar`, `nota_excluir` |
| `tarefas` | `tarefa_listar` | `tarefa_criar`, `tarefa_atualizar`, `tarefa_excluir` |
| `editorial` | `post_listar` | `post_criar`, `post_atualizar` |
| `projetos` | `projeto_listar` | `projeto_criar`, `projeto_mover` |
| `contratos` | `contrato_listar` | `contrato_criar` |
| `financeiro` | `lancamento_listar`, `metricas_financeiras` | `lancamento_criar` |
| `agenda` | `agenda_proximos_eventos` | (sem write) |
| `busca` | `buscar_tudo` | (sem write) |

O wildcard `*` concede acesso total. Tokens criados antes da feature de escopos (com lista vazia) também são tratados como `*` por compatibilidade.

### 7.7 Segurança

- **Tokens hash**: nunca armazenamos o token bruto — guardamos apenas o SHA-256
- **Revogação imediata**: clicar em revogar invalida o token em < 1s (próxima chamada falha)
- **Edição de escopos a quente**: alterar escopos de um token ativo passa a valer na próxima chamada, sem precisar regenerar
- **Filtragem em `tools/list`**: o Claude só **vê** as tools que o token pode usar (não tenta nem chamar tools sem permissão)
- **Validação dupla em `tools/call`**: mesmo se Claude tentar chamar uma tool fora do escopo, o handler bloqueia
- **Auditoria**: cada token rastreia `ultimoUso` e `totalChamadas`
- **Apenas ADMIN** pode criar/revogar/editar tokens MCP
- **Nunca cometa o token em git**. Trate como senha.

---

## 8. Logs de atividade da conta

Cada usuário tem rastreabilidade dos eventos de segurança e mudanças relevantes da conta — visível em **/perfil** na seção "Atividade da conta".

### O que é registrado
| Evento | Quando dispara | Campos extras (`meta`) |
|---|---|---|
| `LOGIN_OK` | Login bem-sucedido (credentials ou Google) | `provider` |
| `LOGIN_FALHOU` | Senha incorreta em login com credentials | `provider` |
| `MUDANCA_SENHA` | Usuário trocou a própria senha | — |
| `MUDANCA_PERFIL` | Nome ou foto alterados | `campos`, `fotoAtualizada` |
| `TOKEN_MCP_CRIADO` | Admin gerou novo token | `tokenId`, `nome`, `escopos` |
| `TOKEN_MCP_REVOGADO` | Admin revogou token | `tokenId`, `nome` |
| `TOKEN_MCP_ESCOPOS_ALTERADOS` | Admin editou escopos | `tokenId`, `escopos` |
| `GOOGLE_CONECTADO` | Primeiro login Google ou refresh dos escopos | — |

Cada registro guarda **IP** (resolvido via X-Forwarded-For atrás do Nginx) e **User-Agent** parseado em dispositivo / navegador / OS.

### Privacidade
- Logs ficam visíveis **só para o próprio usuário** em `/perfil`
- Apenas ADMIN pode consultar logs de outros via Prisma Studio
- Logging é **fire-and-forget**: se falhar não derruba a request
- Política de retenção opcional: `DELETE FROM "AtividadeConta" WHERE "createdAt" < NOW() - INTERVAL '90 days';`

---

## 9. Backup automatizado do banco

Sistema completo: pg_dump + gzip + rotação + opcional upload off-site para S3-compatible.

### 9.1 Configuração inicial (uma vez)

```bash
cd /opt/sal-hub
chmod +x scripts/*.sh

# Atualizar app pra montar volume de backups
docker compose down && docker compose up -d --build

# Instalar cron diário às 3h
./scripts/setup-cron.sh
```

Verifique em **/admin/backups** que o status do volume aparece como "Volume montado".

### 9.2 Como funciona

`scripts/backup.sh`:
- Roda `pg_dump --clean --if-exists --no-owner --no-privileges` dentro do container `db`
- Pipe direto para `gzip -9` no host (não consome espaço dentro do container)
- Salva em `/opt/sal-hub/backups/salhub-YYYYMMDD-HHMMSS.sql.gz`
- **Rotação**: mantém últimos 30 (configurável com `BACKUP_KEEP=N`)
- Tamanho típico: 1–5 MB para banco de agência pequena (compressão ~10×)

### 9.3 Operações comuns

```bash
# Backup manual:
./scripts/backup.sh

# Restaurar (pede confirmação):
./scripts/restore.sh backups/salhub-YYYYMMDD-HHMMSS.sql.gz
docker compose restart app

# Verificar cron:
crontab -l | grep SAL_HUB
tail -f backups/cron.log
```

### 9.4 Upload off-site para S3 (opcional, recomendado)

Backups locais protegem contra erro humano, mas **não contra perda do VPS**. Configure upload paralelo:

```bash
apt install -y awscli

# Adicione no .env:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=sal-hub-backups
S3_PREFIX=daily
# Para Backblaze B2 / Wasabi / Cloudflare R2:
S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com
```

`backup.sh` detecta as variáveis e envia automaticamente após o backup local concluir. **Custo típico Backblaze B2: ~US$ 0,005/GB/mês** (5 GB = US$ 0,03/mês).

### 9.5 UI em `/admin/backups`

A página admin mostra:
- KPIs de backups disponíveis, espaço usado, último backup com tempo relativo
- Alerta automático se o último backup tem mais de 30h (cron pode ter falhado)
- Tabela cronológica dos arquivos com badges de frescor (<30h verde, <7d amarelo, mais antigo cinza)
- Abas com instruções copy-paste para cada operação

### 9.6 Segurança

- Pasta `backups/` é montada no container app **read-only** — UI não pode deletar nem corromper
- Apenas ADMIN acessa `/admin/backups` e a API
- Os arquivos `.sql.gz` contêm **dados sensíveis em texto** (incluindo hashes bcrypt de senha). Trate como confidencial; criptografe antes de subir off-site se quiser camada extra (`gpg --symmetric`)
- `backups/` está no `.gitignore`

---

## 10. Próximos passos sugeridos

- [ ] Conectar e-mail transacional (Resend/SendGrid) para alertas de vencimento e reset de senha
- [ ] Rate limiting no MCP (Upstash Redis ou middleware Nginx)
- [ ] Webhook do Google Calendar para sync bidirecional
- [ ] Importar Drive Picker oficial em vez do search interno
- [ ] Multi-usuário com permissões granulares por módulo
- [ ] Modo PWA para acesso mobile
- [ ] 2FA via TOTP para o admin
