import { google, type drive_v3 } from "googleapis";
import { getGoogleClient } from "@/lib/google-auth";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
  parents?: string[] | null;
  isFolder: boolean;
  /**
   * ID do Shared Drive ao qual esse arquivo pertence — null se está em
   * "Meu Drive" (drive pessoal do user). Usado pelo browser pra manter
   * contexto ao navegar entre níveis.
   */
  driveId?: string | null;
};

export type SharedDrive = {
  id: string;
  name: string;
  // Background color hint que Google guarda pro drive (pra UI)
  colorRgb?: string | null;
};

const FIELDS = "id,name,mimeType,iconLink,webViewLink,modifiedTime,size,parents,driveId";

/**
 * Parâmetros mandatórios pra Drive API v3 enxergar Shared Drives.
 * O Google considera Shared Drives uma extensão opt-in — sem essas
 * flags, todas as queries retornam só "Meu Drive".
 *
 * Referência: https://developers.google.com/drive/api/guides/enable-shareddrives
 */
const SHARED_DRIVE_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

export async function driveClient() {
  const auth = await getGoogleClient();
  return google.drive({ version: "v3", auth });
}

/**
 * Lista os Shared Drives aos quais o usuário tem acesso.
 * Vazio = user só tem Meu Drive pessoal (sem Workspace ou sem drives compartilhados).
 */
export async function listSharedDrives(): Promise<SharedDrive[]> {
  const drive = await driveClient();
  const res = await drive.drives.list({
    pageSize: 100,
    fields: "drives(id,name,colorRgb)",
  });
  return (res.data.drives ?? []).map((d) => ({
    id: d.id ?? "",
    name: d.name ?? "(sem nome)",
    colorRgb: d.colorRgb ?? null,
  }));
}

/**
 * Lista arquivos de uma pasta. Comporta 3 modos:
 *  1. Sem opts → root do "Meu Drive"
 *  2. parentId → conteúdo da pasta (funciona pra Meu Drive E Shared Drives,
 *     porque parents IDs são globalmente únicos)
 *  3. driveId sem parentId → root de um Shared Drive específico
 */
export async function listFiles(opts: {
  parentId?: string;
  driveId?: string;
  query?: string;
  pageSize?: number;
}): Promise<DriveFile[]> {
  const drive = await driveClient();
  const parts: string[] = ["trashed = false"];

  if (opts.parentId) {
    // Dentro de uma pasta (qualquer drive)
    parts.push(`'${opts.parentId}' in parents`);
  } else if (opts.driveId) {
    // Root de um Shared Drive — parents = drive ID
    parts.push(`'${opts.driveId}' in parents`);
  } else {
    // Meu Drive root
    parts.push(`'root' in parents`);
  }

  if (opts.query) {
    parts.push(`name contains '${opts.query.replace(/'/g, "\\'")}'`);
  }

  const listOpts: drive_v3.Params$Resource$Files$List = {
    q: parts.join(" and "),
    pageSize: opts.pageSize ?? 100,
    fields: `files(${FIELDS})`,
    orderBy: "folder,name",
    ...SHARED_DRIVE_OPTS,
  };

  // Quando navegando em Shared Drive, restringir o corpora pra
  // performance (Google indexa drives separadamente).
  if (opts.driveId) {
    listOpts.corpora = "drive";
    listOpts.driveId = opts.driveId;
  }

  const res = await drive.files.list(listOpts);
  return (res.data.files ?? []).map(toDriveFile);
}

/**
 * Busca global por nome — varre Meu Drive + todos os Shared Drives
 * que o usuário pode acessar.
 */
export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = await driveClient();
  const res = await drive.files.list({
    q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: 50,
    fields: `files(${FIELDS})`,
    corpora: "allDrives",
    ...SHARED_DRIVE_OPTS,
  });
  return (res.data.files ?? []).map(toDriveFile);
}

export async function getFile(fileId: string): Promise<DriveFile> {
  const drive = await driveClient();
  const res = await drive.files.get({
    fileId,
    fields: FIELDS,
    supportsAllDrives: true,
  });
  return toDriveFile(res.data);
}

/**
 * Cria pasta. `parentId` pode ser:
 *  - ID de pasta em Meu Drive
 *  - ID de pasta em Shared Drive
 *  - ID de um Shared Drive (raíz do drive — Google trata o drive ID
 *    como parent ID válido)
 *  - undefined → cria em Meu Drive root
 */
export async function createFolder(name: string, parentId?: string): Promise<DriveFile> {
  const drive = await driveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: FIELDS,
    supportsAllDrives: true,
  });
  return toDriveFile(res.data);
}

/**
 * Pega o pai de um arquivo — usado pelo browser pra mostrar breadcrumb.
 * Retorna null se está no root (Meu Drive ou Shared Drive root).
 */
export async function getParent(fileId: string): Promise<DriveFile | null> {
  const drive = await driveClient();
  const res = await drive.files.get({
    fileId,
    fields: "parents,driveId",
    supportsAllDrives: true,
  });
  const parentId = res.data.parents?.[0];
  if (!parentId || parentId === "root") return null;

  // Se parentId == driveId, o arquivo está na raiz de um Shared Drive —
  // não há "pasta pai" navegável, mas vamos retornar o próprio drive
  // pra UI poder voltar pra raiz dele.
  const driveId = res.data.driveId;
  if (driveId && parentId === driveId) {
    return getFile(parentId).catch(() => null);
  }

  return getFile(parentId).catch(() => null);
}

// ─────────────────────────────────────────────────────────────────────
// Resolução do parent default pro onboarding automático de cliente.
//
// Resolução em 3 níveis (primeira que bate):
//  1. **Configuracao no DB** (UI `/admin/configuracoes`) — fonte da verdade
//     pro user final. Marcelo escolhe via dropdown sem mexer em env.
//  2. `ONBOARDING_DRIVE_PARENT_ID` no env — ID direto de pasta/Shared Drive.
//     Útil pra ambientes onde DB ainda não foi populado (primeira deploy).
//  3. `ONBOARDING_DRIVE_NAME` no env (default "Clientes SAL") — lookup
//     do Shared Drive por nome. Último recurso de "auto-detect".
//
// Fallback: null → onboarding cria em "Meu Drive" pessoal.
//
// Cache: o resultado fica em memória do processo. Invalidado quando a
// UI salva uma nova config (via `resetOnboardingParentCache()`).
// ─────────────────────────────────────────────────────────────────────

let cacheOnboardingParentId: { value: string | null; resolvido: boolean } = {
  value: null,
  resolvido: false,
};

export async function resolveOnboardingParentId(): Promise<string | null> {
  if (cacheOnboardingParentId.resolvido) return cacheOnboardingParentId.value;

  // 1. Configuração persistida no DB (UI admin)
  try {
    // Lazy import pra evitar ciclo `db ↔ google-drive` em rotas que
    // não tocam Prisma (ex: scripts standalone).
    const { prisma } = await import("@/lib/db");
    const cfg = await prisma.configuracao.findUnique({ where: { id: "default" } });
    if (cfg) {
      let resolved: string | null = null;
      if (cfg.onboardingDestinoTipo === "pasta" && cfg.onboardingParentId) {
        resolved = cfg.onboardingParentId;
      } else if (cfg.onboardingDestinoTipo === "shared_drive" && cfg.onboardingDriveId) {
        resolved = cfg.onboardingDriveId;
      } else if (cfg.onboardingDestinoTipo === "meu_drive") {
        resolved = null;
      }
      if (resolved !== null || cfg.onboardingDestinoTipo === "meu_drive") {
        cacheOnboardingParentId = { value: resolved, resolvido: true };
        return resolved;
      }
    }
  } catch (err) {
    console.warn("[google-drive] falha ao ler config de onboarding:", err);
  }

  // 2. Override direto via ID
  const envId = process.env.ONBOARDING_DRIVE_PARENT_ID?.trim();
  if (envId) {
    cacheOnboardingParentId = { value: envId, resolvido: true };
    return envId;
  }

  // 3. Lookup por nome de Shared Drive
  const nomeAlvo = (process.env.ONBOARDING_DRIVE_NAME ?? "Clientes SAL").trim();
  try {
    const drives = await listSharedDrives();
    const match = drives.find((d) => normalizarNome(d.name) === normalizarNome(nomeAlvo));
    if (match) {
      cacheOnboardingParentId = { value: match.id, resolvido: true };
      return match.id;
    }
  } catch (err) {
    console.warn("[google-drive] falha ao listar shared drives pra resolver onboarding parent:", err);
  }

  // 4. Fallback: Meu Drive (parentId=undefined no createFolder)
  cacheOnboardingParentId = { value: null, resolvido: true };
  return null;
}

/**
 * Limpa o cache do resolver. Chamado quando a UI admin salva uma nova
 * config — garante que a próxima chamada de onboarding pegue o valor
 * atualizado sem precisar de restart do container.
 */
export function resetOnboardingParentCache(): void {
  cacheOnboardingParentId = { value: null, resolvido: false };
}

function normalizarNome(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // remove acentos
    .trim();
}

function toDriveFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id ?? "",
    name: f.name ?? "(sem nome)",
    mimeType: f.mimeType ?? "application/octet-stream",
    iconLink: f.iconLink ?? null,
    webViewLink: f.webViewLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ?? null,
    parents: f.parents ?? null,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    driveId: f.driveId ?? null,
  };
}
