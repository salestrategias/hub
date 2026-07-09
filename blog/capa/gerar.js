// Gerador de capas do blog SAL — Satori + resvg, identidade v10 (editorial magazine)
//
// Com foto (preferido):
//   node gerar.js --titulo "..." --destaque "..." --categoria "..." \
//     --busca "clothing store owner" --out capa.png        (busca no Pexels; requer PEXELS_API_KEY)
//   node gerar.js --titulo "..." --foto caminho/foto.jpg    (usa arquivo local)
// Sem foto: cai nas variantes tipográficas.
//
// Layouts com foto (rotação por hash do título, override com --variante 0-2):
//   0 split-white · 1 split-warm · 2 fullbleed-dark
// PEXELS_API_KEY: via env ou blog/.env. Saída: PNG 1376x768.

import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const W = 1376
const H = 768

// ─── Paleta v10 ──────────────────────────────────────────────────
const ROXO = '#7E30E1'
const INDIGO = '#2D1D7A'
const INK = '#0A0A0F'
const PAPER_WARM = '#F8F6F2'
const PAPER_COOL = '#F4F7F7'
const WHITE = '#FFFFFF'
const NEON = '#F6FF74' // micro uso
const ROXO_DARK_BG = '#A76BF2' // accent legível sobre ink

// ─── Args ────────────────────────────────────────────────────────
function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`)
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : padrao
}
const titulo = arg('titulo')
const destaque = arg('destaque', '')
const categoria = (arg('categoria', 'Marketing')).toUpperCase()
const out = arg('out', 'capa.png')
const fotoArquivo = arg('foto')
const busca = arg('busca')
const fotoId = arg('fotoId') // reusar foto específica do Pexels
// modo "limpo": SEM texto na arte (imagem destacada — sobrevive a qualquer corte dos layouts do blog)
// modo padrão: arte tipográfica/split com título (usar como og:image/social, proporção fixa)
const modo = arg('modo', 'padrao')
if (!titulo) {
  console.error('Erro: --titulo é obrigatório')
  process.exit(1)
}

let hash = 0
for (const c of titulo) hash = (hash * 31 + c.charCodeAt(0)) >>> 0

// ─── Credenciais (env ou blog/.env) ──────────────────────────────
function pexelsKey() {
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY.trim()
  const envPath = join(DIR, '..', '.env')
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^PEXELS_API_KEY=(.+)$/m)
    if (m) return m[1].trim()
  }
  return null
}

// ─── Foto: arquivo local ou busca no Pexels ──────────────────────
async function obterFoto() {
  if (fotoArquivo) {
    const buf = readFileSync(fotoArquivo)
    const mime = fotoArquivo.match(/\.png$/i) ? 'image/png' : 'image/jpeg'
    return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, credito: `arquivo local ${fotoArquivo}` }
  }
  if (!busca && !fotoId) return null
  const key = pexelsKey()
  if (!key) {
    console.error('AVISO: --busca/--fotoId informado mas PEXELS_API_KEY ausente. Gerando capa tipográfica.')
    return null
  }
  if (fotoId) {
    try {
      const res = await fetch(`https://api.pexels.com/v1/photos/${fotoId}`, { headers: { Authorization: key } })
      if (!res.ok) throw new Error(`Pexels foto ${fotoId} HTTP ${res.status}`)
      const foto = await res.json()
      const img = await fetch(foto.src.large2x || foto.src.large)
      const buf = Buffer.from(await img.arrayBuffer())
      const mime = img.headers.get('content-type') || 'image/jpeg'
      return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, credito: `Pexels #${foto.id} por ${foto.photographer}` }
    } catch (e) {
      console.error(`AVISO: fotoId falhou (${e.message}).`)
      if (!busca) return null
    }
  }
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(busca)}&orientation=landscape&size=large&per_page=10`
    const res = await fetch(url, { headers: { Authorization: key } })
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`)
    const dados = await res.json()
    const fotos = (dados.photos || []).filter((p) => p.width >= 1376)
    if (!fotos.length) throw new Error(`nenhum resultado para "${busca}"`)
    const foto = fotos[hash % Math.min(fotos.length, 7)] // determinístico por título, varia entre posts
    const img = await fetch(foto.src.large2x || foto.src.large)
    if (!img.ok) throw new Error(`download HTTP ${img.status}`)
    const buf = Buffer.from(await img.arrayBuffer())
    const mime = img.headers.get('content-type') || 'image/jpeg'
    return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, credito: `Pexels #${foto.id} por ${foto.photographer}` }
  } catch (e) {
    console.error(`AVISO: busca de foto falhou (${e.message}). Gerando capa tipográfica.`)
    return null
  }
}

// ─── Assets de marca ─────────────────────────────────────────────
const fonte = (f) => readFileSync(join(DIR, 'fonts', f))
const pngDims = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) })
const LOGO_H = 40

function logo(tipo) {
  if (tipo === 'roxo') {
    const buf = readFileSync(join(DIR, '..', '..', 'preview', 'assets', 'logo-sal-horizontal-purple.png'))
    const d = pngDims(buf)
    return { src: `data:image/png;base64,${buf.toString('base64')}`, w: Math.round(LOGO_H * (d.width / d.height)) }
  }
  const svg = readFileSync(join(DIR, '..', '..', 'preview', 'assets', 'logo-sal-white.svg'), 'utf8')
  const vb = svg.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"\s*/)
  const ratio = vb ? Number(vb[1]) / Number(vb[2]) : 4
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, w: Math.round(LOGO_H * ratio) }
}

const saltGrain = (cor, tam = 12) => ({
  type: 'div',
  props: { style: { width: tam, height: tam, backgroundColor: cor, transform: 'rotate(45deg)' } },
})

// Palavra por palavra: espaços nas bordas de spans são aparados pelo satori,
// então cada palavra vira um span com margem própria (não perde espaço no wrap).
function spansTitulo(fontSize, corTexto, corAccent) {
  let ini = -1
  let fim = -1
  if (destaque) {
    ini = titulo.toLowerCase().indexOf(destaque.toLowerCase())
    if (ini > -1) fim = ini + destaque.length
  }
  const gap = Math.round(fontSize * 0.24)
  const palavras = []
  const re = /\S+/g
  let m
  while ((m = re.exec(titulo)) !== null) {
    const dentro = ini > -1 && m.index < fim && m.index + m[0].length > ini
    palavras.push({
      type: 'span',
      props: { style: { color: dentro ? corAccent : corTexto, marginRight: gap, display: 'flex' }, children: m[0] },
    })
  }
  return palavras
}

const eyebrow = (corBase, corCat, corDot) => ({
  type: 'div',
  props: {
    style: { display: 'flex', alignItems: 'center', gap: 16 },
    children: [
      { type: 'div', props: { style: { fontFamily: 'Inter', fontSize: 24, fontWeight: 600, letterSpacing: 6, color: corBase, display: 'flex' }, children: 'BLOG SAL' } },
      saltGrain(corDot, 9),
      { type: 'div', props: { style: { fontFamily: 'Inter', fontSize: 24, fontWeight: 600, letterSpacing: 6, color: corCat, display: 'flex' }, children: categoria } },
    ],
  },
})

const rodape = (lg, corTexto, corDot) => ({
  type: 'div',
  props: {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    children: [
      { type: 'img', props: { src: lg.src, width: lg.w, height: LOGO_H } },
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'center', gap: 14 },
          children: [
            saltGrain(corDot, 8),
            { type: 'div', props: { style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 600, letterSpacing: 2, color: corTexto, display: 'flex' }, children: 'salestrategias.com.br/blog' } },
          ],
        },
      },
    ],
  },
})

// ─── Layouts ─────────────────────────────────────────────────────
function layoutTipografico(vi) {
  const V = [
    { bg: WHITE, texto: INK, eyebrow: INDIGO, accent: ROXO, dot: ROXO, logo: 'roxo' },
    { bg: PAPER_WARM, texto: INK, eyebrow: INDIGO, accent: ROXO, dot: ROXO, logo: 'roxo' },
    { bg: PAPER_COOL, texto: INK, eyebrow: INDIGO, accent: ROXO, dot: ROXO, logo: 'roxo' },
    { bg: INK, texto: WHITE, eyebrow: 'rgba(255,255,255,0.85)', accent: ROXO_DARK_BG, dot: NEON, logo: 'branco' },
  ][vi % 4]
  const len = titulo.length
  const fontSize = len <= 42 ? 88 : len <= 62 ? 76 : len <= 84 ? 66 : 56
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: V.bg, padding: '64px 80px 56px 80px' },
      children: [
        eyebrow(V.eyebrow, V.accent, V.dot),
        { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', maxWidth: 1120, fontFamily: 'PlusJakarta', fontWeight: 800, fontSize, lineHeight: 1.08, letterSpacing: -2 }, children: spansTitulo(fontSize, V.texto, V.accent) } },
        rodape(logo(V.logo), V.eyebrow, V.dot),
      ],
    },
  }
}

function layoutSplit(fotoUri, bg) {
  const len = titulo.length
  const fontSize = len <= 42 ? 62 : len <= 62 ? 54 : len <= 84 ? 47 : 40
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', backgroundColor: bg },
      children: [
        {
          type: 'div',
          props: {
            style: { width: 730, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px 52px 52px 68px' },
            children: [
              eyebrow(INDIGO, ROXO, ROXO),
              { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', fontFamily: 'PlusJakarta', fontWeight: 800, fontSize, lineHeight: 1.1, letterSpacing: -1.5 }, children: spansTitulo(fontSize, INK, ROXO) } },
              rodape(logo('roxo'), INDIGO, ROXO),
            ],
          },
        },
        { type: 'div', props: { style: { width: 10, height: '100%', backgroundColor: ROXO } } },
        { type: 'img', props: { src: fotoUri, width: 636, height: H, style: { objectFit: 'cover' } } },
      ],
    },
  }
}

function layoutFullbleed(fotoUri) {
  const len = titulo.length
  const fontSize = len <= 42 ? 74 : len <= 62 ? 64 : len <= 84 ? 55 : 47
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: INK },
      children: [
        { type: 'img', props: { src: fotoUri, width: W, height: H, style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' } } },
        { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: W, height: H, background: 'linear-gradient(to top, rgba(10,10,15,0.94) 18%, rgba(10,10,15,0.62) 52%, rgba(10,10,15,0.22) 100%)' } } },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 26, padding: '64px 80px 56px 80px' },
            children: [
              eyebrow('rgba(255,255,255,0.9)', ROXO_DARK_BG, NEON),
              { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', maxWidth: 1150, fontFamily: 'PlusJakarta', fontWeight: 800, fontSize, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 14 }, children: spansTitulo(fontSize, WHITE, ROXO_DARK_BG) } },
              rodape(logo('branco'), 'rgba(255,255,255,0.9)', NEON),
            ],
          },
        },
      ],
    },
  }
}

// Imagem destacada: foto pura + barra roxa na base. Zero texto = nenhum corte quebra.
function layoutFotoLimpa(fotoUri) {
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: INK },
      children: [
        { type: 'img', props: { src: fotoUri, width: W, height: H, style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: 0, left: 0, width: W, height: 14, backgroundColor: ROXO } } },
      ],
    },
  }
}

// Fallback limpo sem foto: paper + logo central (sem texto de título)
function layoutLimpoSemFoto() {
  const lg = logo('roxo')
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, backgroundColor: PAPER_WARM, position: 'relative' },
      children: [
        { type: 'img', props: { src: lg.src, width: Math.round(lg.w * 1.8), height: Math.round(LOGO_H * 1.8) } },
        { type: 'div', props: { style: { display: 'flex', gap: 22 }, children: [saltGrain(ROXO, 12), saltGrain(INDIGO, 12), saltGrain(ROXO, 12)] } },
        { type: 'div', props: { style: { position: 'absolute', bottom: 0, left: 0, width: W, height: 14, backgroundColor: ROXO } } },
      ],
    },
  }
}

// ─── Render ──────────────────────────────────────────────────────
const foto = await obterFoto()
let el, descricaoVariante
if (modo === 'limpo') {
  el = foto ? layoutFotoLimpa(foto.dataUri) : layoutLimpoSemFoto()
  descricaoVariante = foto ? 'foto-limpa' : 'limpa-sem-foto'
  if (foto) console.log(`FOTO: ${foto.credito}`)
} else if (foto) {
  const vi = arg('variante') !== undefined ? Number(arg('variante')) % 3 : hash % 3
  el = [() => layoutSplit(foto.dataUri, WHITE), () => layoutSplit(foto.dataUri, PAPER_WARM), () => layoutFullbleed(foto.dataUri)][vi]()
  descricaoVariante = ['split-white', 'split-warm', 'fullbleed-dark'][vi]
  console.log(`FOTO: ${foto.credito}`)
} else {
  const vi = arg('variante') !== undefined ? Number(arg('variante')) % 4 : hash % 4
  el = layoutTipografico(vi)
  descricaoVariante = `tipografica-${vi}`
}

const svg = await satori(el, {
  width: W,
  height: H,
  fonts: [
    { name: 'PlusJakarta', data: fonte('plus-jakarta-sans-v12-latin-800.ttf'), weight: 800, style: 'normal' },
    { name: 'PlusJakarta', data: fonte('plus-jakarta-sans-v12-latin-700.ttf'), weight: 700, style: 'normal' },
    { name: 'Inter', data: fonte('inter-v20-latin-600.ttf'), weight: 600, style: 'normal' },
  ],
})

const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng()
writeFileSync(out, png)
console.log(`OK ${out} (${W}x${H}, ${descricaoVariante}, ${Math.round(png.length / 1024)} KB)`)
