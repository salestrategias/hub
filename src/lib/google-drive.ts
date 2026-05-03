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
};

const FIELDS = "id,name,mimeType,iconLink,webViewLink,modifiedTime,size,parents";

export async function driveClient() {
  const auth = await getGoogleClient();
  return google.drive({ version: "v3", auth });
}

export async function listFiles(opts: {
  parentId?: string;
  query?: string;
  pageSize?: number;
}): Promise<DriveFile[]> {
  const drive = await driveClient();
  const parts: string[] = ["trashed = false"];
  if (opts.parentId) parts.push(`'${opts.parentId}' in parents`);
  else parts.push(`'root' in parents`);
  if (opts.query) parts.push(`name contains '${opts.query.replace(/'/g, "\\'")}'`);

  const res = await drive.files.list({
    q: parts.join(" and "),
    pageSize: opts.pageSize ?? 100,
    fields: `files(${FIELDS})`,
    orderBy: "folder,name",
  });

  return (res.data.files ?? []).map(toDriveFile);
}

export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = await driveClient();
  const res = await drive.files.list({
    q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: 50,
    fields: `files(${FIELDS})`,
  });
  return (res.data.files ?? []).map(toDriveFile);
}

export async function getFile(fileId: string): Promise<DriveFile> {
  const drive = await driveClient();
  const res = await drive.files.get({ fileId, fields: FIELDS });
  return toDriveFile(res.data);
}

export async function createFolder(name: string, parentId?: string): Promise<DriveFile> {
  const drive = await driveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: FIELDS,
  });
  return toDriveFile(res.data);
}

export async function getParent(fileId: string): Promise<DriveFile | null> {
  const drive = await driveClient();
  const res = await drive.files.get({ fileId, fields: "parents" });
  const parentId = res.data.parents?.[0];
  if (!parentId || parentId === "root") return null;
  return getFile(parentId);
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
  };
}
