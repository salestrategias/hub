# Auditoria de SEO — blog no WordPress e site novo em Astro

Levantamento feito em 30/07/2026 sobre o que está no ar (`www.salestrategias.com.br`)
e sobre o site novo, ainda não publicado.

---

## O que precisa de mão no WordPress

São quatro coisas, e a primeira é a mais séria.

### 1. 🔴 O sitemap parou em 10 de julho

O `post-sitemap.xml` lista **25 endereços**. O WordPress tem **42 artigos publicados**.
Os **18 que faltam são exatamente os publicados de 11/07 em diante** — ou seja, tudo o
que a automação diária produziu neste mês está fora do sitemap.

Conferido de duas formas:

```
posts publicados (REST) ... 42
URLs no post-sitemap ...... 25
artigo mais recente listado no sitemap: 10/07/2026
```

O `sitemap_index.xml` diz que o arquivo foi atualizado em 27/07, mas o conteúdo dele é
de 10/07. E o cabeçalho da resposta confirma cache:

```
x-cache-lifetime: 604800   (7 dias)
x-cache-age: 213228        (2,5 dias)
```

São duas camadas: o cache interno do Rank Math, que congelou, e o cache de página da
hospedagem, que serve o arquivo velho por uma semana.

Os artigos não estão invisíveis — o Google chega neles pelos links do `/blog/`. Mas o
sitemap é o canal principal de descoberta, e ele está morto há vinte dias, bem no período
em que o blog mais publicou.

**Como resolver:**
1. `Rank Math → Painel → Status & Ferramentas → Ferramentas do Banco de Dados` →
   **Limpar cache do Sitemap**.
2. `Rank Math → Sitemap XML` → salvar as configurações (força a regeração).
3. Limpar o cache do site (Hostinger / LiteSpeed / plugin de cache).
4. Abrir `https://www.salestrategias.com.br/post-sitemap.xml` e conferir se aparece o
   artigo mais recente. Se não aparecer, o cache da hospedagem ainda está no caminho.
5. No Search Console, reenviar `sitemap_index.xml`.

Se voltar a congelar, vale desligar o cache de sitemap do Rank Math ou excluir
`*-sitemap.xml` das regras de cache da hospedagem.

---

### 2. 🔴 Todo endereço inexistente devolve 301 para a home

```
/asdfghjkl/            → 301 → https://www.salestrategias.com.br  → 200
/pagina-que-nao-existe/ → 301 → home
/blog/pagina-inventada/ → 301 → home
```

Nenhum 404 é servido, em endereço nenhum. Isso é pior do que o soft-404 que eu tinha
anotado antes, porque agora é um **redirecionamento permanente**: o Google entende que
aquele endereço inventado *virou* a home. Na prática:

- qualquer erro de digitação em link externo vira um 301 para a home
- dá para gerar endereços infinitos que respondem 200, o que é um convite para spam
- link interno quebrado nunca aparece em relatório nenhum, porque não erra

**Onde procurar:** `Rank Math → Configurações Gerais → Monitor 404 / Redirecionamentos`
costuma ter uma opção de mandar todo 404 para a home. Vale olhar também a lista de
snippets do WPCode e as regras de redirecionamento do plugin. Desligada essa regra, o
`ErrorDocument 404 /404.html` do site novo passa a valer.

---

### 3. 🟡 1,3 MB de CSS travando a primeira pintura de cada artigo

Medido num artigo publicado, contando só o que bloqueia a renderização:

| | |
|---|---|
| CSS no `<head>` | **1.344 KB** em 24 arquivos |
| JS no `<head>` | 158 KB em 6 arquivos |
| JS no corpo | 293 KB em 15 arquivos |

Os dois maiores arquivos:

```
447 KB  elementskit-lite/widgets/init/assets/css/widget-styles.css
439 KB  elementskit/widgets/init/assets/css/widget-styles-pro.css
```

**886 KB, 66% de todo o CSS, é ElementsKit — e nenhuma tela do blog usa Elementor.**
O portal e os artigos são desenhados pelos snippets do WPCode, que trazem o próprio CSS.
Esses arquivos entram porque os dois snippets chamam `wp_head()`, e o `wp_head()` traz
tudo o que está enfileirado no site.

**Como resolver:** instalar o snippet novo `blog/wpcode-performance-blog.php`. Ele
desenfileira Elementor, ElementsKit, o addon do tema e o Font Awesome **apenas** quando
a tela é `/blog/` ou um artigo. As páginas feitas no Elementor não entram na condição e
continuam idênticas. Rollback = desativar o snippet.

Estimativa: sai de ~1,5 MB para algo em torno de 150 KB de recurso bloqueante.

---

### 4. 🟢 Schema `NewsArticle` em artigo que não é notícia

O Rank Math está marcando os artigos como `NewsArticle` e mantendo um `news-sitemap.xml`
com 2 endereços. Os artigos do blog são guias perenes, não notícia. O tipo correto é
`BlogPosting`.

Não há punição por isso — os dois são subtipos válidos de `Article`. Mas `NewsArticle`
mais news sitemap sinaliza uma elegibilidade para o Google Notícias que o site não tem,
e o Google recomenda usar sempre o tipo mais específico e correto.

**Como resolver:** `Rank Math → Títulos e Meta → Posts → Tipo de Schema` → **BlogPosting**.
E desligar o módulo *News Sitemap* em `Rank Math → Painel → Módulos`, já que o site não
está no Google Notícias.

---

## O que já foi corrigido nos snippets (é só colar)

Os três arquivos abaixo estão prontos no repositório. Copiar o conteúdo e substituir o
snippet correspondente no WPCode.

### `blog/wpcode-blog-portal.php`

| O que mudou | Por quê |
|---|---|
| **Fonte Glook → Plus Jakarta Sans 800** | A Glook não existe no Google Fonts. O pedido `family=Glook` devolve `400: Font family not found`, e os números grandes do portal estavam caindo em `cursive` — a fonte padrão de manuscrito do navegador. |
| **O `<h1>` deixou de ser o título da manchete** | O `/blog/` usava o título do artigo em destaque como `<h1>`. Ou seja: a página do portal competia com a página do próprio artigo pelo mesmo título. Agora o `<h1>` é "Blog da SAL" e a manchete virou `<h2>`. |
| **Hierarquia de títulos remontada** | A página pulava de `<h1>` direto para `<h3>`, e depois voltava para `<h2>`. Os rótulos de seção ("02 · Últimas", "03 · Editorias", "05 · Mais lidos") viraram `<h2>` de verdade, e o resto desceu um nível. Agora o índice fecha: h1 → h2 → h3 → h4. |
| **"A gente resume pra você" → "Resumimos pra você"** | Regra de linguagem da SAL. |
| **Botões apontam para `/agenda/`** | Antes iam para `/diagnostico/`, que passa a ser um 301. Um salto a menos em cada clique. |
| **"15 minutos" → "30 minutos, online"** | O diagnóstico é de 30 minutos em todo o site novo. |

### `blog/wpcode-post-2026.php`

| O que mudou | Por quê |
|---|---|
| **Fonte Glook → Plus Jakarta Sans 800** | Mesma coisa do portal. |
| **CTA: "Esse conteúdo fez sentido pro seu negócio? Então vem fechar a conta com a gente." → "Quer marketing na medida certa para a sua loja?"** | Tirava o "a gente" e trocava uma frase longa por uma pergunta direta. |
| **"Continue lendo" virou `<h2>`** | Era um `<div>`, e os cards abaixo eram `<h3>` — o índice pulava um nível. |
| **`/agenda/` e "30 minutos"** | Mesma padronização do portal. |

### `blog/wpcode-performance-blog.php` *(novo)*

O snippet que enxuga o carregamento, descrito no item 3.

---

## Site novo em Astro

Estado geral: **bom**. As doze páginas têm título único, descrição própria, canonical,
um `<h1>` só, dez tags Open Graph e schema completo. Nenhum erro de JavaScript, nenhum
estouro horizontal em 1440 e 390 px, `CLS 0,000` em todas.

Medido no navegador, com o site servido localmente:

| Página | LCP | Elemento do LCP | CLS | Recursos | Peso |
|---|---|---|---|---|---|
| `/` | 168 ms | texto do `<h1>` | 0,000 | 6 | 270 KB |
| `/seo-local/` | 116 ms | parágrafo | 0,000 | 6 | 270 KB |
| `/marcelo-freitas/` | 80 ms | imagem | 0,000 | 8 | 371 KB |
| `/agenda/` | 84 ms | parágrafo | 0,000 | 7 | 280 KB |

Para comparação: um artigo no WordPress carrega 45 recursos só de CSS e JS.

### Corrigido nesta rodada

**🔴 O site inteiro apontava para o domínio errado.** O canonical, o sitemap, o `og:url`
e todos os `@id` do schema usavam `https://salestrategias.com.br` (sem www). Mas o
endereço oficial é **com www**: é o que o WordPress declara como canonical desde sempre,
é onde está o histórico no Google, e o servidor já manda o sem-www para lá com 301.

O efeito seria um canonical apontando para um endereço que redireciona — o Search Console
marca isso como divergência, e cada visita do robô gasta um salto à toa. Corrigido nos
16 lugares onde o endereço estava escrito na mão.

**As fotos viraram WebP.** Cinco arquivos, de 375 KB para 223 KB — 40% a menos, sem
diferença visível. A `og-sal.jpg` continua em JPG de propósito: o WhatsApp e algumas
redes ainda tratam WebP de forma irregular em prévia de link.

**Um salto só na canonicalização.** O `.htaccess` do site novo passou a resolver
`http://` e sem-www na mesma regra. Sem isso, um endereço antigo em `http://` sem www
daria dois 301 encadeados. Se a Hostinger já força o www num nível acima, a regra
simplesmente não dispara.

**Títulos curtos alongados.** Cinco páginas usavam menos de 50 caracteres e desperdiçavam
espaço no resultado de busca:

| Antes | Depois |
|---|---|
| Diagnóstico de Site e Loja Virtual \| SAL | Diagnóstico de Site e Loja Virtual: por que não vende \| SAL |
| Quem somos \| SAL Estratégias de Marketing | Quem somos: agência de SEO e tráfego pago em Porto Alegre |
| Tráfego Pago para Varejo e E-commerce \| SAL | Gestão de Tráfego Pago para Varejo e E-commerce \| SAL |
| Marketing para E-commerce e Loja Virtual \| SAL | Agência de Marketing para E-commerce e Loja Virtual \| SAL |
| Marketing para Varejo Local e Loja Física \| SAL | Agência de Marketing para Varejo Local e Loja Física \| SAL |

A de "Quem somos" ganhou "Porto Alegre" de propósito: existe busca por agência com
recorte de cidade, e não havia página nenhuma disputando isso.

### Já estava certo

- `<html lang="pt-BR">` e viewport em todas as páginas
- 404 com `noindex, follow`
- Breadcrumb em toda página interna, `FAQPage` nas seis de serviço, `Person` na do Marcelo,
  `Organization` + `ProfessionalService` + `WebSite` na home
- Toda imagem com `alt`, `width` e `height` — é o que segura o CLS em zero
- Toda página abre com uma resposta direta nos primeiros parágrafos, que é o que faz
  as IAs citarem a fonte
- Link externo sempre com `rel="noopener"`
- Zero comentário de HTML no que é entregue, zero mapa de origem, zero vulnerabilidade
  conhecida nas dependências

---

## O que ainda depende de decisão

**As 21 páginas antigas no `page-sitemap.xml`.** Dezenove delas passam a ser 301 para as
páginas novas. Depois da publicação, o certo é despublicar essas páginas no WordPress —
senão o sitemap vai continuar oferecendo ao Google endereços que só redirecionam. As três
que colidem com endereço novo precisam sair antes de subir o site.

**Os dois sitemaps convivendo.** Depois da publicação, o Search Console vai ter
`sitemap.xml` (site novo, 11 endereços) e `sitemap_index.xml` (WordPress, blog). Os dois
precisam estar enviados. O `robots.txt` do site novo já aponta para os dois.

**Canibalização.** A `estrategia-seo.md` já registrava três artigos disputando "Google Meu
Negócio" e quatro disputando "SEO local". Continua valendo: consolidar num artigo forte
por tema e 301 do resto.

---

## Adendo — as editorias do blog (30/07, à tarde)

Pergunta do Marcelo: `/blog/?editoria=seo-geo` não é o jeito comum de mostrar
categoria no WordPress. Isso atrapalha o SEO?

**Atrapalha — não por punição, mas por desperdício.** Levantamento:

| | |
|---|---|
| `/blog/?editoria=seo-geo` | `noindex,follow` + canonical para `/blog/` |
| `/category/seo-geo/` | **301 para a home** (é o mesmo defeito do item 2) |
| `/blog/seo/`, `/blog/ecommerce/`, `/blog/trafego-pago/`, `/blog/seo/seo-local/`, `/blog/marketing-digital/` | **200, existem, estão no sitemap** |

Ou seja: os arquivos de categoria de verdade **já funcionam** e já são entregues
ao Google pelo `category-sitemap.xml`. Mas o portal nunca linkava para eles —
linkava para o `?editoria=`, que o próprio snippet marcava como `noindex`.

O resultado eram cinco arquivos de categoria **órfãos**: no sitemap, sem um único
link interno vindo da navegação do blog. Somados, cobrem 43 artigos. Link interno
é um dos sinais mais fortes de importância dentro do site, e essas páginas não
tinham nenhum.

E o `?editoria=` nunca poderia ranquear: `noindex` mais canonical apontando para
`/blog/`. Então as quatro editorias não rendiam nada organicamente — eram só um
filtro visual.

Havia ainda um detalhe: os slugs do snippet eram rótulos editoriais inventados,
não os slugs reais das categorias.

| No snippet | Categoria real no WordPress |
|---|---|
| `seo-geo` | `seo` (id 13) |
| `e-commerce` | `ecommerce` (id 14) |
| `varejo-local` | `seo-local` (id 17), em `/blog/seo/seo-local/` |
| `trafego-pago` | `trafego-pago` (id 15) — o único que batia |

### O que mudou

- O snippet passou a interceptar `is_category()`. As editorias agora moram em
  `/blog/seo/`, `/blog/trafego-pago/`, `/blog/ecommerce/` e `/blog/seo/seo-local/`,
  com o mesmo desenho de antes.
- Saiu o `noindex`. São arquivos legítimos, com endereço próprio.
- Os links do menu, do rodapé e dos botões "Ver editoria" apontam para o arquivo real.
- `/blog/?editoria=slug` passou a redirecionar com 301 para o arquivo, inclusive
  a partir dos slugs antigos — link já publicado não quebra.
- Categoria fora das quatro editorias (Marketing Digital, com 10 artigos, a maior
  de todas) também ganhou o desenho do portal. Antes cairia no template antigo
  do Elementor.

Treze cenários de rota conferidos num simulador antes de subir: portal, as quatro
editorias, a categoria extra, os três slugs antigos, um slug inexistente, post e
página comuns. Todos caem onde devem.

### Fica para você decidir

Os nomes das categorias no WordPress não batem com os rótulos do portal: o portal
chama de "SEO & GEO" o que o WordPress chama de "SEO", e de "Varejo Local" o que
o WordPress chama de "SEO Local". Como o `<title>` do Google vem do Rank Math e o
`<h1>` vem do nosso template, os dois vão divergir.

Dá para resolver renomeando a categoria no WordPress — **só o nome, sem tocar no
slug**, senão a URL muda e precisa de 301. Em `Posts → Categorias`, editar o campo
"Nome" e deixar o "Slug" como está.

### Conferido no ar em 30/07, depois da colagem

| Endereço | Resposta |
|---|---|
| `/blog/seo/`, `/blog/trafego-pago/`, `/blog/ecommerce/`, `/blog/seo/seo-local/`, `/blog/marketing-digital/` | 200, com o desenho do portal |
| `/blog/?editoria=seo-geo` | 301 → `/blog/seo/` |
| `/blog/?editoria=e-commerce` | 301 → `/blog/ecommerce/` |
| `/blog/?editoria=varejo-local` | 301 → `/blog/seo/seo-local/` |

A `/blog/seo/` responde `index, follow`, com canonical para ela mesma, um único
`<h1>` e os 16 artigos da editoria. Sem estouro horizontal em 1440 nem em 390 px.
O índice de títulos fecha em `h1 → h2 → h3`.

### 🟡 Sobrou: links velhos de categoria na busca do blog

O overlay de busca do blog (o "Ctrl K") traz um bloco "Categorias populares" com
três endereços desatualizados. Ele vem de **outro snippet**, que não está neste
repositório:

| Link no overlay | Situação | Deveria ser |
|---|---|---|
| `/blog/e-commerce/` | **301 para a home** — link quebrado | `/blog/ecommerce/` |
| `/blog/seo-local/` | 200, mas com canonical para o endereço aninhado | `/blog/seo/seo-local/` |
| `/blog/insights/` | 200, porém a categoria tem **0 artigos** | remover o link |

São três links internos apontando para lugar errado, um deles quebrado. É procurar
esses três endereços no snippet da busca e trocar.
