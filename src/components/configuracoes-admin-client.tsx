"use client";
/**
 * Editor de configurações globais (singleton).
 *
 * Hoje só cobre onboarding (destino de pastas de cliente novo).
 * Estrutura preparada pra crescer com mais seções no futuro
 * (notificações, integrações, etc).
 *
 * UX do destino:
 *  - 3 radios: Meu Drive | Shared Drive | Pasta específica
 *  - "Shared Drive" mostra dropdown com a lista (vinda de /api/drive/drives)
 *  - "Pasta específica" abre um navegador inline pra escolher (reusa
 *    o mesmo endpoint /api/drive/list)
 *  - Preview do path resultante em cada modo
 *  - Save dispara PATCH + toast + invalida cache server-side
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { FolderOpen, Users, Folder, ChevronRight, ArrowUp, Loader2, Save, FolderCheck } from "lucide-react";

type Tipo = "meu_drive" | "shared_drive" | "pasta";

type Configuracao = {
  id: string;
  onboardingDestinoTipo: string;
  onboardingDriveId: string | null;
  onboardingDriveNome: string | null;
  onboardingParentId: string | null;
  onboardingParentNome: string | null;
};

type SharedDrive = { id: string; name: string };
type DriveFile = { id: string; name: string; isFolder: boolean; webViewLink?: string | null };

export function ConfiguracoesAdminClient({ configInicial }: { configInicial: Configuracao }) {
  const [tipo, setTipo] = useState<Tipo>(
    (configInicial.onboardingDestinoTipo as Tipo) ?? "shared_drive"
  );
  const [driveId, setDriveId] = useState<string | null>(configInicial.onboardingDriveId);
  const [driveNome, setDriveNome] = useState<string | null>(configInicial.onboardingDriveNome);
  const [parentId, setParentId] = useState<string | null>(configInicial.onboardingParentId);
  const [parentNome, setParentNome] = useState<string | null>(configInicial.onboardingParentNome);

  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [carregandoDrives, setCarregandoDrives] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    fetch("/api/drive/drives")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSharedDrives(data);
      })
      .catch(() => {})
      .finally(() => setCarregandoDrives(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const payload: Record<string, string | null> = {
        onboardingDestinoTipo: tipo,
      };

      if (tipo === "shared_drive") {
        if (!driveId) {
          toast.error("Selecione um Drive Compartilhado");
          return;
        }
        payload.onboardingDriveId = driveId;
        payload.onboardingDriveNome = driveNome;
        payload.onboardingParentId = null;
        payload.onboardingParentNome = null;
      } else if (tipo === "pasta") {
        if (!parentId) {
          toast.error("Selecione uma pasta específica");
          return;
        }
        payload.onboardingParentId = parentId;
        payload.onboardingParentNome = parentNome;
        // Mantém driveId pra contexto, mas não obrigatório
      } else {
        // meu_drive: limpa tudo
        payload.onboardingDriveId = null;
        payload.onboardingDriveNome = null;
        payload.onboardingParentId = null;
        payload.onboardingParentNome = null;
      }

      const res = await fetch("/api/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao salvar");
        return;
      }
      toast.success("Configuração salva. Clientes novos vão pra esse destino.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderCheck className="h-4 w-4 text-primary" />
            Onboarding de cliente — destino no Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Quando um cliente novo é ativado (criado direto, promovido, ou convertido de lead),
            o sistema cria automaticamente uma pasta com o nome dele. Aqui você escolhe onde.
          </p>

          <div className="space-y-3">
            <RadioCard
              checked={tipo === "shared_drive"}
              onClick={() => setTipo("shared_drive")}
              icon={Users}
              titulo="Drive Compartilhado (recomendado)"
              descricao="Cria as pastas na raiz de um Shared Drive — visível pra equipe inteira."
            >
              {tipo === "shared_drive" && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Drive Compartilhado</Label>
                  <Select
                    value={driveId ?? ""}
                    onValueChange={(v) => {
                      setDriveId(v);
                      const d = sharedDrives.find((x) => x.id === v);
                      setDriveNome(d?.name ?? null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={carregandoDrives ? "Carregando..." : "Selecionar drive..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {sharedDrives.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="inline-flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-sal-400" /> {d.name}
                          </span>
                        </SelectItem>
                      ))}
                      {sharedDrives.length === 0 && !carregandoDrives && (
                        <div className="p-2 text-xs text-muted-foreground">
                          Nenhum Drive Compartilhado encontrado. Crie um no Google Drive e dê acesso à conta logada.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {driveId && (
                    <p className="text-[11px] text-muted-foreground">
                      Path resultante: <span className="font-mono">/{driveNome}/Nome do Cliente</span>
                    </p>
                  )}
                </div>
              )}
            </RadioCard>

            <RadioCard
              checked={tipo === "pasta"}
              onClick={() => setTipo("pasta")}
              icon={Folder}
              titulo="Pasta específica (qualquer Drive)"
              descricao="Cria dentro de uma sub-pasta — útil pra organizar por ano, segmento, etc."
            >
              {tipo === "pasta" && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {parentNome ?? "(nenhuma pasta selecionada)"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => setBrowserOpen(true)}>
                      <FolderOpen className="h-3.5 w-3.5" />
                      {parentId ? "Trocar pasta" : "Selecionar pasta"}
                    </Button>
                  </div>
                  {parentNome && (
                    <p className="text-[11px] text-muted-foreground">
                      Path resultante: <span className="font-mono">.../{parentNome}/Nome do Cliente</span>
                    </p>
                  )}
                </div>
              )}
            </RadioCard>

            <RadioCard
              checked={tipo === "meu_drive"}
              onClick={() => setTipo("meu_drive")}
              icon={FolderOpen}
              titulo="Meu Drive pessoal"
              descricao="Pastas ficam na conta do usuário logado. Bom pra teste; ruim pra equipe (ninguém mais vê)."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {browserOpen && (
        <PastaBrowserModal
          onClose={() => setBrowserOpen(false)}
          onSelect={(f) => {
            setParentId(f.id);
            setParentNome(f.name);
            setBrowserOpen(false);
          }}
          sharedDrives={sharedDrives}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RadioCard — cartão clicável estilo radio com slot pra conteúdo extra
// ─────────────────────────────────────────────────────────────────────
function RadioCard({
  checked,
  onClick,
  icon: Icon,
  titulo,
  descricao,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${checked ? "border-primary" : "border-muted-foreground/40"}`}>
          {checked && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{titulo}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{descricao}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Modal de navegação de pastas — versão simplificada do DriveBrowser,
// só lista pastas e permite escolher uma.
// ─────────────────────────────────────────────────────────────────────
function PastaBrowserModal({
  onClose,
  onSelect,
  sharedDrives,
}: {
  onClose: () => void;
  onSelect: (f: { id: string; name: string }) => void;
  sharedDrives: SharedDrive[];
}) {
  const [stack, setStack] = useState<{ id: string; name: string }[]>([]);
  const [driveSelecionado, setDriveSelecionado] = useState<SharedDrive | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  async function carregar(parentId?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (parentId) params.set("parentId", parentId);
      else if (driveSelecionado) params.set("driveId", driveSelecionado.id);
      const res = await fetch(`/api/drive/list?${params}`);
      const data = await res.json();
      if (Array.isArray(data.files)) {
        // Só pastas
        setFiles(data.files.filter((f: DriveFile) => f.isFolder));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(stack[stack.length - 1]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, driveSelecionado]);

  function trocarDrive(value: string) {
    const novo = value === "meu" ? null : sharedDrives.find((d) => d.id === value) ?? null;
    setDriveSelecionado(novo);
    setStack([]);
  }

  const driveLabel = driveSelecionado?.name ?? "Meu Drive";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Selecionar pasta de destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {sharedDrives.length > 0 && (
              <Select value={driveSelecionado?.id ?? "meu"} onValueChange={trocarDrive}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meu">Meu Drive</SelectItem>
                  {sharedDrives.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => setStack(stack.slice(0, -1))}>
              <ArrowUp className="h-3.5 w-3.5" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[30ch]">
              /{[driveLabel, ...stack.map((s) => s.name)].join("/")}
            </span>
          </div>

          <div className="rounded-md border border-border max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Carregando...</div>
            ) : files.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Sem subpastas aqui.</div>
            ) : (
              files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-muted/50 cursor-pointer group"
                  onClick={() => setStack([...stack, { id: f.id, name: f.name }])}
                >
                  <Folder className="h-4 w-4 text-amber-500" />
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ id: f.id, name: f.name });
                    }}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    Selecionar esta
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[11px] text-muted-foreground">
              Clica na pasta pra entrar. Botão "Selecionar esta" pra escolher.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              {stack.length > 0 && (
                <Button
                  onClick={() =>
                    onSelect({ id: stack[stack.length - 1].id, name: stack[stack.length - 1].name })
                  }
                >
                  Usar pasta atual
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
