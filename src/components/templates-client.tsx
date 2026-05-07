"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateTipo } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Plus, Search, Trash2, FileText, FilterX, Sparkles, Pencil, Copy, Wand2 } from "lucide-react";
import { BlockEditor } from "@/components/editor";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { VARIAVEIS_DISPONIVEIS } from "@/lib/template-variables";

type Template = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TemplateTipo;
  categoria: string | null;
  icone: string | null;
  cor: string | null;
  conteudo: string;
  criadoPor: string | null;
  quantidadeUsos: number;
  ultimoUso: string | null;
  updatedAt: string;
};

const TIPO_LABEL: Record<TemplateTipo, string> = {
  NOTA: "Nota",
  REUNIAO: "Reunião",
  BRIEFING: "Briefing",
  TAREFA: "Tarefa",
  PROJETO: "Projeto",
};

const TIPO_FILTROS: Array<TemplateTipo | "TODOS"> = ["TODOS", "NOTA", "REUNIAO", "BRIEFING", "TAREFA", "PROJETO"];

export function TemplatesClient({ initial }: { initial: Template[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initial);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TemplateTipo | "TODOS">("TODOS");
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);

  const filtrados = useMemo(() => {
    return templates.filter((t) => {
      if (filtroTipo !== "TODOS" && t.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          t.nome.toLowerCase().includes(q) ||
          (t.descricao?.toLowerCase().includes(q) ?? false) ||
          (t.categoria?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [templates, busca, filtroTipo]);

  function refresh(t: Template, mode: "create" | "update" | "delete") {
    if (mode === "delete") {
      setTemplates(templates.filter((x) => x.id !== t.id));
    } else if (mode === "create") {
      setTemplates([t, ...templates]);
    } else {
      setTemplates(templates.map((x) => (x.id === t.id ? t : x)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar templates..."
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SeedBuiltinsButton onSeeded={() => router.refresh()} />
          <VariaveisHelpButton />
          <Button onClick={() => setCriando(true)} size="sm">
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        </div>
      </div>

      <Tabs value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TemplateTipo | "TODOS")}>
        <TabsList>
          {TIPO_FILTROS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "TODOS" ? "Todos" : TIPO_LABEL[t as TemplateTipo]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={busca || filtroTipo !== "TODOS" ? FilterX : Sparkles}
          titulo={busca || filtroTipo !== "TODOS" ? "Nenhum template encontrado" : "Sem templates ainda"}
          descricao={
            busca || filtroTipo !== "TODOS"
              ? "Ajuste os filtros ou cria um template novo."
              : "Crie templates pra padronizar briefings, atas, relatórios e propostas. Variáveis como {{cliente.nome}} são preenchidas automaticamente."
          }
          acaoLabel="Novo template"
          acaoOnClick={() => setCriando(true)}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((t) => (
            <TemplateCard key={t.id} template={t} onEdit={() => setEditando(t)} onChange={refresh} />
          ))}
        </div>
      )}

      {(criando || editando) && (
        <TemplateEditor
          template={editando}
          onClose={() => {
            setCriando(false);
            setEditando(null);
          }}
          onSaved={(saved, mode) => {
            refresh(saved, mode);
            setCriando(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onChange,
}: {
  template: Template;
  onEdit: () => void;
  onChange: (t: Template, mode: "delete") => void;
}) {
  const router = useRouter();
  const isBuiltIn = template.criadoPor === null;

  async function instanciar() {
    const res = await fetch(`/api/templates/${template.id}/instanciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      toast.error("Falha ao usar template");
      return;
    }
    const result = (await res.json()) as { id: string; redirect: string };
    router.push(result.redirect);
  }

  async function duplicar() {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: `${template.nome} (cópia)`,
        descricao: template.descricao,
        tipo: template.tipo,
        categoria: template.categoria,
        icone: template.icone,
        cor: template.cor,
        conteudo: template.conteudo,
        compartilhado: false,
      }),
    });
    if (!res.ok) {
      toast.error("Falha ao duplicar");
      return;
    }
    toast.success("Template duplicado");
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir o template "${template.nome}"?`)) return;
    const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Erro ao excluir");
      return;
    }
    onChange(template, "delete");
    toast.success("Template excluído");
  }

  return (
    <Card className="group hover:border-primary/40 transition">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-md flex items-center justify-center text-lg shrink-0"
            style={{
              background: `${template.cor ?? "#7E30E1"}20`,
              color: template.cor ?? "#7E30E1",
            }}
          >
            {template.icone ?? <FileText className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[13.5px] leading-tight truncate">
              {template.nome.replace(/\{\{[^}]+\}\}/g, "…")}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {TIPO_LABEL[template.tipo]}
              </Badge>
              {template.categoria && (
                <span className="text-[10px] text-muted-foreground">{template.categoria}</span>
              )}
              {isBuiltIn && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
            </div>
          </div>
        </div>

        {template.descricao && (
          <p className="text-[11.5px] text-muted-foreground line-clamp-2">{template.descricao}</p>
        )}

        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground/70 font-mono">
          <span>
            {template.quantidadeUsos > 0
              ? `Usado ${template.quantidadeUsos}×`
              : "Nunca usado"}
          </span>
          {template.ultimoUso && (
            <span>último: {new Date(template.ultimoUso).toLocaleDateString("pt-BR")}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 -mx-1">
          <Button size="sm" variant="ghost" className="h-7 text-[11px] flex-1 justify-center" onClick={instanciar}>
            <Sparkles className="h-3 w-3" /> Usar
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={duplicar} title="Duplicar">
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:text-destructive"
            onClick={excluir}
            title={isBuiltIn ? "Excluir (requer admin)" : "Excluir"}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: (t: Template, mode: "create" | "update") => void;
}) {
  const isEdit = !!template;
  const [nome, setNome] = useState(template?.nome ?? "");
  const [descricao, setDescricao] = useState(template?.descricao ?? "");
  const [tipo, setTipo] = useState<TemplateTipo>(template?.tipo ?? "NOTA");
  const [categoria, setCategoria] = useState(template?.categoria ?? "");
  const [icone, setIcone] = useState(template?.icone ?? "");
  const [cor, setCor] = useState(template?.cor ?? "#7E30E1");
  const [conteudoRef, setConteudoRef] = useState<string>(template?.conteudo ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setSalvando(true);
    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      tipo,
      categoria: categoria.trim() || null,
      icone: icone.trim() || null,
      cor: cor.trim() || null,
      conteudo: conteudoRef,
      compartilhado: true,
    };

    try {
      const res = await fetch(isEdit ? `/api/templates/${template!.id}` : "/api/templates", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao salvar");
      }
      const saved: Template = await res.json();
      onSaved(saved, isEdit ? "update" : "create");
      toast.success(isEdit ? "Template atualizado" : "Template criado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle>{isEdit ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Briefing — {{cliente.nome}}"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Para que serve este template?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TemplateTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTA">Nota</SelectItem>
                  <SelectItem value="BRIEFING">Briefing</SelectItem>
                  <SelectItem value="REUNIAO">Reunião</SelectItem>
                  <SelectItem value="TAREFA">Tarefa</SelectItem>
                  <SelectItem value="PROJETO">Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Onboarding, Estratégia, Operacional..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ícone (emoji)</Label>
              <Input value={icone} onChange={(e) => setIcone(e.target.value)} placeholder="📋" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor (hex)</Label>
              <div className="flex gap-2">
                <Input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="#7E30E1" />
                <div className="h-9 w-9 rounded-md border border-border shrink-0" style={{ background: cor }} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo</Label>
            <p className="text-[11px] text-muted-foreground">
              Use <code className="bg-secondary px-1 py-0.5 rounded font-mono">{"{{variaveis}}"}</code> para
              expansão automática. Veja a lista clicando em "Variáveis disponíveis" no topo.
            </p>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <BlockEditor
                value={template?.conteudo ?? ""}
                onChange={(blocks) => setConteudoRef(JSON.stringify(blocks))}
                placeholder="Estrutura do template — / abre menu de blocos, @ menciona entidades."
                minHeight="40vh"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
          <DialogClose asChild>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botão para repopular os built-ins via /api/admin/seed-templates.
 * Útil quando um deploy inicial acabou de subir e a tabela Template está vazia,
 * ou quando os built-ins foram atualizados (idempotente: só atualiza pelo nome).
 *
 * Backend filtra por role=ADMIN — botão fica visível pra todos mas só funciona
 * pra admin (mostra erro pra demais).
 */
function SeedBuiltinsButton({ onSeeded }: { onSeeded: () => void }) {
  const [loading, setLoading] = useState(false);

  async function rodar() {
    if (!confirm("Repopular templates do sistema? Isso atualiza/cria os built-ins (Briefing, Ata, Relatório, Pauta, Estratégia).")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seed-templates", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const data = await res.json();
      toast.success(`${data.builtins ?? 0} templates do sistema atualizados`);
      onSeeded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={rodar} disabled={loading}>
      <Wand2 className="h-3.5 w-3.5" /> {loading ? "..." : "Sincronizar built-ins"}
    </Button>
  );
}

function VariaveisHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" /> Variáveis disponíveis
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Variáveis disponíveis</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            <p className="text-[11.5px] text-muted-foreground">
              Use as variáveis abaixo no nome ou conteúdo. São expandidas no momento que o template é instanciado.
            </p>
            <div className="space-y-1.5">
              {VARIAVEIS_DISPONIVEIS.map((v) => (
                <div
                  key={v.chave}
                  className={cn(
                    "flex items-start gap-3 px-2.5 py-2 rounded-md border border-border bg-background/40"
                  )}
                >
                  <code className="text-[11px] font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">
                    {v.chave}
                  </code>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium">{v.descricao}</div>
                    <div className="text-[10.5px] text-muted-foreground font-mono">{v.exemplo}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
