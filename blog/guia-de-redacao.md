# Guia de Redação — Blog SAL

Este guia define o padrão de qualidade de TODO artigo do blog salestrategias.com.br. O agente de produção diária DEVE seguir cada regra daqui. Em conflito com qualquer outra instrução, este guia vence.

## 1. Público e propósito

Escrevemos para **donos de lojas virtuais / gestores de e-commerce** e **donos de negócios de varejo local**. Gente que opera o negócio no dia a dia, sem equipe de marketing dedicada, decidindo onde investir tempo e verba.

- O leitor termina o artigo sabendo **o que fazer na prática**, não só "o que é".
- Todo artigo responde uma pergunta real de busca (a keyword de cauda longa da pauta).
- Objetivo comercial: construir autoridade da SAL e gerar diagnósticos (https://salestrategias.com.br/diagnostico/).

## 2. Tom de voz

- Direto, prático, didático sem ser raso. Autoridade de quem opera, não de quem teoriza.
- Português brasileiro natural. Frases curtas. Voz ativa.
- **PROIBIDO:** "PMEs", "pequenas e médias empresas", "empreendedores" (genérico). Usar: lojistas, e-commerces, negócios locais, marcas, donos de loja.
- **PROIBIDO:** em-dash (—) no texto. Usar ponto, vírgula ou "·".
- **PROIBIDO:** inventar números, estatísticas ou cases. Todo dado precisa de fonte real (linkada). Sem fonte, não usa.
- Promessas moderadas: nada de "guia definitivo/completo que resolve tudo". Especificidade > superlativo.
- IA no conteúdo: sempre como facilitador/produtividade. "IA acelera, humano decide." Nunca tom evangelista nem "automatize 100%".
- SAL: fundada em 2024; Marcelo trabalha com marketing desde 2014. Sede em POA, atendimento Brasil todo (não liderar copy com "Porto Alegre").

## 3. Estrutura obrigatória do artigo

1. **H1** único com a keyword principal (é o título do post).
2. **Resposta direta nos primeiros 50-70 palavras** (parágrafo de abertura responde a pergunta da busca de forma completa e citável — otimização GEO/AI Overviews).
3. **H2s e H3s** hierárquicos, escaneáveis, com variações da keyword e perguntas relacionadas. O template do site gera TOC automático a partir dos headings.
4. Pelo menos **1 lista** e **1 tabela** (facilita extração por LLMs e featured snippets).
5. **Exemplos concretos** do universo do leitor (loja de roupa, pet shop, loja de suplementos, comércio de bairro). Cenários hipotéticos claramente apresentados como exemplos, nunca como case real.
6. **Seção FAQ** ao final com 3-5 perguntas reais (estilo People Also Ask) e respostas de 40-60 palavras.
7. **CTA final**: 1 parágrafo conectando o tema ao diagnóstico gratuito da SAL + link. Tom consultivo, não vendedor.
8. Extensão: **1.500 a 2.500 palavras**. Profundidade real, zero enrolação.

## 4. SEO on-page

O site usa **Rank Math**. A automação grava os campos dele via REST (meta `rank_math_*`, expostos pelo snippet `wpcode-rankmath-rest.php`).

| Elemento | Regra |
|---|---|
| Título do post (H1) | keyword no início, sem clickbait; pode ser um pouco mais longo que o title tag |
| `rank_math_title` (title tag) | 50-60 caracteres, keyword no início |
| `rank_math_description` (meta description) | 150-160 caracteres, keyword + benefício + CTA implícito |
| `rank_math_focus_keyword` | a keyword-alvo exata do calendário |
| Slug | curto, keyword principal, sem stopwords desnecessárias, sem ano (evita envelhecer URL) |
| Excerpt | resumo de 150-160 caracteres (cards do blog e fallback); pode repetir a meta description |
| Keyword principal | no H1, no primeiro parágrafo, em 1-2 H2s, naturalmente no corpo (sem stuffing) |
| Links internos | 3-6 posts relacionados do blog + 1-2 páginas de serviço + diagnóstico quando natural |
| Links externos | 1-3 fontes de autoridade (dados de mercado BR: Ebit/Nielsen, ABComm, Sebrae, Google, Meta). Sempre em nova aba não é necessário; HTML padrão |
| Imagens no corpo | opcional; se usar, só da media library existente, com alt text descritivo |

URLs canônicas para links de serviço:
- SEO: https://salestrategias.com.br/servicos/agencia-de-seo/
- Tráfego pago: https://salestrategias.com.br/servicos/gestao-trafego-pago/
- Conteúdo: https://salestrategias.com.br/servicos/producao-de-conteudo/
- Diagnóstico: https://salestrategias.com.br/diagnostico/

## 5. Schema JSON-LD

O **Rank Math já gera o schema `Article` automaticamente** — NÃO incluir Article no conteúdo (duplicaria).

Incluir ao FINAL do conteúdo apenas um `<script type="application/ld+json">` com `FAQPage` (perguntas/respostas da seção FAQ; o Rank Math só gera FAQ schema via bloco Gutenberg próprio, que não usamos).

Verificação: após publicar o primeiro artigo, conferir na URL real (1) se o script FAQPage foi mantido (não escapado) e (2) se não há schema duplicado com o do Rank Math. Problemas: remover do conteúdo, registrar no log e tratar via snippet PHP.

## 6. Formato de entrega (HTML)

O campo `content` do post é HTML limpo: `<h2>`, `<h3>`, `<p>`, `<ul>/<ol>`, `<table>`, `<strong>`, `<a>`. Sem `<h1>` no corpo (o título do post já é o H1). Sem estilos inline, sem classes. Acentuação UTF-8 sempre preservada.

## 7. Checklist final (antes de publicar)

- [ ] Responde a keyword nos primeiros 50-70 palavras?
- [ ] Título 50-60 chars com keyword? Excerpt 150-160 chars?
- [ ] Nenhuma ocorrência de "PME", em-dash, número inventado?
- [ ] Tem tabela + lista + FAQ + CTA pro diagnóstico?
- [ ] 3+ links internos verificados (URLs reais do blog, conferidas via REST)?
- [ ] Slug não colide com post existente?
- [ ] Schema JSON-LD válido no final do content?
