# Portal SAL — Plano Mestre

> Documento de trabalho da transformação do site em portal da agência.
> Fontes: Notion da SAL (Estrutura do Novo Site, Sobre a SAL, Processo 4 Passos, Sobre Marcelo), SAL Hub (Playbook da Marca), blog/guia-de-redacao.md e blog/estrategia-seo.md. Copy final segue o guia de redação do blog (sem "PMEs", sem travessão, dados sempre com fonte e ano).

## 1. Posicionamento

- **Quem:** SAL Estratégias de Marketing. Assessoria, não agência de produção em massa. Liderada por Marcelo Freitas.
- **O quê:** SEO e Performance (mídia paga) + estruturação de e-commerce.
- **Para quem:** donos de e-commerce e lojas virtuais · varejo local (lojas de rua, lojas de shopping, negócios locais). Nunca "PMEs".
- **Slogan:** Marketing na Medida Certa, para e-commerces e varejo local.
- **Por que "SAL":** o sal na dose errada estraga o prato. Em excesso, salga; em falta, fica insosso. Marketing é igual: o desafio é a medida certa.
- **Essência S.A.L.:** Simplificar · Atrair · Libertar.
- **Método (4 passos, já definido no Notion):** Descobrir → Desenhar → Disparar → Decodificar.
- **Fatos:** Marcelo no marketing desde 2014 (entrou pela TI; varejo a partir de 2020, ~5 anos em shoppings; a década é DE MARKETING, não de varejo) · SAL concebida em 28/03/2024 numa conversa de bar entre três amigos (texto oficial do Marcelo, 2026-07-23) e fundada por Marcelo em 2024 · sede em Porto Alegre, atendimento Brasil todo (não liderar copy com POA) · sempre "assessoria", nunca "agência".

## 2. Arquitetura do portal

Cada página se comporta como landing page: conteúdo extenso e indexável + estrutura de conversão (prova, objeções, FAQ, CTA único).

| Página | Rota | Keyword-alvo primária | Papel |
|---|---|---|---|
| Home | `/` | marketing para e-commerce e varejo local (marca) | Posicionamento + roteamento pros 2 nichos |
| SEO para E-commerce | `/servicos/seo-para-ecommerce/` | seo para e-commerce, seo para loja virtual | LP de serviço nº 1 |
| SEO Local / Perfil da Empresa no Google | `/servicos/seo-local/` | seo local, otimização google meu negócio | LP de serviço nº 2 |
| Gestão de Tráfego Pago | `/servicos/gestao-trafego-pago/` (já existe) | gestão de tráfego pago, mídia paga para e-commerce | LP de serviço nº 3 |
| Estruturação de E-commerce | `/servicos/estruturacao-de-ecommerce/` | consultoria e-commerce, criar loja virtual | LP de serviço nº 4 |
| Diagnóstico | `/diagnostico/` (já existe) | diagnóstico de e-commerce, auditoria seo | Conversão principal do site inteiro |
| Quem Somos (SAL) | `/quem-somos/` | agência de marketing porto alegre / sal estratégias | História da SAL entrelaçada com a do Marcelo |
| Marcelo Freitas | `/marcelo-freitas/` | marcelo freitas marketing, consultor de seo | Autoridade pessoal (schema Person, E-E-A-T) |
| Blog (portal de conteúdo) | `/blog/` | (clusters do calendário editorial) | Já operando com automação diária |
| Materiais | `/materiais/` | planilha/checklist/guia + tema | Conteúdo rico p/ download → captura p/ newsletter |
| Newsletter | `/newsletter/` | newsletter marketing e-commerce | LP de assinatura do Substack (marcelofreitas.substack.com) |
| Contato | `/contato/` | — | Curta, WhatsApp em destaque |

Decisões de SEO/GEO transversais:
- Breadcrumbs com schema em tudo; FAQPage nas LPs; Service + Organization + Person; LocalBusiness na página de contato.
- Resposta direta nos primeiros 50-70 palavras de toda página (padrão GEO/AI Overviews do blog aplicado ao site inteiro).
- Interlink: toda LP de serviço → diagnóstico + 3-6 artigos do cluster correspondente; todo artigo → LP do cluster (já é regra do guia).
- Páginas de serviço com 1.500+ palavras reais (o tema atual já suporta; conteúdo entra via editor).

## 3. Diagnóstico SAL de E-commerce (estrutura v1)

Produto de entrada gratuito. Entregável: parecer com nota por área + 3 prioridades com impacto estimado em reais. Prazo de resposta: 1 dia útil (confirmar).

**Bloco A — Fundação técnica (SEO)**
1. Indexação e cobertura no Google Search Console (páginas válidas vs. excluídas)
2. Core Web Vitals e velocidade mobile
3. Arquitetura: categorias, filtros/facetas, conteúdo duplicado, canonicals
4. Dados estruturados: Product, Offer, Review, disponibilidade e preço

**Bloco B — Demanda e conteúdo**
5. Cobertura de keywords por intenção (produto, categoria, informacional)
6. Páginas de categoria com conteúdo (ou vazias)
7. Blog/conteúdo: existe? responde perguntas reais de compra?
8. Presença em AI Overviews / respostas de IA (GEO)

**Bloco C — Mídia paga**
9. Estrutura de campanhas (Shopping/PMax/Meta catálogo) e qualidade do feed
10. ROAS-alvo calculado com margem real (comissão, frete, imposto) ou chute?
11. Remarketing e públicos (quem visita e não compra)

**Bloco D — Conversão e retenção**
12. Página de produto: fotos, descrição, prova social, frete visível
13. Checkout e fricção (etapas, cadastro obrigatório, meios de pagamento)
14. Recompra: e-mail/WhatsApp/fluxos ativos ou cliente esquecido?

**Bloco E — Medição**
15. GA4 + eventos de e-commerce medindo o funil de verdade
16. Unit economics: CAC, ticket, margem por canal

**Variante Varejo Local (Diagnóstico SAL Local):**
1. Perfil da Empresa no Google: categorias, fotos, produtos, posts, atributos
2. Avaliações: volume, nota, taxa de resposta
3. Consistência NAP (nome/endereço/telefone) e presença em mapas
4. Busca "perto de mim": posição no raio de atuação
5. Site/LP local: velocidade, clique-para-ligar, rota, horários
6. Ads por raio: cobertura e desperdício de verba fora da área
7. Instagram local + WhatsApp comercial

## 4. Conteúdo rico + newsletter (Substack)

- Newsletter: **marcelofreitas.substack.com** — captação em: barra da home, meio de artigo (blog), rodapé, página `/newsletter/`, e gate leve dos materiais ricos (baixa em troca do e-mail → inscreve no Substack).
- Materiais v1: ✅ **Checklist de SEO para loja virtual** e ✅ **Checklist do Perfil da Empresa no Google** prontos em `site/materiais/*.pdf` (2 páginas cada, identidade v10, dados com fonte, CTA pro diagnóstico). Publicar: subir o PDF na media library, criar o Material no painel e colar o link.
- Materiais v1 restantes: Planilha de ROAS-alvo pela margem · Calendário comercial do varejo 2026-2027.
- Materiais v2: pesquisas próprias, infográficos, vídeos (a definir com Marcelo).

## 4b. Decisões tomadas (Marcelo, 2026-07-23)

- **Quem Somos:** duas páginas interligadas — `/quem-somos/` (SAL) + `/marcelo-freitas/` (schema Person, E-E-A-T).
- **Nome do diagnóstico:** **Diagnóstico SAL** ("Diagnóstico SAL de E-commerce" e "Diagnóstico SAL Local").
- **Newsletter:** formulário próprio no visual SAL apontando pro subscribe do Substack (leve, rastreável no GA4).
- **LPs de serviço:** as 4 confirmadas — SEO para E-commerce, SEO Local/Perfil da Empresa no Google, Gestão de Tráfego Pago, Estruturação de E-commerce.
- **Keywords e dados:** dossiê completo em `site/pesquisa-seo.md` (keywords por intenção, FAQs reais, padrões de concorrentes, dados com fonte).

## 4c. URLs já existentes no site atual (preservar equity, não quebrar)

Menu real de salestrategias.com.br (verificado em jul/2026): `/servicos/agencia-de-seo/` · `/servicos/gestao-de-trafego-pago/` · `/servicos/agencia-de-producao-de-conteudo/` · `/servicos/criacao-de-sites/` · `/servicos/consultoria/` · `/servicos/assessoria-de-google-meu-negocio/` · `/diagnostico/` · `/quem-somos/` · `/blog/`.

Mapeamento do plano para o real: a LP "SEO Local" evolui a página `/servicos/assessoria-de-google-meu-negocio/` (mantendo URL ou com 301 planejado); "SEO para E-commerce" é página NOVA (`/servicos/seo-para-ecommerce/`) irmã da `/servicos/agencia-de-seo/`; "Estruturação de E-commerce" pode evoluir `/servicos/criacao-de-sites/` + `/servicos/consultoria/` (decidir com Marcelo se funde ou cria nova). `/marcelo-freitas/` é nova.

## 5. Pendências de verdade (aguardando Marcelo)

- ✅ Trajetória 2014-2024: respondida (áudio 2026-07-23) + texto do site atual. Copy rascunhada em `site/copy/`.
- ✅ O clique de 2024: "criar um negócio meu que fizesse marketing da maneira correta, sem enganação, sem guru".
- ✅ Certificações: Marketing Exponencial (StartSe) + especialização Head de Marketing (The CMOs).
- ✅ Números: NÃO publicar quantidade de clientes nem resultados da SAL (assessoria nova). Prova social = empreendimentos da carreira que seguem clientes hoje: Rua da Praia Shopping, Lindóia Shopping e Galeria Chaves Barcellos (consultoria). Tavi Papelaria não é mais cliente: não citar. Números de era-carreira (ex.: 23 lojas) fora da copy.
- ✅ Materiais ricos: nada pronto; desenvolver para download (começar pelos 4 propostos no item 4).
- ✅ Fotos: Marcelo tem fotos da trajetória para a página dele (aguardar envio dos arquivos).
- ✅ Marcas da carreira: citar de forma sutil e claramente como relações da trajetória (não clientes da SAL); Bistek Supermercados e Laghetto Hotéis incluídas. "23 lojas" só como menção discreta no texto do Marcelo (case da era Ponto Pronto, com equipe).
- ✅ Time: não citar time da SAL; a página do Marcelo é a única página de pessoas. Redes na página dele: LinkedIn pessoal (URL pendente), Instagram (confirmar pessoal ou @salestrategias), Substack.
- ✅ Contatos reais no tema: WhatsApp 5551993380278, @salestrategias, LinkedIn company (padrões do Personalizar).
- ✅ Lado pessoal: cinema/audiovisual/escrita (palavras dele, 2026-07-23), na copy.
- ✅ LinkedIn pessoal: https://www.linkedin.com/in/mcfreitas · ✅ 6 fotos recebidas (plano de posicionamento na copy do Marcelo; subir na media library no deploy).
- ✅ Certificações sem anos (decisão do Marcelo).
- Qual Instagram usar na página do Marcelo (pessoal ou @salestrategias).

## 5b. Diagnóstico atual (/diagnostico/) — analisado em jul/2026

Quiz interativo: headline "Onde o seu marketing está travando?", 5 perguntas com progresso (00/05) → "Sua leitura" (resumo na hora) → formulário (Nome*, WhatsApp*, E-mail*, Site/Instagram opcional, Tipo de negócio: E-commerce / Varejo físico / Negócio local / B2B / Mídia / Outro) → botão "Receber diagnóstico e agendar conversa". Promessas: resposta em até 1 dia útil, gratuito, sem compromisso, conversa de 30 min. CTA alternativo de WhatsApp.

**Preservar na evolução:** a mecânica de quiz (5 perguntas + leitura imediata), as promessas (1 dia útil, 30 min) e o dropdown de tipo de negócio. **Evoluir:** ramificar a leitura por nicho (e-commerce vs. local) usando os blocos do Diagnóstico SAL (item 3), e conectar o resultado às LPs de serviço correspondentes. O código-fonte da página vive em outra sessão do Claude; recuperar de lá quando formos reconstruí-la no tema.

## 5c. Assets reais disponíveis no repo (`preview/`)

`sal-logo.svg`, `sal-logo-color.svg`, `logo-sal-white.svg`, `logo-sal-horizontal-purple.png`, `logo-marcelo.png`, `logo-estrategias.png`, `brandkit-sal.png` — usar o logo real no tema (custom logo) em vez do wordmark de fallback.

## 6. Sequência de implementação

1. ✅ Tema base (PR #1)
2. Pesquisa de keywords (agente rodando) → enriquecer as LPs deste plano
3. Respostas do Marcelo → copy verdadeira das páginas
4. Templates/páginas novas no tema (materiais, newsletter, LP de serviço com FAQ/schema)
5. Copy página a página (Home → Diagnóstico → SEO E-commerce → SEO Local → Quem Somos → Marcelo → demais)
