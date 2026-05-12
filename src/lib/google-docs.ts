/**
 * Leitor de Google Docs via Drive API.
 *
 * Por que NÃO usar a Docs API:
 *  - Docs API requer scope adicional `documents.readonly` (precisaria
 *    re-autorização de OAuth pra todos users)
 *  - Pra parsear transcrição do Meet, texto plano é suficiente (não
 *    precisamos formatação rica)
 *  - Drive API já está autorizada e tem método `files.export` que
 *    converte Doc → text/plain
 *
 * Como funciona:
 *  - `files.export(docId, mimeType: "text/plain")` baixa o Doc como
 *    UTF-8 plano, incluindo headings, listas, etc. já flatten.
 *  - O parser (`meet-parser.ts`) toma esse texto e identifica as seções
 *    via regex e cabeçalhos.
 */
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google-auth";

/**
 * Baixa um Google Doc como texto plano UTF-8.
 * @param docId — ID do arquivo Doc no Drive
 */
export async function getDocText(docId: string): Promise<string> {
  const auth = await getGoogleClient();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.export(
    {
      fileId: docId,
      mimeType: "text/plain",
      supportsAllDrives: true,
    },
    { responseType: "text" }
  );

  // res.data quando responseType=text vem como string
  return String(res.data);
}

/**
 * Lista Google Docs recentes que parecem ser transcrições do Meet.
 *
 * Estratégia de detecção:
 *  - Pasta padrão "Meet Recordings" (criada automaticamente pelo Meet)
 *  - OU título contendo "Transcrição" / "Transcript" / "Notes from Meet"
 *  - OU título contendo "Anotações da reunião" (pt-BR do Meet)
 *
 * Ordenado por modifiedTime desc — Marcelo vê os mais recentes primeiro.
 */
export type MeetDoc = {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
  /** Se veio da pasta "Meet Recordings" — flag de confiança alta */
  daPastaMeet: boolean;
};

export async function listMeetDocs(opts: { limit?: number } = {}): Promise<MeetDoc[]> {
  const auth = await getGoogleClient();
  const drive = google.drive({ version: "v3", auth });

  // Procura primeiro a pasta "Meet Recordings"
  const pastaRes = await drive.files.list({
    q: "name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id,name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const pastaIds = (pastaRes.data.files ?? []).map((f) => f.id).filter(Boolean) as string[];

  // Query unificada: docs (não folders) que estejam na pasta Meet Recordings
  // OU cujo nome bate com padrão de transcrição
  const filtros: string[] = ["mimeType = 'application/vnd.google-apps.document'", "trashed = false"];
  const orParts: string[] = [];

  if (pastaIds.length > 0) {
    orParts.push(...pastaIds.map((id) => `'${id}' in parents`));
  }
  // Padrões de nome usados pelo Meet em pt-BR e en
  orParts.push("name contains 'Transcrição'");
  orParts.push("name contains 'Transcript'");
  orParts.push("name contains 'Anotações'");
  orParts.push("name contains 'Notes from'");
  orParts.push("name contains 'gravação'"); // pt-BR fallback

  filtros.push(`(${orParts.join(" or ")})`);

  const res = await drive.files.list({
    q: filtros.join(" and "),
    fields: "files(id,name,modifiedTime,webViewLink,parents)",
    pageSize: opts.limit ?? 30,
    orderBy: "modifiedTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "(sem nome)",
    modifiedTime: f.modifiedTime ?? "",
    webViewLink: f.webViewLink ?? `https://docs.google.com/document/d/${f.id}`,
    daPastaMeet: !!f.parents?.some((p) => pastaIds.includes(p)),
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Gravação MP4 associada — quando o Meet grava E transcreve, ambos
// arquivos ficam na pasta "Meet Recordings" (ou sub-pasta da reunião).
// Estratégia pra achar: pega o pai do Doc, lista MP4s nessa pasta,
// retorna o mais próximo em modifiedTime.
// ─────────────────────────────────────────────────────────────────────

export type GravacaoMeet = {
  id: string;
  name: string;
  webViewLink: string;
  /** URL de preview embeddable (iframe). Inclui controles nativos do Drive. */
  embedUrl: string;
  /** Tamanho em bytes — útil pra UI mostrar */
  size: number | null;
  modifiedTime: string;
};

/**
 * Tenta encontrar o arquivo MP4 da gravação na mesma pasta do Doc de
 * transcrição. Retorna null se nada encontrar (Meet com transcrição
 * mas sem gravação).
 *
 * Quando há múltiplos MP4s na pasta (raro), retorna o mais próximo
 * em modifiedTime do Doc.
 */
export async function acharGravacaoMeet(docId: string): Promise<GravacaoMeet | null> {
  const auth = await getGoogleClient();
  const drive = google.drive({ version: "v3", auth });

  // 1. Pega o Doc pra saber a pasta e o tempo
  const doc = await drive.files.get({
    fileId: docId,
    fields: "parents,modifiedTime",
    supportsAllDrives: true,
  });
  const parentId = doc.data.parents?.[0];
  if (!parentId) return null;

  const docTime = doc.data.modifiedTime ? new Date(doc.data.modifiedTime).getTime() : Date.now();

  // 2. Lista vídeos MP4 na mesma pasta
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'video/mp4' and trashed = false`,
    fields: "files(id,name,webViewLink,size,modifiedTime)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  const mp4s = res.data.files ?? [];
  if (mp4s.length === 0) return null;

  // 3. Ordena por proximidade temporal com o Doc
  mp4s.sort((a, b) => {
    const at = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
    const bt = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
    return Math.abs(at - docTime) - Math.abs(bt - docTime);
  });

  const escolhido = mp4s[0];
  return {
    id: escolhido.id ?? "",
    name: escolhido.name ?? "(sem nome)",
    webViewLink: escolhido.webViewLink ?? `https://drive.google.com/file/d/${escolhido.id}/view`,
    embedUrl: `https://drive.google.com/file/d/${escolhido.id}/preview`,
    size: escolhido.size ? parseInt(escolhido.size, 10) : null,
    modifiedTime: escolhido.modifiedTime ?? "",
  };
}

/**
 * Constrói URL de embed a partir de qualquer URL/ID de arquivo Drive.
 * Útil pra Marcelo colar URL de gravação manualmente.
 */
export function urlEmbedDrive(urlOuId: string): string | null {
  const id = extrairDocId(urlOuId) ?? extrairFileIdGenerico(urlOuId);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function extrairFileIdGenerico(s: string): string | null {
  // /file/d/{ID}/
  const m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // ?id={ID}
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

/**
 * Pega ID do Doc a partir de uma URL completa. Aceita formatos:
 *  - https://docs.google.com/document/d/{ID}/edit
 *  - https://docs.google.com/document/d/{ID}/
 *  - só o ID solto
 */
export function extrairDocId(urlOuId: string): string | null {
  const trimmed = urlOuId.trim();
  if (!trimmed) return null;

  // URL completa
  const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  // ID solto (alfanumérico + _ -)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  return null;
}
