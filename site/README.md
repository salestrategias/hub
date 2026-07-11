# Site SAL — Tema WordPress próprio

Tema **`sal`** (v1.0.0) para o novo site institucional em https://salestrategias.com.br. Identidade v10 (a mesma do gerador de capas do blog): papel `#F8F6F2`, ink `#0A0A0F`, roxo `#7E30E1`, lima `#F6FF74` em micro-uso, Plus Jakarta Sans + Inter self-hosted.

## Princípios

| Objetivo | Como o tema entrega |
|---|---|
| **Rápido** | Zero dependências (sem jQuery, sem framework), 1 CSS + 1 JS (~2 KB, defer), fontes variáveis self-hosted (2 arquivos woff2, ~75 KB, com preload), emoji script removido, cabeçalho enxuto |
| **Seguro** | XML-RPC desligado (a REST API do blog continua ativa), versão do WP oculta, erro de login genérico, headers `nosniff`/`SAMEORIGIN`/`Referrer-Policy`, toda saída escapada |
| **SEO** | Semântica correta (um `h1` por página), meta description + Open Graph + JSON-LD (Organization/WebSite/Article) — **só quando não há Rank Math/Yoast/SEOPress ativo**, para não duplicar tags |
| **Simples** | Sem page builder. Textos que mudam (hero, números, depoimento, CTA, contato) editam-se em **Aparência → Personalizar → SAL** |
| **Acessível** | Skip link, foco visível, contraste AA, `prefers-reduced-motion` respeitado, menu mobile com `aria-expanded` |

## Estrutura

```
site/wp-content/themes/sal/
├── style.css              # cabeçalho do tema + todo o CSS (design system v10)
├── functions.php          # só require dos módulos abaixo
├── inc/
│   ├── setup.php          # suportes, menus, tamanhos de imagem
│   ├── assets.php         # enqueue com filemtime + preload de fontes
│   ├── performance.php    # cabeçalho enxuto, sem emoji, sem jQuery
│   ├── security.php       # endurecimento no nível do tema
│   ├── seo.php            # metas/OG/schema de fallback (desliga com plugin de SEO)
│   ├── customizer.php     # campos editáveis do Personalizar
│   └── template-tags.php  # helpers (logo, card de post, whatsapp, paginação)
├── front-page.php         # home institucional (hero → números → nichos → serviços → método → depoimento → blog → CTA)
├── header.php / footer.php
├── index / archive / search / single / page / 404 / comments / searchform
├── templates/pagina-conversao.php  # landing sem menu (p/ campanhas e /diagnostico/)
└── assets/ (fonts woff2, js/main.js, css/editor.css)
```

## Instalação (Hostinger / qualquer WP)

1. Compacte a pasta do tema: `cd site/wp-content/themes && zip -r sal.zip sal`
2. No painel: **Aparência → Temas → Adicionar novo → Enviar tema** → `sal.zip` → ativar.
3. **Aparência → Personalizar → SAL — conteúdo do site**: preencha WhatsApp, e-mail, redes e revise os textos da home (todos já vêm com padrão).
4. **Configurações → Leitura**: "Sua página inicial exibe" → *Uma página estática*; crie a página "Início" (a home usa `front-page.php` automaticamente) e aponte "Página de posts" para a página "Blog".
5. **Aparência → Menus**: crie o menu principal (locais: *Menu principal* e *Menu do rodapé*). Sem menu criado, o tema mostra âncoras das seções da home.
6. Página `/diagnostico/`: crie a página e, se quiser sem menu (campanha), selecione o template **Página de conversão (sem menu)**.

## Recomendações fora do tema (wp-config.php / servidor)

```php
define( 'DISALLOW_FILE_EDIT', true );  // sem editor de código no painel
define( 'WP_AUTO_UPDATE_CORE', 'minor' );
```

- Cache de página (LiteSpeed Cache na Hostinger, ou WP Super Cache) + HTTPS já cobrem o resto do desempenho.
- O snippet WPCode do blog (`blog/wpcode-rankmath-rest.php`) continua necessário para a rotina de publicação.

## Compatibilidade com o blog atual

O tema estiliza `single.php`/`archive.php` com a mesma identidade do portal do blog (WPCode v10). Rank Math ativo ⇒ o SEO de fallback do tema se desliga sozinho — sem tags duplicadas. A automação diária de artigos (REST API) não é afetada.
