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

- [ ] **Calendário unificado** (`G` global) — tarefas + posts + reuniões + contratos vencendo + propostas expirando, drag-drop pra reagendar
- [ ] **Onboarding automático de cliente** — quando lead vira cliente (GANHO), sistema cria automático: pasta no Drive, projeto "Onboarding" com tarefas padrão, lançamento financeiro do primeiro mês
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

### 2026-05-11
- ✅ **Relatório mensal automático por cliente (PDF)** — botão no cliente-sheet + quick action na lista, gera PDF com métricas das redes, SEO, tráfego pago, conteúdo e operacional, com comparativo MoM
- ✅ **Faturamento recorrente automático** — gera mensalidade dos clientes ATIVO no /financeiro, idempotente, com botão manual
- ✅ **Backend de notificações por email** (Resend) — código pronto, só falta config externa (ver "Em espera" acima)
- ✅ **Export de extrato financeiro** em CSV
- ✅ **Export de leads** em CSV respeitando filtros
- ✅ **Importação de leads em batch** via CSV (Meta Lead Ads + variantes), dedup por email
- ✅ **Importação de relatórios** (Redes/SEO/Tráfego) via CSV ou Google Sheets público
- ✅ **Helper genérico `csv-export.ts`** reusável em qualquer módulo
