"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, Image as ImageIcon, FileType2, ArrowUp, Search, FolderPlus, Link2, ExternalLink, FolderOpen, FileX2, Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  iconLink?: string | null;
  modifiedTime?: string | null;
  isFolder: boolean;
};

type SharedDrive = { id: string; name: string; colorRgb?: string | null };

/**
 * Estado do drive selecionado. `null` = Meu Drive (pessoal).
 * Qualquer outro valor = id de um Shared Drive.
 *
 * Quando muda, resetamos a stack de navegação porque os IDs de pasta
 * são contextuais ao drive.
 */
type DriveSelecionado = SharedDrive | null;

export function DriveBrowser({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [stack, setStack] = useState<{ id: string; name: string }[]>([]);
  const [_parentLink, setParentLink] = useState<DriveFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [vincularDialog, setVincularDialog] = useState<DriveFile | null>(null);
  const [novaPasta, setNovaPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");

  // Lista de Shared Drives carregada uma vez. `driveSelecionado=null`
  // significa "Meu Drive" pessoal — caso default.
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [driveSelecionado, setDriveSelecionado] = useState<DriveSelecionado>(null);

  useEffect(() => {
    fetch("/api/drive/drives")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSharedDrives(data);
      })
      .catch(() => {
        // Sem Workspace ou sem permissão pra listar drives — silencioso,
        // user fica com "Meu Drive" apenas.
      });
  }, []);

  async function carregar(parentId?: string) {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (parentId) params.set("parentId", parentId);
      // Quando estamos na raiz de um Shared Drive (sem parentId na stack),
      // mandamos driveId pra API saber onde listar.
      else if (driveSelecionado) params.set("driveId", driveSelecionado.id);
      const url = `/api/drive/list${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        setErro(data.error);
        setFiles([]);
        setParentLink(null);
        return;
      }
      setFiles(data.files);
      setParentLink(data.parent);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(stack[stack.length - 1]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, driveSelecionado]);

  function trocarDrive(value: string) {
    // value = "meu" pra Meu Drive, ou id de um Shared Drive
    const novo = value === "meu" ? null : sharedDrives.find((d) => d.id === value) ?? null;
    setDriveSelecionado(novo);
    setStack([]); // Reset navegação ao trocar
    setBusca("");
  }

  async function buscar() {
    if (!busca.trim()) return carregar(stack[stack.length - 1]?.id);
    setLoading(true);
    // Busca global atravessa todos os drives — Marcelo geralmente quer
    // achar algo sem se preocupar onde tá.
    const res = await fetch(`/api/drive/search?q=${encodeURIComponent(busca)}`);
    const data = await res.json();
    setFiles(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function criarPasta() {
    if (!novaPastaNome.trim()) return;
    const parentId = stack[stack.length - 1]?.id;
    const body: Record<string, string> = { name: novaPastaNome };
    if (parentId) body.parentId = parentId;
    else if (driveSelecionado) body.driveId = driveSelecionado.id;

    const res = await fetch("/api/drive/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Erro ao criar pasta"); return; }
    toast.success("Pasta criada");
    setNovaPasta(false); setNovaPastaNome("");
    carregar(parentId);
  }

  if (erro) {
    return (
      <Card><CardContent className="py-12 text-center space-y-2">
        <p className="text-sm">{erro}</p>
        <p className="text-xs text-muted-foreground">Faça login com Google na tela de login para conceder acesso ao Drive.</p>
      </CardContent></Card>
    );
  }

  const driveLabel = driveSelecionado?.name ?? "Meu Drive";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Seletor de drive — só aparece se o user tem Shared Drives */}
        {sharedDrives.length > 0 && (
          <Select value={driveSelecionado?.id ?? "meu"} onValueChange={trocarDrive}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meu">
                <span className="inline-flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> Meu Drive
                </span>
              </SelectItem>
              {sharedDrives.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-sal-400" />
                    {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => setStack(stack.slice(0, -1))}>
          <ArrowUp className="h-4 w-4" /> Voltar
        </Button>
        <span className="text-xs text-muted-foreground font-mono truncate max-w-[40ch]">
          /{[driveLabel, ...stack.map((s) => s.name)].join("/")}
        </span>
        <div className="ml-auto flex gap-2">
          <div className="flex gap-1">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="h-8 w-48" onKeyDown={(e) => e.key === "Enter" && buscar()} />
            <Button variant="outline" size="sm" onClick={buscar}><Search className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNovaPasta(true)}><FolderPlus className="h-4 w-4" /> Nova pasta</Button>
        </div>
      </div>

      {novaPasta && (
        <Card>
          <CardContent className="p-3 flex gap-2">
            <Input autoFocus value={novaPastaNome} onChange={(e) => setNovaPastaNome(e.target.value)} placeholder="Nome da pasta" onKeyDown={(e) => e.key === "Enter" && criarPasta()} />
            <Button onClick={criarPasta}>Criar</Button>
            <Button variant="outline" onClick={() => setNovaPasta(false)}>Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-10 w-10 mx-auto" />
                <Skeleton className="h-3 w-4/5 mx-auto" />
                <Skeleton className="h-2.5 w-2/5 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={busca ? FileX2 : FolderOpen}
          titulo={busca ? `Nada com "${busca}"` : "Pasta vazia"}
          descricao={
            busca
              ? "Tenta outros termos ou volta pra raiz e navega manualmente."
              : "Crie uma nova pasta no botão acima, ou volte um nível pra navegar em outra parte do Drive."
          }
          variante="compact"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {files.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onOpen={() => f.isFolder ? setStack([...stack, { id: f.id, name: f.name }]) : window.open(f.webViewLink ?? "", "_blank")}
              onLink={() => setVincularDialog(f)}
            />
          ))}
        </div>
      )}

      {vincularDialog && (
        <VincularDialog file={vincularDialog} clientes={clientes} onClose={() => setVincularDialog(null)} />
      )}
    </div>
  );
}

function FileCard({ file, onOpen, onLink }: { file: DriveFile; onOpen: () => void; onLink: () => void }) {
  const Icon = iconFor(file.mimeType, file.isFolder);
  return (
    <Card className="hover:border-primary/40 transition-colors group">
      <CardContent className="p-4 space-y-2">
        <button onClick={onOpen} className="w-full flex flex-col items-center gap-2 text-left">
          <Icon className={`h-10 w-10 ${file.isFolder ? "text-amber-500" : "text-muted-foreground"}`} />
          <div className="text-xs font-medium truncate w-full text-center">{file.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{file.modifiedTime ? formatDate(file.modifiedTime) : ""}</div>
        </button>
        <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {file.webViewLink && (
            <a href={file.webViewLink} target="_blank" rel="noreferrer">
              <Badge variant="outline" className="cursor-pointer"><ExternalLink className="h-3 w-3 mr-1" />Abrir</Badge>
            </a>
          )}
          <button onClick={onLink}><Badge variant="outline" className="cursor-pointer"><Link2 className="h-3 w-3 mr-1" />Vincular</Badge></button>
        </div>
      </CardContent>
    </Card>
  );
}

function iconFor(mime: string, isFolder: boolean) {
  if (isFolder) return Folder;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileType2;
  return FileText;
}

function VincularDialog({ file, clientes, onClose }: { file: DriveFile; clientes: { id: string; nome: string }[]; onClose: () => void }) {
  const [clienteId, setClienteId] = useState("");
  async function vincular() {
    if (!clienteId) return;
    const res = await fetch("/api/drive/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        fileId: file.id,
        nome: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        isFolder: file.isFolder,
      }),
    });
    if (!res.ok) { toast.error("Erro ao vincular"); return; }
    toast.success("Vinculado ao cliente");
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <CardContent className="p-6 space-y-3">
          <div className="text-sm font-semibold">Vincular ao cliente</div>
          <p className="text-xs text-muted-foreground">{file.name}</p>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
            <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={vincular}>Vincular</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
