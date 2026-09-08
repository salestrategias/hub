---
name: sal-design-system
description: Design system oficial da SAL Estratégias de Marketing (Marinho & Coral). Use SEMPRE que criar QUALQUER material visual ou digital da SAL — site, landing page, artifact, apresentação, slide, PDF, documento, card de rede social, capa de post do blog, banner, anúncio, e-mail, relatório, mockup, protótipo ou peça de marca. Dispara para - criar algo "da SAL", "para a SAL", material da marca, identidade visual da SAL, padrão visual, cores da SAL, capa de post, card de Instagram, arte para redes. Toda criação visual da SAL nasce deste sistema, sem exceção.
---

# SAL — Design System Marinho & Coral

Todo material da SAL usa este sistema. Nunca invente paleta, fonte ou componente novo: os tokens completos estão em `references/tokens.css` (leia antes de estilizar) e o template de capa/card em `references/capa-template.html`. O projeto no Claude Design é "SAL — Marinho & Coral" (https://claude.ai/design/p/b42ba4c4-feeb-4f06-8fc3-7c18aec2ff0d).

## Paleta (tema escuro é o padrão)

- **Fundos (escada, nunca fora dela)**: `#0B1526` → `#0F1E3A` → `#152848` → `#1B3156`. Borda única: `#29426B`.
- **Coral — o ÚNICO acento (≤5% da peça)**: `#FF6B66` (hover `#FF8D85`, profundo `#C43C3C`). Botões primários, links de ação, grãos de sal, ícones de traço.
- **Lima `#F6FF74` — SÓ marca-texto**: destaque de um termo-chave (fundo lima, texto `#12203A`). Nunca em botões, nunca em fundos.
- **Osso (seções claras / tema claro)**: fundo `#F1F4FA`/`#F8FAFD`, tinta `#12203A`, texto `#46587A`, borda `#D9E1EF`. No claro, o coral escurece para `#C43C3C`.
- **Azul violeta `#3D6FE0`**: papel de suporte (hover, foco, ilustração) — nunca protagonista.

## Tipografia

- **Títulos (h1/h2)**: Newsreader, peso 600 — NUNCA 700/bold pesado. Tracking levemente negativo.
- **Subtítulos, rótulos e UI (h3/h4)**: Plus Jakarta Sans 600–700.
- **Corpo**: Inter. Fora do repositório, carregue as três do Google Fonts.
- Ênfase dentro de título: `<em>` sem itálico, cor coral (ex.: "<em>Marketing na Medida Certa</em> para te ajudar a vender mais e melhor.").

## Assinaturas da marca

- **Grão de sal**: losango coral (quadrado ~5px rotacionado 45°). É O separador entre itens e o marcador vivo. Fileiras usam opacidade decrescente.
- **Logo**: SOMENTE o wordmark "Sal" (branco no escuro, tinta no claro). Nunca o ícone de lâmpada.
- **CTA padrão**: "Contrate a SAL" — um botão primário coral (pílula) por tela. Secundário: fantasma com borda.

## Proibições (anti-clichê de IA) — inegociáveis

1. Nunca usar "·" como separador — use o grão de sal.
2. Nunca setas "↗" em botões ou links — a seta da casa é "→".
3. Nunca degradês em cards de rede social — fundo marinho liso.
4. Nunca rótulos-clichê de seção ("o problema", "a solução", "por que nós").
5. Nunca cápsulas com pontinho, linhas decorativas ou travessões em excesso.
6. Não usar "mais e melhor" fora do h1 oficial do site (é mote de concorrente).
7. Sem fotos de banco de imagem em peças de marca.

## Peças prontas

- **Capa de post do blog (1200×675)**: marinho com dois véus radiais sutis (azul topo-direita, coral base-esquerda), editoria em coral uppercase com grão, título Newsreader ~88px com UM termo em marca-texto lima, wordmark + "Blog da SAL" e tempo de leitura no rodapé.
- **Card de Instagram (1080×1080)**: mesma gramática, porém marinho LISO (sem véus) e rodapé só com wordmark + @salestrategias — sem endereço de site. Título ~96px.
- **Site/landing**: seções com muito respiro, h2 serif de frase inteira com ponto final, cards com borda `#29426B` e raio 16px, prova social em chips brancos só com logos.

## Tom que acompanha o visual

Copy direta, de vendedor experiente (inspiração V4 Company): frases curtas, promessa concreta, zero jargão de agência. Títulos afirmam, não perguntam (exceto o CTA final: "Pronto para escalar as suas vendas?").
