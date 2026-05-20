"use client";
/**
 * Quick Create — captura rápida pra entidades além de Nota.
 *
 * Atalhos (com Shift pra não conflitar com `C` da QuickCapture nem com
 * atalhos navegacionais G/L/T do AtalhosGlobais):
 *
 *   Shift+L → Novo Lead
 *   Shift+T → Nova Tarefa
 *   Shift+F → Novo Lançamento Financeiro
 *
 * Cada modal tem 4-6 campos essenciais. Refinamento (notas, tags, etc)
 * fica pro detalhe da entidade. Igual ao QuickCaptureModal de Nota.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MoneyInput } from "@/components/money-input";
import { Zap, TrendingUp, ListTodo, DollarSign, Loader2 } from "lucide-react";

type Modal = null | "lead" | "tarefa" | "lancamento";

type Ctx = {
  abrir: (m: Exclude<Modal, null>) => void;
  fechar: () => void;
};

const QuickCreateCtx = createContext<Ctx | null>(null);

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable;
}

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<Modal>(null);

  const abrir = useCallback((m: Exclude<Modal, null>) => setModal(m), []);
  const fechar = useCallback(() => setModal(null), []);

  // Atalhos: Shift + L/T/F. Não dispara se foco em texto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Precisa de Shift, mas SEM Ctrl/Cmd/Alt (deixa o user fazer Cmd+L abrir address bar)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!e.shiftKey) return;
      if (isEditing()) return;

      const k = e.key.toUpperCase();
      let alvo: Modal = null;
      if (k === "L") alvo = "lead";
      else if (k === "T") alvo = "tarefa";
      else if (k === "F") alvo = "lancamento";
      if (!alvo) return;

      e.preventDefault();
      e.stopPropagation();
      setModal(alvo);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QuickCreateCtx.Provider value={{ abrir, fechar }}>
      {children}
      {modal === "lead" && <QuickLeadModal onClose={fechar} />}
      {modal === "tarefa" && <QuickTarefaModal onClose={fechar} />}
      {modal === "lancamento" && <QuickLancamentoModal onClose={fechar} />}
    </QuickCreateCtx.Provider>
  );
}

export function useQuickCreate() {
  const ctx = useContext(QuickCreateCtx);
  if (!ctx) return { abrir: () => undefined, fechar: () => undefined };
  return ctx;
}

// ─── Modal: Novo Lead ──────────────────────────────────────────
function QuickLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [valorMensal, setValorMensal] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!empresa.trim()) {
      toast.error("Empresa obrigatória");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: empresa.trim(),
          contatoNome: contatoNome.trim() || null,
          contatoEmail: contatoEmail.trim() || null,
          contatoTelefone: contatoTelefone.trim() || null,
          valorEstimadoMensal: valorMensal,
          status: "NOVO",
          prioridade: "NORMAL",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success("Lead criado", { description: empresa });
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Novo Lead <KbdHint>Shift + L</KbdHint>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Empresa *">
            <Input autoFocus value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Pizzaria do João" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contato">
              <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="João Silva" />
            </Field>
            <Field label="Telefone">
              <Input value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} placeholder="(51) 9..." />
            </Field>
            <Field label="Email" cls="col-span-2">
              <Input type="email" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
            </Field>
            <Field label="Valor estimado/mês" cls="col-span-2">
              <MoneyInput value={valorMensal} onChange={setValorMensal} placeholder="3.500" />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Criar lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Nova Tarefa ────────────────────────────────────────
function QuickTarefaModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<"URGENTE" | "ALTA" | "NORMAL" | "BAIXA">("NORMAL");
  const [dataEntrega, setDataEntrega] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => Array.isArray(d) ? setClientes(d.map((c) => ({ id: c.id, nome: c.nome }))) : null)
      .catch(() => undefined);
  }, []);

  async function criar() {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          prioridade,
          dataEntrega: dataEntrega ? new Date(dataEntrega).toISOString() : null,
          clienteId: clienteId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success("Tarefa criada", { description: titulo });
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            Nova Tarefa <KbdHint>Shift + T</KbdHint>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Título *">
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Mandar proposta pra cliente X"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade">
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prazo">
              <Input type="datetime-local" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
            </Field>
            <Field label="Cliente (opcional)" cls="col-span-2">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Novo Lançamento Financeiro ─────────────────────────
function QuickLancamentoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [tipo, setTipo] = useState<"RECEITA" | "DESPESA">("DESPESA");
  const [categoria, setCategoria] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState<string>("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => Array.isArray(d) ? setClientes(d.map((c) => ({ id: c.id, nome: c.nome }))) : null)
      .catch(() => undefined);
  }, []);

  async function criar() {
    if (!descricao.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    if (valor === null || valor === 0) {
      toast.error("Valor obrigatório");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: descricao.trim(),
          valor,
          tipo,
          categoria: categoria.trim() || null,
          data: new Date(data).toISOString(),
          clienteId: clienteId || null,
          entidade: "PJ",
          recorrente: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success(`${tipo === "RECEITA" ? "Receita" : "Despesa"} registrada`, { description: descricao });
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  // Categorias pré-definidas comuns na SAL — depende do tipo
  const CATEGORIAS_DESPESA = ["Anúncios", "Salários", "Software", "Impostos", "Aluguel", "Pró-labore", "Marketing", "Serviços", "Outros"];
  const CATEGORIAS_RECEITA = ["Mensalidade", "Projeto pontual", "Comissão", "Reembolso", "Outros"];
  const categorias = tipo === "RECEITA" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Novo Lançamento <KbdHint>Shift + F</KbdHint>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Descrição *">
            <Input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Meta Ads — campanha X" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={tipo} onValueChange={(v) => { setTipo(v as typeof tipo); setCategoria(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESPESA">Despesa</SelectItem>
                  <SelectItem value="RECEITA">Receita</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor *">
              <MoneyInput value={valor} onChange={setValor} placeholder="500,00" />
            </Field>
            <Field label="Categoria">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Cliente (opcional)" cls="col-span-2">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───────────────────────────────────────────────────
function Field({ label, children, cls }: { label: string; children: React.ReactNode; cls?: string }) {
  return (
    <div className={`space-y-1.5 ${cls ?? ""}`}>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 border border-border rounded px-1.5 py-0.5 bg-muted/30">
      {children}
    </span>
  );
}
