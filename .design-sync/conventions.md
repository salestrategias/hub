# SAL — Marinho & Coral: como construir com este sistema

Sistema em CSS puro (sem componentes JS). Tudo que um design recebe vem do fecho de imports de `styles.css` → `tokens/tokens.css` + `_ds_bundle.css`. Leia esses dois arquivos antes de estilizar: os tokens definem a linguagem; o bundle traz as classes prontas.

## Regras que definem a marca
- **Fundos** só pela escada `var(--bg)` → `--bg-2` → `--surface` → `--surface-2`. **Borda é sempre `var(--line)`** — uma só.
- **Coral (`--gold`) é o único acento**, em ≤5% da tela: `.btn-primary`, `.vai`, `.grao-sep`, ícones de traço.
- **Lima (`--lima`, #F6FF74) apenas como marca-texto** (`.grifo`, sobre seção clara `.bone`) e nas peças de marca (`.grifo-lima` nas capas). Nunca em botões ou fundos.
- **Tipografia**: h1/h2 em `var(--display)` (Newsreader 600 — nunca 700); h3/h4 e UI em `var(--sans)`; corpo em `var(--body)`. Ênfase em h1: `<em>` sem itálico, cor coral.
- **Separador é o grão de sal** `<i class="grao-sep"></i>` — o caractere "·" é proibido. Setas de link são "→", nunca "↗". CTA padrão: **"Contrate a SAL"**, um `.btn-primary` por tela.
- **Tema claro** existe e é automático: `data-tema="claro"` no `<html>` troca os tokens. O escuro é o padrão. Nunca fixe cor de texto/fundo em hex quando houver token.

## Vocabulário pronto (em `_ds_bundle.css`)
`.wrap` (grade de 1160px) · `.sec`/`.sec-sm` (respiro de seção) · `.cabeca` (título+lead) · `.btn .btn-primary|.btn-ghost` · `.vai` · `.grao-sep` · `.pulso` · `.grifo` · `.bone` (seção clara) · `.servicos > .servico` · `.artigos > .artigo` (com `.artigo-cat`, `.artigo-meta`) · `.eco.eco-compacto > .eco-linha` · `.clientes > .cliente > .cliente-logo` · `.band` (CTA final) · `.capa`/`.capa-social` (peças de marca, tamanho fixo, sempre marinho).

## Exemplo idiomático
```html
<section class="sec">
  <div class="wrap">
    <div class="cabeca"><h2>O que a SAL entrega.</h2><p>Lead curto em uma frase.</p></div>
    <div class="servicos">
      <a class="servico" href="#">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>
        <h3>Serviço</h3><p>Uma frase de valor.</p>
        <span class="vai">Conhecer o serviço →</span>
      </a>
    </div>
  </div>
</section>
```
