"""
Monta o documento de revisão de copy das páginas internas a partir do HTML
que o Astro realmente gerou. Assim o que o Marcelo revisa é exatamente o que
está no site, sem risco de eu transcrever errado.
"""
import re, html, pathlib, sys

DIST = pathlib.Path('/home/user/hub/sal-site/dist')

PAGINAS = [
    ('seo-local',            'SEO local'),
    ('seo-para-ecommerce',   'SEO para e-commerce'),
    ('trafego-pago',         'Tráfego pago'),
    ('diagnostico-de-site',  'Diagnóstico de site e loja virtual'),
    ('varejo-local',         'Varejo local'),
    ('e-commerce',           'E-commerce'),
]


def limpo(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def todos(padrao, texto, flags=re.S):
    return [limpo(m) for m in re.findall(padrao, texto, flags)]


def um(padrao, texto, flags=re.S):
    m = re.search(padrao, texto, flags)
    return limpo(m.group(1)) if m else ''


def bloco(tag_abre, texto):
    """Recorta de tag_abre até o fechamento da seção, de forma tolerante."""
    i = texto.find(tag_abre)
    return texto[i:] if i >= 0 else ''


def extrai_servico(slug):
    h = (DIST / slug / 'index.html').read_text(encoding='utf-8')
    d = {}
    d['title'] = um(r'<title>(.*?)</title>', h)
    d['desc'] = um(r'<meta name="description" content="(.*?)"', h)

    capa = h[h.find('class="capa"'):h.find('id="problema"')]
    d['rotulo'] = um(r'class="eyebrow">(.*?)</span>', capa)
    d['h1'] = um(r'<h1>(.*?)</h1>', capa)
    d['sub'] = um(r'class="sub">(.*?)</p>', capa)
    d['chips'] = todos(r'<li>(.*?)</li>', um(r'(<ul class="chips">.*?</ul>)', capa) or '')
    # o um() já limpou as tags; refaz a extração sobre o HTML cru dos chips
    chips_html = re.search(r'<ul class="chips">(.*?)</ul>', capa, re.S)
    d['chips'] = todos(r'<li>(.*?)</li>', chips_html.group(1)) if chips_html else []

    prob = h[h.find('id="problema"'):h.find('id="como"')]
    d['problema_h2'] = um(r'<h2>(.*?)</h2>', prob)
    d['problema_p'] = todos(r'<p class="corpo">(.*?)</p>', prob)
    lista = re.search(r'<ul class="lista-grao">(.*?)</ul>', prob, re.S)
    d['problema_li'] = todos(r'<li>(.*?)</li>', lista.group(1)) if lista else []

    como = h[h.find('id="como"'):h.find('id="entregas"')]
    d['etapas_h2'] = um(r'<h2>(.*?)</h2>', como)
    d['etapas'] = [(limpo(a), limpo(b), limpo(c)) for a, b, c in
                   re.findall(r'<b>(.*?)</b>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>', como, re.S)]

    ent = h[h.find('id="entregas"'):]
    fim = ent.find('id="metrica"')
    if fim < 0:
        fim = ent.find('id="duvidas"')
    ent = ent[:fim]
    d['entregas_h2'] = um(r'<h2>(.*?)</h2>', ent)
    d['entregas'] = [(limpo(a), limpo(b)) for a, b in
                     re.findall(r'<h3>(.*?)</h3>\s*<p>(.*?)</p>', ent, re.S)]

    met = h[h.find('id="metrica"'):h.find('id="duvidas"')] if 'id="metrica"' in h else ''
    d['metrica_h2'] = um(r'<h2>(.*?)</h2>', met) if met else ''
    d['metrica_p'] = um(r'class="destaque">(.*?)</p>', met) if met else ''

    faq = h[h.find('id="duvidas"'):h.find('id="proximos"')]
    d['faq'] = [(limpo(a), limpo(b)) for a, b in
                re.findall(r'<summary>(.*?)</summary>\s*<div><p>(.*?)</p></div>', faq, re.S)]

    prox = h[h.find('id="proximos"'):]
    band = prox[prox.find('class="band"'):]
    d['proximos'] = todos(r'<a href="[^"]*">(.*?)</a>', prox[:prox.find('class="band"')])
    d['cta_h2'] = um(r'<h2>(.*?)</h2>', band)
    d['cta_p'] = um(r'class="sub">(.*?)</p>', band)
    return d


def campo(rot, valor, nota=''):
    if not valor:
        return ''
    s = f'**{rot}** {nota}\n{valor}\n`>> AJUSTE:`\n\n' if nota else f'**{rot}**\n{valor}\n`>> AJUSTE:`\n\n'
    return s


def bloco_servico(slug, nome, d, n):
    o = [f'\n---\n\n# {n}. Página “{nome}” — /{slug}/\n']
    o.append(f'*Título no Google:* `{d["title"]}`  \n*Descrição no Google:* `{d["desc"]}`\n`>> AJUSTE:`\n')
    o.append('\n## Primeira dobra\n')
    o.append(campo('Rótulo', d['rotulo']))
    o.append(campo('Título', d['h1'], '*(o trecho final aparece em dourado)*'))
    o.append(campo('Chamada', d['sub']))
    if d['chips']:
        o.append('**Etiquetas de escopo**\n' + ' · '.join(d['chips']) + '\n`>> AJUSTE:`\n\n')
    o.append('\n## O problema\n')
    o.append(campo('Título', d['problema_h2'], '*(é o argumento central da página)*'))
    for i, p in enumerate(d['problema_p'], 1):
        o.append(campo(f'Parágrafo {i}', p))
    if d['problema_li']:
        o.append('**Lista de sintomas**\n' + '\n'.join('- ' + x for x in d['problema_li']) + '\n\n`>> AJUSTE:`\n\n')
    o.append('\n## Como funciona\n')
    o.append(campo('Título', d['etapas_h2']))
    for a, b, c in d['etapas']:
        o.append(campo(f'{a} {b}', c))
    o.append('\n## O que está incluído\n')
    o.append(campo('Título', d['entregas_h2']))
    for t, x in d['entregas']:
        o.append(campo(t, x))
    if d['metrica_h2']:
        o.append('\n## A conta que interessa\n')
        o.append(campo('Título', d['metrica_h2']))
        o.append(campo('Texto', d['metrica_p'], '*(seção em fundo claro, é o ponto alto da página)*'))
    o.append('\n## Perguntas frequentes\n')
    for i, (p, r) in enumerate(d['faq'], 1):
        o.append(campo(f'{i}. {p}', r))
    if d['proximos']:
        o.append('\n## Continue por aqui\n')
        o.append('**Links do rodapé da página**\n' + '\n'.join('- ' + x for x in d['proximos']) + '\n\n`>> AJUSTE:`\n\n')
    o.append('\n## Chamada final\n')
    o.append(campo('Título', d['cta_h2']))
    o.append(campo('Texto', d['cta_p']))
    return ''.join(o)


# ---------------------------------------------------------------- institucionais
def extrai_quem_somos():
    h = (DIST / 'quem-somos' / 'index.html').read_text(encoding='utf-8')
    d = {'title': um(r'<title>(.*?)</title>', h), 'desc': um(r'<meta name="description" content="(.*?)"', h)}
    capa = h[h.find('class="capa"'):h.find('<section class="sec">')]
    d['h1'] = um(r'<h1>(.*?)</h1>', capa)
    d['sub'] = um(r'class="sub">(.*?)</p>', capa)
    corpo = h[h.find('Uma conversa de bar'):]
    d['historia_h2'] = 'Uma conversa de bar em 28 de março de 2024.'
    d['historia_p'] = todos(r'<p class="corpo">(.*?)</p>', corpo[:corpo.find('O que sustenta')])
    blocos = re.findall(r'<b>(.*?)</b><h3>(.*?)</h3><p>(.*?)</p>', h, re.S)
    d['blocos'] = [(limpo(a), limpo(b), limpo(c)) for a, b, c in blocos]
    band = h[h.find('class="band"'):]
    d['cta_h2'] = um(r'<h2>(.*?)</h2>', band)
    d['cta_p'] = um(r'class="sub">(.*?)</p>', band)
    return d


def extrai_marcelo():
    h = (DIST / 'marcelo-freitas' / 'index.html').read_text(encoding='utf-8')
    d = {'title': um(r'<title>(.*?)</title>', h), 'desc': um(r'<meta name="description" content="(.*?)"', h)}
    d['h1'] = um(r'<h1>(.*?)</h1>', h)
    d['sub'] = um(r'class="sub">(.*?)</p>', h)
    d['paragrafos'] = todos(r'<p class="corpo(?: destaque-linha)?">(.*?)</p>', h)
    d['legendas'] = todos(r'<figcaption>(.*?)</figcaption>', h)
    d['fora_h2'] = um(r'<h2>(Cinema.*?)</h2>', h)
    band = h[h.find('class="band"'):]
    d['cta_h2'] = um(r'<h2>(.*?)</h2>', band)
    d['cta_p'] = um(r'class="sub">(.*?)</p>', band)
    return d


# ---------------------------------------------------------------- montagem
partes = ["""# Revisão de copy — Páginas internas do site da SAL

> Documento de trabalho, gerado em 28/07/2026 a partir do que está publicado nas páginas.
> Escreva o seu ajuste na linha **`>> AJUSTE:`** logo abaixo de cada bloco.
> O que ficar em branco eu mantenho como está.

São nove páginas novas. As seis primeiras seguem a mesma estrutura, de propósito:
dor no título → promessa → escopo → o problema → quatro etapas → seis entregáveis →
a conta que interessa → perguntas frequentes → chamada final. Repetir a estrutura ajuda
o Google e evita que cada página invente a sua.

**Onde vale gastar mais atenção:**

1. O **título e a chamada** de cada página. São o que aparece no Google e o que decide se
   a pessoa fica.
2. O **título do problema**, que é o argumento central de cada página.
3. A **conta que interessa**, a seção em fundo claro. É onde cada página joga o argumento
   mais forte, e é onde eu mais me arrisquei.
4. Os **números e prazos** nas perguntas frequentes: R$ 2.000, R$ 1.500, 90 dias, 6 meses,
   30 dias de aviso. Se algum estiver errado, é o tipo de erro que custa caro.

**Um dado que eu preciso que você confira:** na página de SEO local eu escrevi que
“sete em cada dez buscas por comércio local terminam em visita ou contato no mesmo dia”.
É um número que circula muito no mercado, mas eu não consegui rastrear a fonte primária.
Se você não tiver a referência, eu prefiro trocar por uma formulação sem número.
`>> RESPOSTA:`
"""]

n = 0
for slug, nome in PAGINAS:
    n += 1
    partes.append(bloco_servico(slug, nome, extrai_servico(slug), n))

# quem somos
qs = extrai_quem_somos()
n += 1
o = [f'\n---\n\n# {n}. Página “Quem somos” — /quem-somos/\n']
o.append(f'*Título no Google:* `{qs["title"]}`  \n*Descrição no Google:* `{qs["desc"]}`\n`>> AJUSTE:`\n\n')
o.append(campo('Título', qs['h1']))
o.append(campo('Chamada', qs['sub']))
o.append('\n## A história da SAL\n')
o.append(campo('Título', qs['historia_h2']))
for i, p in enumerate(qs['historia_p'], 1):
    o.append(campo(f'Parágrafo {i}', p, '*(este é o texto oficial que você me passou, adaptado)*' if i == 1 else ''))
o.append('\n## Pilares, territórios e método\n')
for a, b, c in qs['blocos']:
    o.append(campo(f'{a} {b}', c))
o.append('\n## Chamada final\n')
o.append(campo('Título', qs['cta_h2']))
o.append(campo('Texto', qs['cta_p']))
partes.append(''.join(o))

# marcelo
mf = extrai_marcelo()
n += 1
o = [f'\n---\n\n# {n}. Página “Marcelo Freitas” — /marcelo-freitas/\n']
o.append(f'*Título no Google:* `{mf["title"]}`  \n*Descrição no Google:* `{mf["desc"]}`\n`>> AJUSTE:`\n\n')
o.append(campo('Título', mf['h1']))
o.append(campo('Chamada', mf['sub']))
o.append('\n## A biografia\n*Este é o texto que você me mandou. Mantive praticamente como estava.*\n\n')
for i, p in enumerate(mf['paragrafos'], 1):
    o.append(campo(f'Parágrafo {i}', p))
o.append('\n## Legendas das fotos\n')
for i, l in enumerate(mf['legendas'], 1):
    o.append(campo(f'Foto {i}', l))
o.append('\n## Fora do trabalho\n')
o.append(campo('Título', mf['fora_h2'], '*(escrevi a partir do que você contou sobre cinema)*'))
o.append('\n## Chamada final\n')
o.append(campo('Título', mf['cta_h2']))
o.append(campo('Texto', mf['cta_p']))
partes.append(''.join(o))

partes.append("""
---

# Perguntas minhas para você

**1. O número das buscas locais.** Tem a fonte daquele “sete em cada dez”? Sem fonte, eu troco.
`>> RESPOSTA:`

**2. Plataformas.** Escrevi que a SAL conhece Shopify, Nuvemshop e WooCommerce por dentro.
Está correto? Falta alguma, sobra alguma?
`>> RESPOSTA:`

**3. Prazo do diagnóstico de site.** Coloquei de sete a quinze dias. Bate com a realidade?
`>> RESPOSTA:`

**4. Rede e franquia.** Descrevi o trabalho de multi-unidade como painel comparando as lojas.
Confirma que é assim que você quer entregar?
`>> RESPOSTA:`

**5. Página do Marcelo.** Ficou com menos texto que as outras, de propósito, porque é uma
página de marca e não de busca. Quer que eu amplie, contando mais alguma passagem?
`>> RESPOSTA:`
""")

destino = pathlib.Path('/home/user/hub/sal-site/COPY-PAGINAS-INTERNAS.md')
destino.write_text(''.join(partes), encoding='utf-8')
texto = destino.read_text(encoding='utf-8')
print('gerado:', destino)
print('blocos para ajuste:', texto.count('>> AJUSTE:'))
print('perguntas:', texto.count('>> RESPOSTA:'))
print('palavras:', len(texto.split()))
