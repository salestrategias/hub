"use client";
/**
 * Cliente do Manual SAL — sidebar de seções + editor inline.
 *
 * Layout 2-colunas:
 *  - Esquerda: lista de seções da categoria (PLAYBOOK ou MARCA),
 *    hierarquia simples (1 nível de pai → filhas), drag-drop opcional
 *    no MVP é só clicável; reorder fica pra próxima iteração
 *  - Direita: header com título + ícone + botões + editor BlockNote
 *
 * Auto-save no editor (debounce 800ms via mesmo pattern de outras
 * páginas do Hub). Botão "Nova seção" no topo da sidebar.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import {
  BookOpen, Palette, Plus, Trash2, Eye, EyeOff, Share2, FileText, Search, Loader2,
} from "lucide-react";
import { slugify } from "@/lib/manual-helpers";

type Tipo = "PLAYBOOK" | "MARCA";

type SecaoBasica = {
  id: string;
  titulo: string;
  slug: string;
  icone: string | null;
  ordem: number;
  publicada: boolean;
  parentId: string | null;
};

type SecaoCompleta = {
  id: string;
  titulo: string;
  slug: string;
  icone: string | null;
  conteudo: string;
  publicada: boolean;
  atualizadoEm: string;
};

export function ManualClient({
  tipo,
  secaoAtual,
  secoes,
}: {
  tipo: Tipo;
  secaoAtual: SecaoCompleta;
  secoes: SecaoBasica[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Auto-save do conteúdo (debounce 800ms)
  const saving = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef<string>(secaoAtual.conteudo);

  function handleEditorChange(blocks: PartialBlock[]) {
    const json = JSON.stringify(blocks);
    valueRef.current = json;
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(async () => {
      try {
        setSalvando(true);
        const res = await fetch(`/api/manual/secoes/${secaoAtual.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: json }),
        });
        if (res.ok) setSavedAt(new Date().toISOString());
      } finally {
        setSalvando(false);
      }
    }, 800);
  }

  async function trocarTitulo(novo: string) {
    if (!novo.trim() || novo === secaoAtual.titulo) return;
    await fetch(`/api/manual/secoes/${secaoAtual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: novo }),
    });
    router.refresh();
  }

  async function togglePublicada() {
    await fetch(`/api/manual/secoes/${secaoAtual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicada: !secaoAtual.publicada }),
    });
    toast.success(secaoAtual.publicada ? "Movida pra rascunho" : "Publicada");
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir "${secaoAtual.titulo}"? Não tem volta.`)) return;
    await fetch(`/api/manual/secoes/${secaoAtual.id}`, { method: "DELETE" });
    toast.success("Excluída");
    router.push(`/manual/${tipo.toLowerCase()}`);
  }

  async function compartilhar() {
    const res = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entidadeTipo: "MANUAL_SECAO",
        entidadeId: secaoAtual.id,
      }),
    });
    if (!res.ok) {
      toast.error("Falha ao gerar link");
      return;
    }
    const share = await res.json();
    const url = `${window.location.origin}/p/share/${share.token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado pra área de transferência");
  }

  const filtradas = busca.trim()
    ? secoes.filter((s) => s.titulo.toLowerCase().includes(busca.toLowerCase()))
    : secoes;

  // Agrupa por parentId (1 nível de hierarquia)
  const raizes = filtradas.filter((s) => !s.parentId);
  const filhasPor = new Map<string, SecaoBasica[]>();
  for (const s of filtradas) {
    if (s.parentId) {
      const arr = filhasPor.get(s.parentId) ?? [];
      arr.push(s);
      filhasPor.set(s.parentId, arr);
    }
  }

  const HeaderIcon = tipo === "PLAYBOOK" ? BookOpen : Palette;
  const tipoLabel = tipo === "PLAYBOOK" ? "Playbook" : "Marca";

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-5">
      {/* ── Sidebar ──
         `top-[72px]` = altura do Header sticky (`py-3.5` + conteúdo ~= 68-72px).
         Sem isso, o topo da sidebar gruda em top=0 ao scrollar e fica
         escondido atrás do Header global. `h-[calc(100vh-88px)]` reserva
         espaço pro Header também ao calcular o overflow scroll interno. */}
      <aside className="space-y-2 md:sticky md:top-[72px] md:self-start md:h-[calc(100vh-88px)] md:overflow-y-auto pr-1">
        <Link href="/manual" className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition pt-1">
          ← Voltar ao Manual
        </Link>

        <div className="flex items-center gap-2 pt-1">
          <HeaderIcon className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold text-sm">{tipoLabel}</h2>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-6 w-6"
            onClick={() => setNovaOpen(true)}
            title="Nova seção"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar..."
            className="pl-7 h-7 text-xs"
          />
        </div>

        <nav className="space-y-0.5 pt-1">
          {raizes.map((s) => (
            <div key={s.id}>
              <ItemSidebar secao={s} tipo={tipo} atualId={secaoAtual.id} />
              {(filhasPor.get(s.id) ?? []).map((f) => (
                <div key={f.id} className="ml-3 border-l border-border pl-2">
                  <ItemSidebar secao={f} tipo={tipo} atualId={secaoAtual.id} />
                </div>
              ))}
            </div>
          ))}
          {raizes.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic px-2 py-3">
              {busca ? `Nada com "${busca}"` : "Nenhuma seção ainda — crie uma com o + acima"}
            </p>
          )}
        </nav>
      </aside>

      {/* ── Editor ── */}
      <div className="space-y-3 min-w-0">
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{secaoAtual.icone ?? "📄"}</span>
              <TituloEditavel
                inicial={secaoAtual.titulo}
                onSave={trocarTitulo}
              />
              {!secaoAtual.publicada && (
                <Badge variant="muted" className="text-[10px]">rascunho</Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                {salvando ? (
                  <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> salvando
                  </span>
                ) : savedAt ? (
                  <span className="text-[10.5px] text-muted-foreground/70 font-mono">
                    salvo às {new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border/40">
              <Button size="sm" variant="ghost" onClick={togglePublicada}>
                {secaoAtual.publicada ? (
                  <><EyeOff className="h-3.5 w-3.5" /> Mover pra rascunho</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" /> Publicar</>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={compartilhar}>
                <Share2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={excluir}
                className="text-destructive hover:text-destructive ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <BlockEditor
              key={secaoAtual.id}
              value={secaoAtual.conteudo}
              onChange={handleEditorChange}
              placeholder="Comece a escrever... Use / pra menu de blocos · @ pra mencionar entidades"
              minHeight="60vh"
            />
          </CardContent>
        </Card>
      </div>

      <NovaSecaoDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        tipo={tipo}
        secoesExistentes={secoes}
      />
    </div>
  );
}

function ItemSidebar({
  secao,
  tipo,
  atualId,
}: {
  secao: SecaoBasica;
  tipo: Tipo;
  atualId: string;
}) {
  const ativo = secao.id === atualId;
  return (
    <Link
      href={`/manual/${tipo.toLowerCase()}/${secao.slug}`}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] transition-colors ${
        ativo
          ? "bg-primary/15 text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      } ${!secao.publicada ? "opacity-60" : ""}`}
    >
      <span className="text-sm shrink-0">{secao.icone ?? <FileText className="h-3.5 w-3.5" />}</span>
      <span className="truncate flex-1">{secao.titulo}</span>
      {!secao.publicada && <span className="text-[9px] text-muted-foreground/60">rascunho</span>}
    </Link>
  );
}

function TituloEditavel({
  inicial,
  onSave,
}: {
  inicial: string;
  onSave: (novo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inicial);

  useEffect(() => {
    setValor(inicial);
  }, [inicial]);

  if (editando) {
    return (
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          onSave(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setValor(inicial);
            setEditando(false);
          }
        }}
        className="h-8 font-display text-lg font-semibold flex-1"
      />
    );
  }

  return (
    <h1
      className="font-display text-lg md:text-xl font-semibold flex-1 cursor-text"
      onClick={() => setEditando(true)}
      title="Clique pra editar"
    >
      {valor}
    </h1>
  );
}

function NovaSecaoDialog({
  open,
  onOpenChange,
  tipo,
  secoesExistentes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipo: Tipo;
  secoesExistentes: SecaoBasica[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [icone, setIcone] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (!titulo.trim()) return;
    setCriando(true);
    try {
      const res = await fetch(`/api/manual/${tipo.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          titulo: titulo.trim(),
          slug: slugify(titulo.trim()),
          icone: icone.trim() || null,
          parentId: parentId || null,
          conteudo: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao criar");
        return;
      }
      toast.success("Seção criada");
      setTitulo("");
      setIcone("");
      setParentId("");
      onOpenChange(false);
      router.push(`/manual/${tipo.toLowerCase()}/${data.slug}`);
    } finally {
      setCriando(false);
    }
  }

  // Só seções raiz podem ser pai (evita aninhamento de 2+ níveis)
  const possiveisPais = secoesExistentes.filter((s) => !s.parentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova seção</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[60px_1fr] gap-3">
            <div className="space-y-1">
              <label className="text-xs">Ícone</label>
              <Input
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                placeholder="🎨"
                maxLength={4}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Título</label>
              <Input
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Workflow de aprovação"
                onKeyDown={(e) => e.key === "Enter" && criar()}
              />
            </div>
          </div>

          {possiveisPais.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs">Sub-seção de (opcional)</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">— seção raiz —</option>
                {possiveisPais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icone ?? "📄"} {p.titulo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={criar} disabled={!titulo.trim() || criando}>
            {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
