# Runbook — Publicação Diária do Blog SAL

Processo executado pela rotina agendada `blog-sal-artigo-diario`. Cada execução produz e publica 1 artigo. Arquivos desta pasta (`blog/` no repo Hub):

- `estrategia-seo.md` — estratégia, clusters e regras editoriais
- `calendario-editorial.md` — fila de pautas (fonte da verdade do que publicar)
- `guia-de-redacao.md` — padrão de qualidade obrigatório de cada artigo
- `.env` — credenciais (NÃO versionado; ver `.env.exemplo`)
- `log-publicacoes.md` — histórico de execuções

## Passo a passo

### 1. Carregar configuração
Ler `blog/.env`. Variáveis: `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `STATUS` (draft|publish).
- **Sem credenciais:** escrever o artigo mesmo assim, salvar em `blog/fila-local/AAAA-MM-DD-slug.md` (título, excerpt, categoria, tags e content HTML completos), registrar no log e avisar que falta configurar o `.env`. Não tentar publicar.

### 2. Escolher a pauta
Abrir `calendario-editorial.md`, pegar a **primeira linha com status `PENDENTE`** (ordem do arquivo = ordem de publicação).
- Conferir duplicidade: `GET {WP_URL}/wp-json/wp/v2/posts?search=<termo>` e conferir slugs próximos. Se já existe artigo cobrindo a mesma keyword, marcar a pauta como `DESCARTADA (duplicada)` e pegar a próxima.

### 3. Pesquisar antes de escrever
2-4 buscas na web sobre o tema: dados atuais, o que os concorrentes rankeando dizem (para superar, não imitar), perguntas relacionadas. Anotar 1-3 fontes citáveis com URL real.

### 4. Escrever o artigo
Seguir `guia-de-redacao.md` à risca (estrutura, tom, SEO on-page, schema, checklist final).

### 5. Links internos
`GET {WP_URL}/wp-json/wp/v2/posts?per_page=100&_fields=slug,title,link` para listar posts existentes. Escolher 3-6 realmente relacionados e linkar no corpo com anchor text natural. Nunca inventar URL.

### 6. Imagem destacada (gerar capa própria, com foto)
Gerar a capa com o pipeline code-first em `blog/capa/`:
```
node blog/capa/gerar.js --titulo "Título do artigo" --destaque "trecho em roxo" \
  --categoria "Nome da Categoria" --busca "search query" --out capa-<slug>.png
```
- `--busca`: query pro banco de fotos (Pexels) em INGLÊS, 2-4 palavras, concreta e visual, coerente com o tema do artigo (ex.: "clothing store owner", "online shopping boxes", "small shop counter"). Preferir cenas de comércio/varejo com gente real; evitar termos abstratos ("marketing", "strategy" rendem stock genérico ruim).
- `--destaque`: o trecho do título com mais carga (2-4 palavras). O layout rotaciona por hash do título (split-white, split-warm, fullbleed-dark).
- O script imprime `FOTO: Pexels #id por <fotógrafo>` — registrar no log (rastreabilidade da licença).
- Sem PEXELS_API_KEY ou sem resultado bom, o script cai sozinho na variante tipográfica (sem foto) — é um fallback aceitável, anotar `CAPA SEM FOTO` no log.
- Upload: `POST {WP_URL}/wp-json/wp/v2/media` com `Content-Disposition: attachment; filename="capa-<slug>.png"`, `Content-Type: image/png` e o binário no body; depois `POST /wp-json/wp/v2/media/{id}` com `{"alt_text": "<título>", "title": "<título>"}`.
- `featured_media` = ID retornado.
- Se a geração falhar (ex.: node indisponível), fallback: escolher capa existente na media library mais aderente ao tema e anotar `CAPA REAPROVEITADA` no log; em último caso `SEM CAPA`.

### 7. Publicar
```
POST {WP_URL}/wp-json/wp/v2/posts
Authorization: Basic base64(WP_USER:WP_APP_PASSWORD)
Content-Type: application/json
{
  "title": "...", "slug": "...", "content": "<html>",
  "excerpt": "resumo 150-160 chars",
  "categories": [ID], "tags": [IDs], "status": "<STATUS>",
  "featured_media": ID,
  "meta": {
    "rank_math_title": "title tag 50-60 chars",
    "rank_math_description": "meta description 150-160 chars",
    "rank_math_focus_keyword": "keyword-alvo do calendário"
  }
}
```
- Os campos `meta.rank_math_*` dependem do snippet `wpcode-rankmath-rest.php` instalado no WPCode. Se a resposta da API ignorar o `meta` (campos não registrados), anotar `RANK MATH META PENDENTE` no log e seguir (o Rank Math cai no template padrão).
- Categorias: E-commerce=14, SEO=13, SEO Local=17, Tráfego Pago=15, Marketing Digital=29, Insights=16.
- Tags: buscar com `GET /wp-json/wp/v2/tags?search=`; criar com `POST /wp-json/wp/v2/tags {"name": "..."}` se não existir. 3-6 tags por post.
- Usar `curl` via Bash com heredoc para o JSON (atenção a escaping e UTF-8).

**Regra de calibração:** os 2 primeiros artigos produzidos por esta rotina saem SEMPRE como `draft`, independente de `STATUS`, com aviso ao Marcelo para revisar. Do 3º em diante vale o `STATUS` do `.env`.

### 8. Verificar
`GET` na URL do post publicado (se `publish`): título ok, acentuação ok, headings renderizando, schema não escapado. Se `draft`, conferir via `GET /wp-json/wp/v2/posts/{id}?status=draft` autenticado.

### 9. Atualizar estado
- No `calendario-editorial.md`: trocar `PENDENTE` da pauta por `PUBLICADO AAAA-MM-DD` (ou `DRAFT AAAA-MM-DD`) + URL.
- Acrescentar linha em `log-publicacoes.md`: data, título, URL, status, observações (ex.: SEM CAPA, schema escapado, keyword ajustada).

### 10. Falhas
Qualquer erro (API fora, auth inválida, calendário vazio): registrar em `log-publicacoes.md` com a mensagem de erro exata e sinalizar na notificação de conclusão. **Calendário com menos de 10 pautas PENDENTES:** avisar que é hora de gerar o próximo ciclo de pautas.

## Regras de segurança
- Esta rotina só cria/edita POSTS do blog. Nunca editar páginas, snippets, plugins, usuários ou configurações do WP.
- Nunca deletar posts.
- Nunca commitar `blog/.env`.
