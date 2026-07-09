# Setup — CONCLUÍDO em 2026-07-09 ✓

A automação está 100% operacional no VPS do Hub (72.60.252.5). Este arquivo fica como registro da ativação.

| Item | Status |
|---|---|
| Commit blog/ + logos no GitHub | ✓ (`fceefc4` + fixes) |
| Application Password WP (`marcelofreitas`, host www) | ✓ validada (200) |
| Snippet Rank Math no WPCode | ✓ ativo (meta rank_math_* gravando via REST) |
| Chave Pexels | ✓ no `blog/.env` do VPS |
| VPS provisionado (salblog, Node 20, Claude CLI, clone, capas) | ✓ |
| Deploy key `sal-blog-vps` (write) no GitHub | ✓ |
| Token da assinatura (`claude setup-token`) | ✓ em `/home/salblog/blog-automacao.env` |
| Cron diário `0 11 * * *` UTC (= 8h BRT) | ✓ marker `SAL_BLOG_DIARIO` |
| Teste de ponta a ponta | ✓ artigo #1 draft (post 1870), exit 0, ~10min |
| Rotina local `blog-sal-artigo-diario` | desativada (evita publicação em dobro) |

## Operação diária

- Logs: `/home/salblog/logs/blog-AAAA-MM-DD.log` no VPS; resumo em `blog/log-publicacoes.md` (sincroniza via git).
- Pausar: `sudo -u salblog crontab -e` e remover a linha `SAL_BLOG_DIARIO`.
- Artigos #1 e #2 = rascunho (calibração); do #3 em diante publica direto (`STATUS` no `.env` do VPS).

## Backlog (decidir depois)

- 4 rascunhos órfãos de abril/2026 no WP (era n8n+Gemini; inclui temas fora do público, ex. B2B LinkedIn): apagar ou reaproveitar.
- Consolidação da canibalização (3x GMN, 4x SEO local) com redirects 301 — plano na `estrategia-seo.md` §6.
- Opcional: ampliar allowlist do agente no VPS (`jq`, `python3`, `cat`, `grep`, `sed`) pra execuções mais fluidas — exige pedido explícito do Marcelo.
