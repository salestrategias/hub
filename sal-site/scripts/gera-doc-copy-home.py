"""
Monta o documento de revisão da copy da home e da página de agenda, a partir
do HTML que o Astro gerou. O que o Marcelo revisa é exatamente o que está no ar.
"""
import re, html, pathlib

DIST = pathlib.Path('/home/user/hub/sal-site/dist')
SRC = pathlib.Path('/home/user/hub/sal-site/src')


def limpo(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def um(pad, txt):
    m = re.search(pad, txt, re.S)
    return limpo(m.group(1)) if m else ''


def todos(pad, txt):
    return [limpo(x) for x in re.findall(pad, txt, re.S)]


def campo(rot, valor, nota=''):
    if not valor:
        return ''
    cab = f'**{rot}** {nota}\n' if nota else f'**{rot}**\n'
    return cab + valor + '\n`>> AJUSTE:`\n\n'


h = (DIST / 'index.html').read_text(encoding='utf-8')
partes = ["""# Revisão de copy — Home e página de agendamento

> Documento de trabalho, gerado em 30/07/2026 a partir do que está publicado.
> Escreva o seu ajuste na linha **`>> AJUSTE:`** logo abaixo de cada bloco.
> O que ficar em branco eu mantenho como está.

Este documento substitui a versão 4 que ficou com você. A home mudou desde
então: entrou a barra do blog, entrou a seção de artigos, os serviços ganharam
os nomes novos e o piso de anúncio subiu para R$ 2.500. Tudo já com a
linguagem que você corrigiu nas páginas internas.

**Vai junto a página `/agenda/`**, que você ainda não revisou e que é a página
mais importante do site em conversão: é para lá que vão todos os botões.

---

# 1. Home — /
"""]

partes.append(f'*Título no Google:* `{um(r"<title>(.*?)</title>", h)}`  \n'
              f'*Descrição no Google:* `{um(r"<meta name=.description. content=.(.*?).>", h)}`\n`>> AJUSTE:`\n\n')

# ---- hero
hero = h[h.find('class="hero"'):h.find('class="agora"')]
partes.append('## Primeira dobra\n')
partes.append(campo('Rótulo', um(r'class="eyebrow">(.*?)</span>', hero)))
partes.append(campo('Título', um(r'<h1>(.*?)</h1>', hero), '*(o trecho final aparece em dourado)*'))
partes.append(campo('Chamada', um(r'class="sub">(.*?)</p>', hero)))
botoes = todos(r'<a class="btn[^"]*" href="[^"]*">(.*?)</a>', hero) + todos(r'class="link-side" href="[^"]*">(.*?)</a>', hero)
partes.append(campo('Botões', ' · '.join(botoes)))
partes.append('**Ilustração:** desenho em SVG da busca, do anúncio, da vitrine de produtos e da curva de escala.\n`>> AJUSTE:`\n\n')

# ---- barra do blog
partes.append('---\n\n## 2. Barra "Esta semana no Blog da SAL"\n')
partes.append('**Rótulo**\nEsta semana no Blog da SAL\n`>> AJUSTE:`\n\n')
partes.append('*O título, a categoria e a data vêm do último post publicado. '
              'A barra se atualiza sozinha quando sai post novo.*\n\n')

# ---- para quem
pq = h[h.find('id="para-quem"'):h.find('id="servicos"')]
partes.append('---\n\n## 3. Para quem a SAL trabalha\n')
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', pq)))
partes.append(campo('Apoio', um(r'</h2>\s*<p>(.*?)</p>', pq)))
for bloco in re.findall(r'<article class="publico[^"]*">(.*?)</article>', pq, re.S):
    partes.append(campo('Card — ' + um(r'<h3>(.*?)</h3>', bloco),
                        um(r'<p>(.*?)</p>', bloco) + '\n' +
                        '\n'.join('- ' + x for x in todos(r'<li>(.*?)</li>', bloco))))

# ---- serviços
sv = h[h.find('id="servicos"'):h.find('id="metodo"')]
partes.append('---\n\n## 4. Serviços\n')
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', sv)))
for t, x in re.findall(r'<h3>(.*?)</h3>\s*<p>(.*?)</p>', sv, re.S):
    partes.append(campo(limpo(t), limpo(x)))

# ---- método
mt = h[h.find('id="metodo"'):h.find('id="territorios"')]
partes.append('---\n\n## 5. Metodologia\n')
partes.append(campo('Rótulo', um(r'class="eyebrow">(.*?)</span>', mt)))
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', mt)))
partes.append(campo('Texto', um(r'</h2>\s*<p>(.*?)</p>', mt)))
for n, t, x in re.findall(r'<b>(.*?)</b><h3>(.*?)</h3><p>(.*?)</p>', mt, re.S):
    partes.append(campo(f'{limpo(n)} {limpo(t)}', limpo(x)))

# ---- territórios
tr = h[h.find('id="territorios"'):h.find('id="blog"')]
partes.append('---\n\n## 6. Os três territórios da venda\n')
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', tr)))
partes.append(campo('Apoio', um(r'</h2>\s*<p>(.*?)</p>', tr)))
for n, t, x in re.findall(r'<b>(.*?)</b><h3>(.*?)</h3><p>(.*?)</p>', tr, re.S):
    partes.append(campo(f'{limpo(n)} {limpo(t)}', limpo(x)))

# ---- blog
bl = h[h.find('id="blog"'):h.find('id="sobre"')]
partes.append('---\n\n## 7. Seção do Blog da SAL\n')
partes.append(campo('Rótulo', um(r'class="eyebrow">(.*?)</span>', bl)))
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', bl)))
partes.append('*Os três artigos vêm do WordPress, com imagem, categoria, resumo e data.*\n\n')

# ---- sobre
sb = h[h.find('id="sobre"'):h.find('id="duvidas"')]
partes.append('---\n\n## 8. Quem está por trás\n')
partes.append(campo('Rótulo', um(r'class="eyebrow">(.*?)</span>', sb)))
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', sb)))
for i, p in enumerate(todos(r'<p>(?!<a)(.*?)</p>', sb), 1):
    if len(p) > 40:
        partes.append(campo(f'Parágrafo {i}', p))

# ---- faq
fq = h[h.find('id="duvidas"'):h.find('class="band"')]
partes.append('---\n\n## 9. Perguntas frequentes\n')
for i, (p, r) in enumerate(re.findall(r'<summary>(.*?)</summary>\s*<div><p>(.*?)</p></div>', fq, re.S), 1):
    partes.append(campo(f'{i}. {limpo(p)}', limpo(r)))

# ---- cta e rodapé
bd = h[h.find('class="band"'):h.find('class="rodape"')]
partes.append('---\n\n## 10. Chamada final\n')
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', bd)))
partes.append(campo('Texto', um(r'class="sub">(.*?)</p>', bd)))
partes.append(campo('Garantias', ' · '.join(todos(r'<span>(.*?)</span>', bd))))

rd = h[h.find('class="rodape"'):]
partes.append('---\n\n## 11. Rodapé\n')
partes.append(campo('Descrição', todos(r'<p>(.*?)</p>', rd)[0] if todos(r'<p>(.*?)</p>', rd) else ''))
partes.append(campo('Contato', 'Atendimento 100% online, de Porto Alegre para o Brasil todo. (51) 99338-0278 · contato@salestrategias.com.br'))
partes.append(campo('Linha legal', 'SAL ESTRATÉGIAS DE MARKETING LTDA · CNPJ 66.018.951/0001-04 · Porto Alegre, RS'))

# =========================================================== AGENDA
a = (DIST / 'agenda' / 'index.html').read_text(encoding='utf-8')
partes.append('\n---\n\n# 2. Página de agendamento — /agenda/\n')
partes.append(f'*Título no Google:* `{um(r"<title>(.*?)</title>", a)}`  \n'
              f'*Descrição no Google:* `{um(r"<meta name=.description. content=.(.*?).>", a)}`\n`>> AJUSTE:`\n\n')
cab = a[a.find('class="agenda-cabeca"'):a.find('id="etapa-horario"')]
partes.append(campo('Rótulo', um(r'class="eyebrow">(.*?)</span>', cab)))
partes.append(campo('Título', um(r'<h1>(.*?)</h1>', cab)))
partes.append(campo('Texto', um(r'</h1>\s*<p>(.*?)</p>', cab)))
partes.append(campo('Os três fatos', ' · '.join(todos(r'<li>(.*?)</li>', cab))))

fim = a[a.find('id="etapa-fim"'):]
partes.append('\n## Tela de confirmação, depois de agendar\n')
partes.append(campo('Título', um(r'<h2>(.*?)</h2>', fim)))
partes.append(campo('Texto', todos(r'<p>(.*?)</p>', fim)[-1] if todos(r'<p>(.*?)</p>', fim) else ''))

# perguntas do formulário, lidas do próprio script
js = (SRC / 'scripts' / 'agenda.js').read_text(encoding='utf-8')
partes.append('\n## As 12 perguntas do formulário\n')
partes.append('*Uma por tela, na ordem. Depois delas vem uma tela de revisão.*\n\n')
for i, q in enumerate(re.findall(r"q: '([^']+)'", js), 1):
    bloco = js[js.find(q):js.find(q) + 700]
    op = re.search(r'opcoes: \[([^\]]+)\]', bloco)
    aj = re.search(r"ajuda: '([^']+)'", bloco)
    txt = q
    if op:
        txt += '\nOpções: ' + ' · '.join(x.strip().strip("'") for x in op.group(1).split("',"))
    if aj and aj.start() < 400:
        txt += '\nTexto de apoio: ' + aj.group(1)
    partes.append(campo(f'Pergunta {i}', txt))

partes.append("""
---

# Perguntas minhas para você

**1. O selo "Diagnóstico sem custo".** Ele aparece embaixo de todos os botões do
site. Você tirou "diagnóstico gratuito" da página de diagnóstico de site, porque
competia com a venda. Mantém o selo nas outras páginas ou tira de todas?
`>> RESPOSTA:`

**2. As 12 perguntas do agendamento.** São muitas. A Colmeia usa 11. Quanto mais
perguntas, mais qualificado o lead e menos gente termina. Quer cortar alguma?
`>> RESPOSTA:`

**3. Horário de atendimento.** A agenda oferece das 9h às 17h, dias úteis, de 30
em 30 minutos, nos próximos 10 dias úteis. Bate com a sua rotina?
`>> RESPOSTA:`

**4. E-mail de contato.** Usei `contato@salestrategias.com.br` no rodapé, no
schema e na política de privacidade. É esse mesmo?
`>> RESPOSTA:`
""")

destino = pathlib.Path('/home/user/hub/sal-site/COPY-HOME-E-AGENDA.md')
destino.write_text(''.join(partes), encoding='utf-8')
t = destino.read_text(encoding='utf-8')
print('gerado:', destino)
print('blocos para ajuste:', t.count('>> AJUSTE:'), '| perguntas:', t.count('>> RESPOSTA:'))
