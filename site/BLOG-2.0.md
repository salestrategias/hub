# Blog da SAL 2.0 — o portal dentro do tema

O blog deixou de viver em snippets do WPCode interceptando o WordPress e passou
a viver onde deveria: nos templates do tema `sal`, que já é o tema ativo do site.

## O que mudou de arquitetura

| Antes (snippets) | Agora (tema 2.0.0) |
|---|---|
| `template_redirect` + `exit` por cima do tema | Templates da hierarquia normal do WordPress |
| CSS dentro do PHP, brigando com reset por especificidade | `assets/css/blog.css`, um arquivo, prefixo `.sb-` |
| Fontes do Google Fonts (e a Glook, que não existia) | Newsreader + Plus Jakarta Sans + Inter, self-hosted no tema |
| Identidade v10 (papel/roxo/lima), diferente do site novo | A mesma identidade do site novo: osso, indigo, champagne |
| Editorias em `?editoria=` com `noindex` | Arquivos de categoria reais, indexáveis e paginados |
| Elementor carregando 1,3 MB de CSS em cada artigo | Elementor e afins desenfileirados nas telas do blog |

## Os arquivos

```
home.php          o portal /blog/: manchete, últimas, editorias, guias,
                  mais lidos, newsletter e chamada da agenda
category.php      a editoria: cabeçalho, grade paginada de 12 em 12
single.php        o artigo: trilha, capa grande, leitura a 780px, autor,
                  CTA da agenda e três relacionados da mesma editoria
search.php        resultados de busca na mesma grade
header-blog.php   barra alta + topo escuro com as 4 maiores editorias,
                  busca e CTA
footer-blog.php   rodapé escuro com editorias, navegação, contato e CNPJ
inc/blog.php      consultas, helpers, limpeza de plugins e imagem de capa
                  em 1200px (Google Discover)
assets/css/blog.css
assets/fonts/newsreader-var.woff2
```

Nenhum template do site institucional (front-page, page, templates/) foi tocado:
as páginas do Elementor continuam exatamente como estão.

## Como publicar

1. **Aparência → Temas → Adicionar novo → Enviar tema** → subir `sal-2.0.0.zip`.
   O WordPress detecta que o tema já existe e oferece **"Substituir o atual pelo
   enviado"** — confirmar. (O zip é gerado da pasta `site/wp-content/themes/sal`
   deste repositório.)
2. **WPCode → desativar** os snippets que o tema substitui:
   - "Blog Portal 2026" (o portal)
   - "Artigo 2026" (o single)
   - o snippet de performance do blog, se tiver sido instalado
   - o snippet antigo da newsletter que injeta cards via `wp_footer`, se ainda
     estiver ativo — o template novo já traz o bloco de newsletter
3. Conferir `/blog/`, um artigo, `/blog/seo/` e uma busca.
4. **Configurações → Links permanentes → Salvar** (regrava as regras de URL).

Rollback: reativar os snippets. Eles continuam interceptando antes do tema, então
religá-los volta o comportamento anterior na hora.

## O que o painel ainda precisa (uma vez só)

- **Renomear categorias** (Posts → Categorias, só o campo Nome, sem tocar no slug):
  `SEO` → "SEO & GEO", `SEO Local` → "Varejo Local", se quiser manter os rótulos
  editoriais. Menu, rodapé e páginas mudam junto.
- **Descrição das categorias**: o template exibe a descrição no topo da editoria
  quando ela existe. Um parágrafo por editoria ajuda o Google a entender o
  arquivo. Hoje estão vazias.
- **Rank Math**: tipo de schema dos posts → `BlogPosting`; sitemap descongelado;
  fallback de 404 (a recomendação da auditoria continua valendo).

## SEO, Discover e IAs — o que o desenho garante

- Um `<h1>` por tela, índice fechado (h1 → h2 → h3) nas quatro telas
- Editorias como arquivos de categoria reais, indexáveis, paginados de 12 em 12
- Capa em 1200×675 no artigo e na manchete (`sal-capa`), que é o tamanho que o
  Google Discover considera imagem grande; `max-image-preview:large` já vem do
  Rank Math
- Data de publicação e de atualização visíveis e em `<time datetime>`
- Autor com nome, bio e links em toda tela de artigo (E-E-A-T)
- Tempo de leitura calculado do texto
- Sem Elementor nas telas do blog: a base de CSS cai de ~1,5 MB para ~30 KB
- Fontes self-hosted com preload, sem requisição ao Google Fonts
- Rank Math continua respondendo por title, canonical, breadcrumb schema e
  sitemap — o tema não duplica nada disso
