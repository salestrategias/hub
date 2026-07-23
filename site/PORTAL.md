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
- **Fatos:** Marcelo no marketing desde 2014 · SAL fundada em 2024 · sede em Porto Alegre, atendimento Brasil todo (não liderar copy com POA).

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
- Materiais v1 (produzíveis sem pesquisa nova): Checklist de SEO para loja virtual (PDF) · Planilha de ROAS-alvo pela margem · Checklist do Perfil da Empresa no Google · Calendário comercial do varejo 2026-2027.
- Materiais v2: pesquisas próprias, infográficos, vídeos (a definir com Marcelo).

## 4b. Decisões tomadas (Marcelo, 2026-07-23)

- **Quem Somos:** duas páginas interligadas — `/quem-somos/` (SAL) + `/marcelo-freitas/` (schema Person, E-E-A-T).
- **Nome do diagnóstico:** **Diagnóstico SAL** ("Diagnóstico SAL de E-commerce" e "Diagnóstico SAL Local").
- **Newsletter:** formulário próprio no visual SAL apontando pro subscribe do Substack (leve, rastreável no GA4).
- **LPs de serviço:** as 4 confirmadas — SEO para E-commerce, SEO Local/Perfil da Empresa no Google, Gestão de Tráfego Pago, Estruturação de E-commerce.
- **Keywords e dados:** dossiê completo em `site/pesquisa-seo.md` (keywords por intenção, FAQs reais, padrões de concorrentes, dados com fonte).

## 5. Pendências de verdade (aguardando Marcelo)

- Trajetória 2014-2024: cargos, empresas, papel no FIT e no Festival de Cinema de Gramado, formação.
- O momento/clique da fundação da SAL em 2024.
- Certificações reais (não publicar nenhuma sem confirmação).
- Números verdadeiros utilizáveis (clientes, verba gerida, resultados) e quais clientes podem ser citados como case (Lindóia Shopping? Rua da Praia? Tavi?).
- Nome público do diagnóstico e funcionamento atual do formulário em /diagnostico/.
- Foto profissional + lado pessoal (humanizar página do Marcelo).

## 6. Sequência de implementação

1. ✅ Tema base (PR #1)
2. Pesquisa de keywords (agente rodando) → enriquecer as LPs deste plano
3. Respostas do Marcelo → copy verdadeira das páginas
4. Templates/páginas novas no tema (materiais, newsletter, LP de serviço com FAQ/schema)
5. Copy página a página (Home → Diagnóstico → SEO E-commerce → SEO Local → Quem Somos → Marcelo → demais)
