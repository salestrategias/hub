"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, Image as ImageIcon, FileType2, ArrowUp, Search, FolderPlus, Link2, ExternalLink, FolderOpen, FileX2 } from "lucide-react";
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

export function DriveBrowser({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [stack, setStack] = useState<{ id: string; name: string }[]>([]);
  const [parentLink, setParentLink] = useState<DriveFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [vincularDialog, setVincularDialog] = useState<DriveFile | null>(null);
  const [novaPasta, setNovaPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");

  async function carregar(parentId?: string) {
    setLoading(true);
    setErro(null);
    try {
      const url = parentId ? `/api/drive/list?parentId=${parentId}` : "/api/drive/list";
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
  }, [stack]);

  async function buscar() {
    if (!busca.trim()) return carregar(stack[stack.length - 1]?.id);
    setLoading(true);
    const res = await fetch(`/api/drive/search?q=${encodeURIComponent(busca)}`);
    const data = await res.json();
    setFiles(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function criarPasta() {
    if (!novaPastaNome.trim()) return;
    const res = await fetch("/api/drive/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: novaPastaNome, parentId: stack[stack.length - 1]?.id }),
    });
    if (!res.ok) { toast.error("Erro ao criar pasta"); return; }
    toast.success("Pasta criada");
    setNovaPasta(false); setNovaPastaNome("");
    carregar(stack[stack.length - 1]?.id);
  }

  if (erro) {
    return (
      <Card><CardContent className="py-12 text-center space-y-2">
        <p className="text-sm">{erro}</p>
        <p className="text-xs text-muted-foreground">Faça login com Google na tela de login para conceder acesso ao Drive.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => setStack(stack.slice(0, -1))}>
          <ArrowUp className="h-4 w-4" /> Voltar
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          /{stack.map((s) => s.name).join("/") || "Meu Drive"}
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
