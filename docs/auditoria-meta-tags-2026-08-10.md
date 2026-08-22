# Auditoria de SEO on-page — robots.txt, titles e descriptions

**Data:** 10/08/2026 · **Site:** www.salestrategias.com.br · **Escopo:** robots.txt, sitemaps, `<title>` e `<meta description>` de todas as URLs indexáveis (11 páginas estáticas + blog + 53 posts + 5 categorias + 21 páginas antigas do WordPress).

**Nota geral: 92/100** — o on-page está muito bem resolvido. Nenhum problema crítico; 4 ajustes pontuais elevam para ~100.

---

## 1. robots.txt — ✅ adequado

```
User-agent: *
Allow: /

Sitemap: https://www.salestrategias.com.br/sitemap.xml
Sitemap: https://www.salestrategias.com.br/sitemap_index.xml
```

- Não bloqueia nada importante ✅
- Declara os dois sitemaps (estático + WordPress) ✅
- A busca interna (`/?s=`) já sai com `noindex` via Rank Math, então não precisa de bloqueio ✅

**Melhoria opcional** (higiene de crawl budget, não urgente):

```
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
```

## 2. Sitemaps

| Sitemap | Estado |
|---|---|
| `sitemap.xml` (estático) | ✅ 11 páginas, todas 200, 404 excluído |
| `post-sitemap.xml` | ✅ 53 posts + /blog/, todos 200 |
| `category-sitemap.xml` | ✅ 5 categorias |
| `news-sitemap.xml` | ✅ ativo, com os posts das últimas 48h |
| `local-sitemap.xml` | ✅ locations.kml |
| `page-sitemap.xml` | ⚠️ **único problema estrutural** — ver abaixo |

**⚠️ page-sitemap.xml lista 21 URLs mortas/duplicadas.** Das 21 páginas do WordPress listadas, 18 são redirects 301 para as páginas estáticas (`/servicos/*`, `/contato/`, `/diagnostico/`, `/home-v6/`, `/home-v7/`, `/newsletter/`) e 3 duplicam o sitemap estático (`/`, `/quem-somos/`, `/marcelo-freitas/`). Sitemap não deve listar URL que redireciona — o Google reporta isso como "página com redirecionamento" no GSC e gasta crawl à toa.

**Correção (2 min, sem risco):** Rank Math → *Sitemap Settings* → *Pages* → desligar **"Include in Sitemap"**. Os redirects 301 continuam funcionando normalmente (são do módulo de Redirections, independem do sitemap). A faxina definitiva (despublicar as 21 páginas antigas) continua pendente como tarefa separada.

## 3. Páginas estáticas (11) — ✅ tudo ok

Todas com title único (54–62 chars), description única (107–166 chars), canonical correto, `index, follow, max-image-preview:large`. Sem duplicatas.

Ajustes cosméticos opcionais:
- `/diagnostico-de-site/` — description com 166 chars, o Google corta no final ("...plano de correção"). Enxugar para ≤158.
- `/agenda/` (107) e `/varejo-local/` (120) — descriptions curtas; há espaço para incluir mais argumento/CTA.

## 4. Blog — posts (53) — ✅ 50/53 perfeitos

Nenhum title ou description duplicado em 53 posts. Nenhum post sem description. Canonicals e robots corretos em todos.

**❌ 3 posts sem title customizado no Rank Math** — herdam o template `%title% - SAL Estratégias de Marketing Digital` e estouram o limite:

| Post | Title atual | Chars |
|---|---|---|
| `/otimizacao-google-meu-negocio-2026-algoritmo-frescor/` | Otimização de Google Meu Negócio 2026: O Algoritmo de Frescor - SAL… | 104 |
| `/google-analytics-4-guia-completo/` | Google Analytics 4: O Guia Completo para Análise de Dados - SAL… | 98 |
| `/cac-e-ltv-como-calcular-metricas-negocio/` | CAC e LTV: O que são, como calcular e otimizar - SAL… | 87 |

**Correção:** editar cada post → aba Rank Math → campo *Title* → usar o próprio H1 sem o sufixo:
1. "Otimização de Google Meu Negócio 2026: Algoritmo de Frescor" (59)
2. "Google Analytics 4: Guia Completo para Análise de Dados" (55)
3. "CAC e LTV: o que são, como calcular e otimizar" (46)

**⚠️ Canibalização potencial (avaliar no GSC):** dois pares de posts disputam a mesma keyword:
- `/seo-para-negocios-locais-2026-5/` × `/seo-para-negocios-locais-2026-dominacao-regional/` (ambos "SEO para Negócios Locais 2026")
- `/otimizacao-de-google-meu-negocio-2026-2/` × `/otimizacao-google-meu-negocio-2026-algoritmo-frescor/` (ambos "Otimização de Google Meu Negócio")

Os sufixos `-2` e `-5` nos slugs indicam publicação duplicada na época da automação. Recomendação: ver no GSC qual de cada par tem mais impressões e fazer 301 do perdedor para o vencedor (Rank Math → Redirections), ou reescrever um deles para outra intenção de busca.

## 5. Blog — categorias (5)

- `/blog/` ✅ title e description ok.
- `/blog/seo/`, `/blog/ecommerce/`, `/blog/trafego-pago/` ✅ com description.
- **❌ `/blog/seo/seo-local/` e `/blog/marketing-digital/` sem meta description** — o Google monta o snippet sozinho. Correção: Posts → Categorias → editar → preencher o campo *Descrição* (o Rank Math usa como meta description). Sugestões:
  - SEO Local: "SEO local na prática: Perfil da Empresa no Google, ranqueamento no mapa, avaliações e estratégias para negócios locais atraírem clientes da região." (150)
  - Marketing Digital: "Estratégias de marketing digital para varejo e e-commerce: planejamento, métricas, inbound e as mudanças que impactam quem vende todo dia." (139)

## 6. Verificações extras (aproveitando a varredura)

- 404 real (URL inventada → HTTP 404 + noindex) ✅
- Busca interna com `noindex` ✅
- Redirects 301 das URLs antigas todos apontando para o destino certo ✅
- Open Graph completo nos posts (imagem 1376×768, twitter:card large) ✅
- Schema nos posts: NewsArticle + FAQPage + BreadcrumbList + Person + Place ✅

## Prioridades

1. 🔴 Desligar *Pages* no sitemap do Rank Math (2 min) — remove 21 URLs mortas do índice de rastreio.
2. 🔴 Corrigir o title dos 3 posts sem title customizado (5 min).
3. 🟡 Preencher a description das 2 categorias (5 min).
4. 🟡 Resolver os 2 pares de canibalização via GSC (30 min, esperar dados de impressão).
5. 🟢 Cosméticos: enxugar description de `/diagnostico-de-site/`, engordar `/agenda/` e `/varejo-local/`.
