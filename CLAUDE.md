# SAL — Hub

## Design system (obrigatório)

Todo material visual da SAL — site (`sal-site/`), tema do blog (`blog-tema/sal-blog/`), capas (`sal-site/capas/`), artes e qualquer peça nova — segue o design system **Marinho & Coral**. Antes de criar ou estilizar qualquer coisa, leia a skill `.claude/skills/sal-design-system/SKILL.md` (regras, paleta, proibições anti-clichê) e os tokens reais em `sal-site/src/styles/tokens.css`. O projeto espelho no Claude Design é "SAL — Marinho & Coral"; o pacote sincronizado vive em `ds-bundle/` (pin em `.design-sync/config.json`).

## Publicação

O site e o tema do blog são publicados pela branch `publicacao-site` (a VPS puxa a cada 5 minutos via cron). O ritual de publicação e as convenções detalhadas estão no histórico da sessão de trabalho; em resumo: build do Astro em `sal-site/dist`, tema em `blog-tema/sal-blog` (bump de versão em `style.css` a cada publicação), commit das duas árvores na branch `publicacao-site`.
