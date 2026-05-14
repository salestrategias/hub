# SAL Hub — Backlog

Lista viva de tarefas pendentes e próximas features. Ordenado por
prioridade conforme conversas com Marcelo. Quando uma tarefa for
concluída, mover pra `## Concluído` no fim com a data.

> **Para Claude**: ao iniciar uma nova sessão, ler este arquivo pra
> entender o estado do roadmap. Marcelo pode pedir "vamos pra próxima"
> sem especificar — pega a primeira da lista de "Em espera".

---

## 🟡 Em espera (técnica pronta, falta ação externa)

### Configurar Resend pra notificações por email
**Status:** código 100% pronto, falta config externa
**O que falta:**
1. Marcelo cria conta em [resend.com](https://resend.com) (free 100/dia)
2. Adiciona domínio `salestrategias.com.br` em **Domains → Add Domain**
3. Cadastra os 4-5 DNS records (SPF, DKIM, etc) no provedor (Registro.br ou Cloudflare)
4. Aguarda verificação (~10-15min) → status verde
5. Cria API Key em **API Keys → Create** com permissão "Sending access"
6. Adiciona ao `.env` do VPS:
   ```
   RESEND_API_KEY=re_xxx
   MAIL_FROM=SAL Hub <notificacoes@salestrategias.com.br>
   NEXT_PUBLIC_HUB_URL=https://hub.salestrategias.com.br
   ```
7. Restart: `docker compose up -d`

**Como testar:** cria tarefa URGENTE com `dataEntrega` ontem, abre dashboard
(dispara `gerarNotificacoes`) → email deve cair em ~10s.

**Arquivos já implementados:**
- `src/lib/email.ts` — wrapper Resend
- `src/lib/email-templates.ts` — HTML inline
- `src/lib/notificacoes.ts` — dispatch após `createMany`
- `prisma/schema.prisma` — `Notificacao.enviadaPorEmail`

**Tipos que disparam email** (`TIPOS_QUE_DISPARAM_EMAIL` em email-templates.ts):
`CONTRATO_VENCENDO`, `TAREFA_ATRASADA`, `PROPOSTA_VISTA/ACEITA/RECUSADA`, `ACTION_ITEM_ATRASADO`.

---

## 🔵 Próximo planejado

_(nada agendado — escolher da lista abaixo)_

---

## 🟢 Quick wins (1-2h cada — pegar quando der)

- [ ] **Export de clientes em CSV** — replicar pattern de `csv-export.ts`, plugar botão na lista de clientes
- [ ] **Export de propostas em CSV** — colunas: numero, titulo, cliente, valor, status, datas
- [ ] **Quick Capture estendido** — `Ctrl+L` lead, `Ctrl+T` tarefa, `Ctrl+$` lançamento (hoje só `C` pra nota)
- [ ] **Categorias predefinidas no Financeiro** — dropdown com presets (Anúncios, Salários, Software, Impostos, etc) ao invés de digitar
- [ ] **Saldo acumulado no extrato exportado** — coluna a mais que faz SUM rolling
- [ ] **Filtros de período no Financeiro** — "mês atual / trimestre / ano / custom"
- [ ] **KPI %do faturamento** — "anúncios = 12% do MRR"

---

## 🟣 Visão maior (1-2 semanas cada)

- [ ] **Health score de cliente** — score 0-100 combinando tempo de contrato, MRR vs ticket inicial, frequência de reuniões, tarefas atrasadas, status de pagamento → antecipa churn
- [ ] **WhatsApp Business integrado** — Z-API ou WhatsApp Cloud API, histórico do cliente mostra [Reunião] + [Email] + [WhatsApp] na timeline
- [ ] **Dashboards customizáveis** — drag-drop de widgets (MRR, pipeline, tarefas, gráficos) pra montar tela do dia-a-dia

---

## ⚪ Ideias soltas (avaliar viabilidade quando voltar)

- Audit log visível pro usuário (quem editou cliente X em quando)
- Comentários/colaboração em entidades (cliente, projeto, proposta)
- Tags globais reusáveis em projetos/leads/tarefas (hoje só Cliente tem `Tag`)
- OKRs / metas internas (SAL controlar próprias metas trimestrais)
- Cobrança / boletos automáticos integrado com gateway (Asaas, Pagar.me)
- Multi-usuário real com convite por email + roles granulares
- App mobile (PWA ou React Native) — Quick Capture do celular

---

## ✅ Concluído

### 2026-05-13
- ✅ **Portal do Cliente** (`/p/cliente/{token}`) — área pública por cliente com sessão própria (cookie HMAC 7 dias), senha opcional bcrypt. 4 tabs configuráveis por cliente: Calendário (com aprovar/pedir ajuste), Tarefas, Reuniões + actions, Relatórios mensais PDF. Cliente aprova post → status muda + Marcelo notificado. Cliente pede ajuste com comentário → notifica Marcelo. Admin no cliente-sheet com toggles granulares + URL + copy. Layout mobile-first com header roxo SAL.
- ✅ **OAuth 2.1 + PKCE + DCR no MCP** — pra Claude Desktop conectar como Connector nativo. Endpoints: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/register` (Dynamic Client Registration), `/authorize` (tela de consent com login do Hub), `/token` (PKCE validation + emite McpToken). Cada conexão Claude vira um McpToken visível em `/admin/mcp`, revogável a qualquer momento. Whitelist restritiva de redirect_uri (claude.ai/claude.com/localhost). `force-dynamic` + `x-forwarded-host` pra URL correta atrás de Cloudflare.
- ✅ **Importação Notion → Hub** — script `scripts/import-notion.ts` + `prisma/notion-import-data.ts` com 16 clientes (merge de 2 DBs), 21 tarefas, 14 posts editoriais, 6 lançamentos financeiros mensais, 11 seções do Manual SAL (Playbook + Marca). Idempotente, dedup por chave natural.
- ✅ **Fix drawer mobile via Portal** — drawer estava confinado a 64px de altura porque o `<Header>` tem `glass` (backdrop-filter) que cria novo containing block pra `position: fixed`. Fix: renderizar overlay+drawer via `createPortal(document.body)`. Bonus: lock de scroll do body quando aberto.
- ✅ **Fix Notas mobile** — `grid-cols-[220px_300px_1fr]` era desktop-only. Refatorado pra layout mobile com 3 views navegáveis (pastas → lista → editor) controladas por `mobileView` state. Desktop mantém 3 colunas.
- ✅ **Fix kanbans em mobile** — `-mx-8 px-8` (margem negativa pra compensar padding do PageShell desktop) estourava no mobile com PageShell `px-3`. Trocado pra `-mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8` em leads/projetos/conteúdo SAL.
- ✅ **Auditoria via Claude in Chrome** — usado pra inspecionar DOM real do drawer mobile e confirmar diagnóstico (aside.rect.h=64px) que apontou pro problema do backdrop-filter.

### 2026-05-11
- ✅ **Responsividade mobile completa** — Sidebar vira drawer slide-in com botão hamburger no Header · Header compacta ações secundárias (Help/Theme/HideValues/Logout) no mobile, mantém Quick Capture + Notificações + Avatar acessíveis · PageShell adapta paddings (`px-3 sm:px-6 lg:px-8`) · Manual SAL: sidebar interna vira accordion colapsável com botão "Seções do Playbook/Marca" · Calendário: força view AGENDA no mobile (Mês/Semana ilegíveis em telas <640px), dropdown de cliente full-width · Reunião detalhe: botões wrap + flex-1 no mobile.
- ✅ **Drag-drop pra reordenar seções do Manual** — `@hello-pangea/dnd`, handle visual `GripVertical`, optimistic update, `POST /api/manual/reordenar`. MVP só reordena dentro do mesmo container; movimentação entre níveis fica pra futuro.
- ✅ **Manual SAL (Playbook + Marca)** — wiki interno com 2 categorias (PLAYBOOK e MARCA), seções com hierarquia opcional (1 nível pai→filhas), editor BlockNote inline com auto-save, seed inicial idempotente (10 seções Playbook + 8 seções Marca padrão de agência), publicação/rascunho, compartilhamento público (reusa `PublicShare`), página pública em `/p/share/[token]` renderiza com layout dedicado. Link no sidebar.
- ✅ **Reuniões com transcrição automática do Meet + IA via Claude Max** — botão "Importar do Meet" lista Docs recentes do Drive (pasta "Meet Recordings"), parseia formato Meet (pt-BR e en, com/sem Gemini "Take notes for me") e cria `ReuniaoBlock[]` + `ReuniaoAction[]` + `resumoIA` automaticamente quando o Doc trouxer. Import é idempotente e preserva campos não-trazidos (suporta 2 Docs separados do Gemini: "Anotações" + "Transcrição"). Botão "Gerar resumo / actions" abre wizard 3 passos Claude Max como fallback se Doc não trouxer resumo. Zero custo de API.
- ✅ **Player de gravação embedado do Drive** — durante o import do Meet, sistema busca automaticamente o MP4 na mesma pasta do Doc e vincula (`audioUrl`). Player usa iframe `/preview` do Drive (controles nativos). Click em qualquer timestamp da transcrição salta no vídeo (re-mount com `#t={seg}s`). Modal pra trocar/colar URL manual caso busca automática falhe.
- ✅ **Calendário unificado** (`/calendario`, atalho `G`) — 6 tipos de evento (tarefas, posts cliente, conteúdo SAL, reuniões, contratos vencendo, propostas expirando), 4 views (mês/semana/dia/agenda), drag-drop pra reagendar, filtros por tipo + cliente, navegação pra detalhe ao clicar. Componente novo `AtalhosGlobais` plugado no layout.
- ✅ **Configurações admin (singleton + UI)** — model `Configuracao` no DB, página `/admin/configuracoes` (só ADMIN), editor com 3 modos pro destino de onboarding (Shared Drive / Pasta específica / Meu Drive), modal de browse de pastas, cache invalidado ao salvar
- ✅ **Onboarding salva em Shared Drive "Clientes SAL"** — `resolveOnboardingParentId()` em 3 níveis (DB > env > auto-lookup por nome), pasta nasce dentro do drive escolhido
- ✅ **Suporte a Shared Drives (Drives Compartilhados)** — refactor de `lib/google-drive.ts` com `supportsAllDrives` + `includeItemsFromAllDrives` em todas as chamadas, nova função `listSharedDrives()`, endpoint `/api/drive/drives`, seletor de drive no `DriveBrowser`. Backwards compatible (defaults pra Meu Drive).
- ✅ **Onboarding automático de cliente** — trigger em 3 entry points (criar cliente ATIVO, promover PROSPECT→ATIVO, converter lead GANHO). Cria pasta Drive + projeto "Onboarding" + 7 tarefas padrão com prazos escalonados. Idempotente via `onboardingFeitoEm`. Botão manual no cliente-sheet pra re-executar.
- ✅ **Relatório mensal automático por cliente (PDF)** — botão no cliente-sheet + quick action na lista, gera PDF com métricas das redes, SEO, tráfego pago, conteúdo e operacional, com comparativo MoM
- ✅ **Faturamento recorrente automático** — gera mensalidade dos clientes ATIVO no /financeiro, idempotente, com botão manual
- ✅ **Backend de notificações por email** (Resend) — código pronto, só falta config externa (ver "Em espera" acima)
- ✅ **Export de extrato financeiro** em CSV
- ✅ **Export de leads** em CSV respeitando filtros
- ✅ **Importação de leads em batch** via CSV (Meta Lead Ads + variantes), dedup por email
- ✅ **Importação de relatórios** (Redes/SEO/Tráfego) via CSV ou Google Sheets público
- ✅ **Helper genérico `csv-export.ts`** reusável em qualquer módulo
