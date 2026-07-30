# Como publicar o site na Hostinger

O site novo é estático: são arquivos HTML prontos. Ele convive com o WordPress
no mesmo domínio, sem subdomínio e sem quebrar nenhuma URL de post.

## Como os dois convivem

O `.htaccess` padrão do WordPress já termina com esta regra:

```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
```

Ou seja: **arquivo ou pasta que existir em disco é servido direto; só o que não
existir cai no WordPress.** É exatamente o que a gente precisa. Na prática:

| Endereço | Quem responde |
|---|---|
| `/` | `index.html` do site novo |
| `/seo-local/`, `/quem-somos/`, `/agenda/` … | pastas do site novo |
| `/drive-to-store-como-funciona/` e os outros 40 posts | WordPress, URLs intactas |
| `/blog/`, `/wp-admin/`, `/wp-json/` | WordPress |

Nenhum post muda de endereço.

## Passo a passo

### 1. Gerar o site

```bash
cd sal-site
npm install
npm run build          # gera a pasta dist/
```

Antes do build, crie o arquivo `.env` a partir do `.env.example` e preencha o
que já existir. As duas variáveis são opcionais: sem elas o site funciona, só
sem agenda no Calendar e sem medição.

### 2. Subir os arquivos

Envie **o conteúdo de `dist/`** para a raiz do site (`public_html/`), sem
sobrescrever o que é do WordPress:

- ✅ pode subir: `index.html`, `404.html`, as pastas de cada página, `_astro/`,
  `fonts/`, `img/`, `favicon.svg`, `robots.txt`, `sitemap.xml`
- ⛔ **não apague**: `wp-admin/`, `wp-includes/`, `wp-content/`, `wp-config.php`,
  `index.php`, `.htaccess`

O `index.html` passa a responder pela home no lugar do WordPress. O `index.php`
continua lá, atendendo os posts.

### 3. Juntar o `.htaccess`

Este é o único passo que exige atenção. Abra o `.htaccess` da raiz e **cole o
conteúdo de `public/.htaccess` ANTES do bloco `# BEGIN WordPress`**. A ordem
importa: os redirecionamentos precisam rodar antes das regras do WordPress.

O resultado fica assim:

```apache
# ... tudo que veio de public/.htaccess ...

# BEGIN WordPress
# ... o bloco original do WordPress, intacto ...
# END WordPress
```

Faça uma cópia do `.htaccess` antes de mexer.

### 4. Conferir

Depois de subir, teste cada item:

```bash
# a home é a nova?
curl -sI https://salestrategias.com.br/ | head -1

# os posts continuam de pé?
curl -sI https://salestrategias.com.br/drive-to-store-como-funciona/ | head -1

# os redirecionamentos funcionam? (deve dar 301)
curl -sI https://salestrategias.com.br/servicos/gestao-de-trafego-pago/ | head -2

# os cabeçalhos de segurança chegaram?
curl -sI https://salestrategias.com.br/ | grep -i "content-security\|x-frame\|strict-transport"
```

No navegador, confira ainda: a barra de cookies aparece, o WhatsApp flutuante
funciona, e `/agenda/` mostra os dias.

### 5. Avisar o Google

1. No Search Console, envie `https://salestrategias.com.br/sitemap.xml`.
2. Peça indexação das páginas novas mais importantes: `/`, `/seo-local/`,
   `/seo-para-ecommerce/`, `/trafego-pago/`.
3. Acompanhe o relatório de cobertura por duas semanas. Os 301 fazem o Google
   transferir o histórico das URLs antigas, mas leva algumas semanas.

## O mapa de redirecionamento

Dezenove URLs antigas do WordPress apontam para as páginas novas equivalentes:

| Antiga | Nova |
|---|---|
| `/servicos/gestao-de-trafego-pago/` | `/trafego-pago/` |
| `/servicos/anunciar-no-google-ads-e-instagram/` | `/trafego-pago/` |
| `/servicos/aparecer-no-google-meu-negocio/` | `/seo-local/` |
| `/servicos/assessoria-de-google-meu-negocio/` | `/seo-local/` |
| `/servicos/como-melhorar-o-posicionamento-no-google/` | `/seo-local/` |
| `/servicos/agencia-de-seo/` | `/seo-para-ecommerce/` |
| `/servicos/seo-para-ecommerce/` | `/seo-para-ecommerce/` |
| `/servicos/agencia-de-producao-de-conteudo/` | `/seo-para-ecommerce/` |
| `/servicos/como-aumentar-vendas-no-e-commerce/` | `/e-commerce/` |
| `/servicos/estruturacao-de-ecommerce/` | `/e-commerce/` |
| `/servicos/criacao-de-sites/` | `/diagnostico-de-site/` |
| `/servicos/consultoria/` | `/quem-somos/` |
| `/servicos/` | `/quem-somos/` |
| `/diagnostico/` | `/agenda/` |
| `/contato/` | `/agenda/` |
| `/newsletter/` | `/blog/` |
| `/home-v6/`, `/home-v7/` | `/` |

## Um problema do WordPress que continua de pé

Hoje o site responde **200 com a home para qualquer endereço inventado**. Um
`/asdfghjkl/` devolve a página inicial em vez de um erro 404. Isso é um convite
para o Google indexar lixo infinito.

O `.htaccess` novo define `ErrorDocument 404 /404.html`, mas isso só vale para
o que não passa pelo WordPress. **A causa está dentro do WordPress** e precisa
ser resolvida lá, provavelmente num snippet do WPCode que intercepta as páginas.
Fica como tarefa separada, junto da correção da fonte no blog.

## Segurança: o que já está resolvido

- **Site estático**: sem banco de dados, sem login, sem PHP. Não há o que
  injetar nem o que enumerar.
- **Cabeçalhos**: CSP restritiva, HSTS por dois anos, `nosniff`,
  `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- **Listagem de diretórios desligada** e arquivos de configuração bloqueados
  (`.env`, `.json`, `.md`, `.log`, `.sql` e afins).
- **Sem mapas de origem** em produção: eles publicariam o código-fonte inteiro.
- **Sem comentários** no HTML, no CSS e no JavaScript entregues.
- **Links externos** todos com `rel="noopener"`.
- **Dependências**: zero vulnerabilidades conhecidas.
- **Agenda**: escapa todo dado do usuário antes de escrever na página, e o
  endereço do Apps Script é público por natureza (ele só cria evento e envia
  e-mail; não expõe dado nenhum na leitura).

O que continua sendo responsabilidade do WordPress: senha forte no admin, dois
fatores, plugins atualizados e o Loginizer que já está lá.
