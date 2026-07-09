# Blog SAL — Sistema de Conteúdo Automatizado

Produção diária de artigos SEO para https://salestrategias.com.br/blog/, executada pelo Claude Code via assinatura Max (sem custo de API).

## Peças

| Arquivo | Papel |
|---|---|
| `estrategia-seo.md` | Estratégia: público, clusters, funil, KPIs |
| `calendario-editorial.md` | Fila de pautas com keyword, intenção e status. **Fonte da verdade.** |
| `guia-de-redacao.md` | Padrão de qualidade obrigatório de cada artigo |
| `runbook-publicacao.md` | Passo a passo que a rotina executa todo dia |
| `prompt-rotina.md` | Prompt da execução diária (usado no local e no VPS) |
| `capa/` | Gerador de capas code-first (Satori + resvg, identidade v10, 1376×768) com foto do Pexels (`--busca`) e fallback tipográfico |
| `vps/` | Migração pro VPS: `setup-blog-vps.sh` (provisiona) + `rodar-artigo.sh` (cron) |
| `wpcode-rankmath-rest.php` | Snippet WPCode: expõe meta do Rank Math na REST API |
| `.env` (criar a partir de `.env.exemplo`) | Credenciais WP + chave draft/publish |
| `log-publicacoes.md` | Histórico de execuções |
| `fila-local/` | Artigos escritos quando não havia credenciais |

## Operação

**Modo VPS (alvo):** cron `0 8 * * *` (America/Sao_Paulo) roda `vps/rodar-artigo.sh` como usuário `salblog`: git pull → `claude -p` com `prompt-rotina.md` → commit/push do estado (calendário + log). Auth: `CLAUDE_CODE_OAUTH_TOKEN` (gerado com `claude setup-token`) em `/home/salblog/blog-automacao.env`.

**Modo local (fallback):** rotina agendada `blog-sal-artigo-diario` no app Claude desktop, diária às 08:00 (roda com o app aberto). Desativar quando o VPS assumir, pra não publicar em dobro.

- Pausar: remover a linha `SAL_BLOG_DIARIO` do crontab do salblog (VPS) ou desabilitar a rotina (local).
- Trocar ordem/pautas: editar `calendario-editorial.md` (a rotina sempre pega a primeira `PENDENTE`).
- Aprovação: os 2 primeiros artigos saem como rascunho; depois, comportamento definido por `STATUS` no `.env`.
- SEO meta (title/description/focus keyword) vai via Rank Math — requer o snippet `wpcode-rankmath-rest.php` ativo no WPCode.
