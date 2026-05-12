/**
 * Parser do formato Google Meet (transcrição via Doc).
 *
 * Formatos cobertos (Meet em pt-BR e en, com e sem Gemini):
 *
 *  ─── Business Standard (sem Gemini) — só transcrição ───
 *    Transcrição da reunião
 *    Marcelo Freitas começou a transcrição em XX:XX
 *
 *    Marcelo Freitas (00:00:12)
 *    Bom dia pessoal, vamos começar?
 *
 *    Cliente (00:00:34)
 *    Bom dia, tudo certo.
 *
 *  ─── Business Plus / Enterprise (com Gemini "Take notes") ───
 *    Resumo da reunião
 *    [parágrafos]
 *
 *    Itens de ação
 *    ☐ João — mandar a proposta até sexta
 *    ☐ Maria — revisar contrato segunda
 *
 *    Transcrição da reunião
 *    [igual ao caso 1]
 *
 * O parser detecta CADA seção independentemente — funciona pros dois
 * planos. Se a seção não existir no Doc, o campo no retorno fica vazio
 * e a UI sugere "gerar via Claude Max".
 */

export type MeetBlock = {
  speaker: string;
  timestampSeg: number;
  texto: string;
};

export type MeetAction = {
  texto: string;
  responsavel: string | null;
  prazo: string | null;
};

export type MeetParseResult = {
  resumo: string | null;
  actions: MeetAction[];
  blocks: MeetBlock[];
  /** Indicadores pra UI mostrar "X% completo" */
  temResumo: boolean;
  temActions: boolean;
  temTranscricao: boolean;
};

// ─────────────────────────────────────────────────────────────────────
// Cabeçalhos de seção em pt-BR e en — usados pra dividir o Doc
//
// Lista coberta a partir de exports reais do Google Meet com e sem
// Gemini "Take notes for me", em pt-BR e en. Se aparecer cabeçalho
// novo (Google muda às vezes), basta adicionar aqui.
// ─────────────────────────────────────────────────────────────────────
const CABECALHOS_RESUMO = [
  "Resumo da reunião",
  "Resumo da Reunião",
  "Resumo",
  "Anotações da reunião",
  "Notas da reunião",
  "Notas",
  "Meeting summary",
  "Summary",
  "Meeting notes",
];

const CABECALHOS_ACTIONS = [
  "Itens de ação",
  "Itens de Ação",
  "Ações",
  "Ação",
  "Action items",
  "Próximas ações",
  "Próximos passos",
  "Next steps",
  "To-do",
  "Tarefas",
  "Tarefas pendentes",
];

const CABECALHOS_TRANSCRICAO = [
  "Transcrição da reunião",
  "Transcrição",
  "Transcript",
  "Meeting transcript",
  "Detalhes da transcrição",
];

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────

export function parsearMeetDoc(textoBruto: string): MeetParseResult {
  // Normaliza quebras de linha + colapsa whitespace excessivo
  const texto = textoBruto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const secoes = dividirEmSecoes(texto);

  const resumo = parsearResumo(secoes.resumo);
  const actions = parsearActions(secoes.actions);
  const blocks = parsearTranscricao(secoes.transcricao);

  return {
    resumo,
    actions,
    blocks,
    temResumo: !!resumo,
    temActions: actions.length > 0,
    temTranscricao: blocks.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Divisão em seções
// ─────────────────────────────────────────────────────────────────────

function dividirEmSecoes(texto: string): {
  resumo: string;
  actions: string;
  transcricao: string;
} {
  const todosCabecalhos = [
    ...CABECALHOS_RESUMO,
    ...CABECALHOS_ACTIONS,
    ...CABECALHOS_TRANSCRICAO,
  ];

  // Encontra todas as posições de cabeçalhos
  const matches: Array<{ tipo: "resumo" | "actions" | "transcricao"; index: number; tamanho: number }> = [];
  const linhas = texto.split("\n");
  let pos = 0;

  for (const linha of linhas) {
    const trim = linha.trim();
    if (trim) {
      for (const c of todosCabecalhos) {
        if (trim.toLowerCase() === c.toLowerCase()) {
          const tipo: "resumo" | "actions" | "transcricao" = CABECALHOS_RESUMO.some((x) => x.toLowerCase() === c.toLowerCase())
            ? "resumo"
            : CABECALHOS_ACTIONS.some((x) => x.toLowerCase() === c.toLowerCase())
            ? "actions"
            : "transcricao";
          matches.push({ tipo, index: pos, tamanho: linha.length });
          break;
        }
      }
    }
    pos += linha.length + 1; // +1 pelo \n
  }

  // Ordena por posição
  matches.sort((a, b) => a.index - b.index);

  const secoes = { resumo: "", actions: "", transcricao: "" };
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const fim = matches[i + 1]?.index ?? texto.length;
    const conteudo = texto.slice(m.index + m.tamanho, fim).trim();
    // Mantém a PRIMEIRA seção de cada tipo (caso Doc tenha duplicatas)
    if (!secoes[m.tipo]) secoes[m.tipo] = conteudo;
  }

  return secoes;
}

// ─────────────────────────────────────────────────────────────────────
// Parsers por tipo
// ─────────────────────────────────────────────────────────────────────

function parsearResumo(texto: string): string | null {
  if (!texto.trim()) return null;
  // Resumo do Gemini geralmente é texto livre + bullets. Preservamos
  // formatação básica (linhas e bullets), mas remove linhas de metadados
  // tipo "Esta seção foi gerada por IA" que o Gemini às vezes adiciona.
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return true; // mantém quebras
      if (/^Esta seç(ão|.*)? foi gerada/i.test(l)) return false;
      if (/^Resumo gerado por/i.test(l)) return false;
      return true;
    });

  // Limpa quebras múltiplas
  const limpo = linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return limpo || null;
}

function parsearActions(texto: string): MeetAction[] {
  if (!texto.trim()) return [];
  const actions: MeetAction[] = [];

  for (const raw of texto.split("\n")) {
    const linha = raw.trim();
    if (!linha) continue;

    // Aceita formatos:
    //   ☐ Texto
    //   [ ] Texto
    //   - Texto
    //   • Texto
    //   1. Texto
    const m = linha.match(/^(?:[☐☑✓✔]|\[[ x]\]|[-•*]|\d+\.)\s*(.+)$/);
    if (!m) {
      // Se primeira linha não tem marker mas tem padrão "Nome — ação",
      // ainda aceita (Gemini às vezes formata sem checkbox no plain text)
      if (linha.includes("—") || linha.includes(":")) {
        actions.push(parsearAcaoLinha(linha));
      }
      continue;
    }

    const conteudo = m[1].trim();
    if (conteudo) actions.push(parsearAcaoLinha(conteudo));
  }

  return actions;
}

/**
 * Parseia padrões como:
 *   "João — mandar a proposta até sexta"
 *   "Maria: revisar contrato (prazo: segunda)"
 *   "Mandar a proposta — João — sexta"
 *   "Mandar a proposta"  (sem responsável nem prazo)
 */
function parsearAcaoLinha(linha: string): MeetAction {
  // Tenta extrair prazo primeiro (palavras-chave comuns)
  let prazo: string | null = null;
  const prazoMatch = linha.match(/(?:até|by|prazo:|deadline:)\s*([^.,;]+)/i);
  if (prazoMatch) prazo = prazoMatch[1].trim();

  // Tenta extrair responsável (antes de "—" ou ":")
  let responsavel: string | null = null;
  let texto = linha;

  // Padrão "Nome — Ação" ou "Nome: Ação"
  const respMatch = linha.match(/^([A-ZÀ-Ú][a-zà-úA-ZÀ-Ú\s]{1,40}?)\s*[—:]\s*(.+)$/);
  if (respMatch) {
    responsavel = respMatch[1].trim();
    texto = respMatch[2].trim();
  }

  // Remove o trecho do prazo do texto principal pra não duplicar
  if (prazoMatch) {
    texto = texto.replace(prazoMatch[0], "").replace(/[.,;]\s*$/, "").trim();
  }

  return {
    texto: texto.slice(0, 300),
    responsavel,
    prazo,
  };
}

function parsearTranscricao(texto: string): MeetBlock[] {
  if (!texto.trim()) return [];
  const blocks: MeetBlock[] = [];
  const linhas = texto.split("\n");

  // Estado do parser: agrupa linhas até encontrar próximo header de speaker
  let speakerAtual: string | null = null;
  let timestampAtual = 0;
  let textoAtual: string[] = [];

  function commit() {
    if (speakerAtual && textoAtual.length > 0) {
      const t = textoAtual.join(" ").replace(/\s+/g, " ").trim();
      if (t) {
        blocks.push({
          speaker: speakerAtual,
          timestampSeg: timestampAtual,
          texto: t,
        });
      }
    }
    textoAtual = [];
  }

  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;

    // Skip linhas de metadados do Meet
    if (/começou a transcrição em/i.test(linha)) continue;
    if (/started transcription at/i.test(linha)) continue;
    if (/^[A-Za-z\s]+ stopped transcription/i.test(linha)) continue;

    // Header de speaker: "Nome (HH:MM:SS)" ou "Nome (MM:SS)" ou "Nome HH:MM:SS"
    const headerMatch = linha.match(/^(.+?)\s*[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*$/);
    if (headerMatch && pareceSpeaker(headerMatch[1])) {
      commit();
      speakerAtual = headerMatch[1].trim();
      timestampAtual = parseTimecode(headerMatch[2]);
      continue;
    }

    // Linha de conteúdo — acumula
    if (speakerAtual) {
      textoAtual.push(linha);
    }
  }
  commit();

  return blocks;
}

/**
 * Heurística: nome de speaker é texto curto sem pontuação no fim,
 * sem dois-pontos no meio (que indica "Speaker: texto" inline).
 */
function pareceSpeaker(s: string): boolean {
  const t = s.trim();
  if (t.length > 60) return false;
  if (t.length < 2) return false;
  if (/[.!?]$/.test(t)) return false;
  // Se tem ":" no meio, provavelmente é "Nome: texto" — não é header sozinho
  return true;
}

function parseTimecode(tc: string): number {
  const partes = tc.split(":").map((s) => parseInt(s, 10));
  if (partes.length === 3) {
    return partes[0] * 3600 + partes[1] * 60 + partes[2];
  }
  if (partes.length === 2) {
    return partes[0] * 60 + partes[1];
  }
  return 0;
}
