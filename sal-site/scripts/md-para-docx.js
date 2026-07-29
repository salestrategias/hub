// Gera COPY-HOME-REVISAO.docx a partir de COPY-HOME-REVISAO.md.
// O markdown é a fonte da verdade; este script só o apresenta em tabela editável.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle,
} = require('docx');
const fs = require('fs');

const INDIGO = '14103A';
const GOLD = 'A88940';
const CINZA = '6B6880';
const LINHA = 'D9D4C6';
const OSSO = 'F7F4EC';

const W_ATUAL = 6900;
const W_AJUSTE = 3500;
const W_TOTAL = W_ATUAL + W_AJUSTE;

const MD = process.argv[2];
const OUT = process.argv[3];

// ---------- markdown mínimo: **negrito** e *itálico* viram runs ----------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(new TextRun({ ...base, text: tok.slice(2, -2), bold: true }));
    else if (tok.startsWith('`')) out.push(new TextRun({ ...base, text: tok.slice(1, -1), font: 'Consolas' }));
    else out.push(new TextRun({ ...base, text: tok.slice(1, -1), italics: true, color: CINZA }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out.length ? out : [new TextRun({ ...base, text: '' })];
}

function p(text, opts = {}) {
  const base = {
    size: opts.size ?? 20,
    color: opts.color ?? '2E2B45',
    font: opts.font ?? 'Calibri',
    bold: opts.bold,
    italics: opts.italics,
    allCaps: opts.caps,
  };
  return new Paragraph({
    spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    bullet: opts.bullet ? { level: 0 } : undefined,
    border: opts.rule
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINHA, space: 8 } }
      : undefined,
    children: runs(text, base),
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading, color: 'auto' } : undefined,
    margins: { top: 130, bottom: 130, left: 150, right: 150 },
    children: children.length ? children : [p('')],
  });
}

function tabela(linhas) {
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell([p('TEXTO ATUAL DO SITE', { bold: true, size: 16, color: 'FFFFFF', caps: true })], { width: W_ATUAL, shading: INDIGO }),
      cell([p('SEU AJUSTE / COMENTÁRIO', { bold: true, size: 16, color: 'FFFFFF', caps: true })], { width: W_AJUSTE, shading: INDIGO }),
    ],
  });
  const corpo = linhas.map((blocos, i) =>
    new TableRow({
      children: [
        cell(blocos, { width: W_ATUAL, shading: i % 2 ? OSSO : undefined }),
        cell([p('')], { width: W_AJUSTE, shading: i % 2 ? OSSO : undefined }),
      ],
    })
  );
  return new Table({
    columnWidths: [W_ATUAL, W_AJUSTE],
    width: { size: W_TOTAL, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINHA },
    },
    rows: [head, ...corpo],
  });
}

// ---------- leitura ----------
const linhasMd = fs.readFileSync(MD, 'utf8').split('\n');

const filhos = [];
let buffer = [];          // parágrafos do bloco corrente
let linhasSecao = [];     // blocos já fechados da seção corrente

function fechaBloco() {
  if (buffer.length) { linhasSecao.push(buffer); buffer = []; }
}
function fechaSecao() {
  fechaBloco();
  if (linhasSecao.length) { filhos.push(tabela(linhasSecao)); linhasSecao = []; }
}

for (const raw of linhasMd) {
  const l = raw.trimEnd();

  if (/^`>>\s*(AJUSTE|RESPOSTA):`?\s*$/.test(l.trim())) { fechaBloco(); continue; }
  if (/^---\s*$/.test(l)) continue;

  if (l.startsWith('# ')) {
    fechaSecao();
    filhos.push(p(l.slice(2), {
      bold: true, size: 40, color: INDIGO, font: 'Georgia', before: 360, after: 160,
    }));
    continue;
  }
  if (l.startsWith('## ')) {
    fechaSecao();
    filhos.push(p(l.slice(3), {
      bold: true, size: 26, color: GOLD, font: 'Georgia', before: 320, after: 140, rule: true,
    }));
    continue;
  }
  if (l.startsWith('> ')) {
    fechaBloco();
    filhos.push(p(l.slice(2), { italics: true, color: CINZA, size: 19 }));
    continue;
  }
  if (/^[-*]\s+/.test(l)) { buffer.push(p(l.replace(/^[-*]\s+/, ''), { bullet: true })); continue; }
  if (l.trim() === '') { continue; }

  // texto solto fora de qualquer seção vira parágrafo normal
  if (linhasSecao.length === 0 && buffer.length === 0 && filhos.length && !filhos[filhos.length - 1].__naSecao) {
    // continua no buffer normalmente; a heurística abaixo resolve
  }
  buffer.push(p(l));
}
fechaSecao();

const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
    children: filhos,
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log('ok', OUT, b.length, 'bytes'); });
