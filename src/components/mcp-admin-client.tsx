"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Plus, Trash2, Copy, Check, AlertTriangle, Cpu, Shield, Pencil } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { SCOPE_GROUPS, PRESETS, type Scope } from "@/lib/mcp/scopes";

type Token = {
  id: string;
  nome: string;
  prefixo: string;
  ultimoUso: string | null;
  expiraEm: string | null;
  revogadoEm: string | null;
  totalChamadas: number;
  createdAt: string;
  escopos: string[];
};

export function McpAdminClient({ tokens: initial }: { tokens: Token[] }) {
  const router = useRouter();
  const [tokens, setTokens] = useState(initial);
  const [open, setOpen] = useState(false);
  const [tokenCriado, setTokenCriado] = useState<{ token: string; nome: string; escopos: string[] } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [editandoEscopos, setEditandoEscopos] = useState<Token | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://hub.sal.com.br";

  async function revogar(id: string, name: string) {
    if (!confirm(`Revogar o token "${name}"? O Claude Desktop perderá acesso imediatamente.`)) return;
    const res = await fetch(`/api/admin/mcp-tokens/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao revogar"); return; }
    toast.success("Token revogado");
    setTokens(tokens.map((t) => t.id === id ? { ...t, revogadoEm: new Date().toISOString() } : t));
  }

  async function copiarToken() {
    if (!tokenCriado) return;
    await navigator.clipboard.writeText(tokenCriado.token);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const ativos = tokens.filter((t) => !t.revogadoEm).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tokens ativos" value={String(ativos)} />
        <KpiCard label="Tokens revogados" value={String(tokens.length - ativos)} />
        <KpiCard
          label="Chamadas totais"
          value={tokens.reduce((s, t) => s + t.totalChamadas, 0).toLocaleString("pt-BR")}
        />
        <KpiCard label="Tools disponíveis" value="31" hint="ver lista abaixo" />
      </div>

      <Card style={{ background: "linear-gradient(135deg, rgba(126,48,225,0.08), transparent 60%)", borderColor: "rgba(126,48,225,0.3)" }}>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(126,48,225,0.18)" }}>
            <Cpu className="h-5 w-5 text-sal-400" />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-[15px]">Servidor MCP do SAL Hub</div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              O servidor está ativo em <code className="font-mono text-sal-400">{baseUrl}/api/mcp</code>.
              Conecte o Claude Desktop ou Claude Code abaixo para automatizar tudo: criar clientes,
              gerar resumos de reuniões, extrair action items, escrever copy, organizar notas — via linguagem natural.
              Cada token pode ter escopos limitados (ex: só leitura, sem financeiro).
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="conexao">Como conectar</TabsTrigger>
          <TabsTrigger value="tools">Tools disponíveis</TabsTrigger>
          <TabsTrigger value="exemplos">Exemplos de uso</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-3">
          <div className="flex justify-end">
            <NovoTokenDialog
              open={open}
              setOpen={setOpen}
              onCreated={(payload) => {
                setTokenCriado({ token: payload.token, nome: payload.nome, escopos: payload.escopos });
                router.refresh();
              }}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Escopos</TableHead>
                    <TableHead>Último uso</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.prefixo}…</TableCell>
                      <TableCell>
                        {t.revogadoEm ? (
                          <Badge variant="muted">Revogado</Badge>
                        ) : t.expiraEm && new Date(t.expiraEm) < new Date() ? (
                          <Badge variant="warning">Expirado</Badge>
                        ) : (
                          <Badge variant="success">Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell><EscoposBadges escopos={t.escopos} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.ultimoUso ? new Date(t.ultimoUso).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{t.totalChamadas.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        {!t.revogadoEm && (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditandoEscopos(t)} title="Editar escopos">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => revogar(t.id, t.nome)} title="Revogar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tokens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Nenhum token criado ainda. Clique em "Novo token" para começar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conexao">
          <ConnectionGuide baseUrl={baseUrl} />
        </TabsContent>

        <TabsContent value="tools">
          <ToolsList />
        </TabsContent>

        <TabsContent value="exemplos">
          <Examples />
        </TabsContent>
      </Tabs>

      {/* Modal de exibição do token recém-criado */}
      <Dialog open={!!tokenCriado} onOpenChange={(o) => !o && setTokenCriado(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" /> Token "{tokenCriado?.nome}" criado
            </DialogTitle>
            <DialogDescription>
              <strong className="text-amber-400">Copie agora — esta é a única vez que mostraremos o token.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/60 border border-border rounded-md p-3 font-mono text-xs break-all relative">
            {tokenCriado?.token}
            <button
              onClick={copiarToken}
              className="absolute top-2 right-2 p-1.5 rounded hover:bg-card transition"
              aria-label="Copiar"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {tokenCriado && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Escopos</div>
              <EscoposBadges escopos={tokenCriado.escopos} />
            </div>
          )}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Este token concede acesso conforme os escopos exibidos acima.
              Não compartilhe nem comite em repositórios. Você pode revogá-lo a qualquer momento na lista.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={copiarToken} variant="outline">
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar token"}
            </Button>
            <Button onClick={() => setTokenCriado(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edição de escopos de token existente */}
      {editandoEscopos && (
        <EditEscoposDialog
          token={editandoEscopos}
          onClose={() => setEditandoEscopos(null)}
          onSaved={(novosEscopos) => {
            setTokens(tokens.map((t) => t.id === editandoEscopos.id ? { ...t, escopos: novosEscopos } : t));
            setEditandoEscopos(null);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────── COMPONENTES DE ESCOPO ─────────────────── */

function EscoposBadges({ escopos }: { escopos: string[] }) {
  if (escopos.length === 0 || escopos.includes("*")) {
    return <Badge variant="success" className="text-[10px]"><Shield className="h-3 w-3 mr-1" />Total</Badge>;
  }
  const reads = escopos.filter((s) => s.endsWith(":read")).length;
  const writes = escopos.filter((s) => s.endsWith(":write")).length;
  const onlyRead = writes === 0;
  if (onlyRead && reads >= 8) return <Badge variant="info" className="text-[10px]">Somente leitura</Badge>;
  return (
    <div className="flex flex-wrap gap-0.5 max-w-[260px]">
      {escopos.slice(0, 4).map((e) => (
        <code key={e} className="text-[10px] font-mono bg-secondary/60 border border-border rounded px-1 py-px text-muted-foreground">
          {e}
        </code>
      ))}
      {escopos.length > 4 && <span className="text-[10px] text-muted-foreground">+{escopos.length - 4}</span>}
    </div>
  );
}

function ScopeSelector({
  scopes, onChange,
}: {
  scopes: Scope[];
  onChange: (s: Scope[]) => void;
}) {
  const isWildcard = scopes.includes("*");

  function toggleScope(scope: Scope) {
    if (isWildcard) {
      // Sai do wildcard pra modo customizado, sem o escopo clicado
      const all: Scope[] = SCOPE_GROUPS.flatMap((g) => [g.read, ...(g.write ? [g.write] : [])]).filter((s) => s !== scope) as Scope[];
      onChange(all);
      return;
    }
    if (scopes.includes(scope)) onChange(scopes.filter((s) => s !== scope));
    else onChange([...scopes, scope]);
  }

  function aplicarPreset(preset: keyof typeof PRESETS) {
    onChange([...PRESETS[preset].scopes]);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => {
            const ativo = JSON.stringify([...PRESETS[k].scopes].sort()) === JSON.stringify([...scopes].sort());
            return (
              <button
                type="button"
                key={k}
                onClick={() => aplicarPreset(k)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition",
                  ativo
                    ? "bg-sal text-white border-sal"
                    : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
                title={PRESETS[k].descricao}
              >
                {PRESETS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Escopos por módulo
          </div>
          {isWildcard && (
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Acesso total — todos liberados
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SCOPE_GROUPS.map((g) => (
            <div key={g.recurso} className="border border-border rounded-md p-2.5 bg-secondary/20">
              <div className="text-[12.5px] font-medium mb-1.5">{g.label}</div>
              <div className="flex gap-1">
                <ScopeChip
                  ativo={isWildcard || scopes.includes(g.read)}
                  onClick={() => toggleScope(g.read)}
                  label="Ler"
                  disabled={isWildcard}
                />
                {g.write && (
                  <ScopeChip
                    ativo={isWildcard || scopes.includes(g.write)}
                    onClick={() => toggleScope(g.write!)}
                    label="Escrever"
                    disabled={isWildcard}
                    variant="write"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {isWildcard ? (
          "Token concederá acesso completo a todas as 31 tools."
        ) : (
          <>Token concederá acesso a <strong className="text-foreground font-mono">{scopes.length}</strong> escopo(s).</>
        )}
      </div>
    </div>
  );
}

function ScopeChip({
  ativo, onClick, label, disabled, variant,
}: { ativo: boolean; onClick: () => void; label: string; disabled?: boolean; variant?: "read" | "write" }) {
  const cor = variant === "write" ? "#F59E0B" : "#10B981";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] font-medium border transition",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      style={ativo ? { background: cor, color: "white", borderColor: cor } : { borderColor: `${cor}40`, color: cor }}
    >
      {label}
    </button>
  );
}

function NovoTokenDialog({
  open, setOpen, onCreated,
}: { open: boolean; setOpen: (b: boolean) => void; onCreated: (p: { token: string; nome: string; escopos: string[] }) => void }) {
  const [nome, setNome] = useState("");
  const [escopos, setEscopos] = useState<Scope[]>(["*"]);
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (!nome.trim()) return;
    setCriando(true);
    const res = await fetch("/api/admin/mcp-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), escopos }),
    });
    setCriando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao criar token");
      return;
    }
    const data = await res.json();
    onCreated({ token: data.token, nome: data.nome, escopos: data.escopos });
    setNome("");
    setEscopos(["*"]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Novo token</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar novo token MCP</DialogTitle>
          <DialogDescription>
            Limite o que cada token pode fazer escolhendo escopos. Ideal para separar contextos
            (chat de consulta, automação operacional, ações financeiras).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do token*</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Claude Desktop pessoal"
              autoFocus
            />
          </div>
          <ScopeSelector scopes={escopos} onChange={setEscopos} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={criar} disabled={criando || !nome.trim() || escopos.length === 0}>
            {criando ? "Gerando..." : "Gerar token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEscoposDialog({
  token, onClose, onSaved,
}: { token: Token; onClose: () => void; onSaved: (escopos: string[]) => void }) {
  const [escopos, setEscopos] = useState<Scope[]>(token.escopos as Scope[]);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const res = await fetch(`/api/admin/mcp-tokens/${token.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escopos }),
    });
    setSalvando(false);
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Escopos atualizados");
    onSaved(escopos);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar escopos — "{token.nome}"</DialogTitle>
          <DialogDescription>
            Mudanças entram em vigor imediatamente na próxima chamada do Claude.
          </DialogDescription>
        </DialogHeader>
        <ScopeSelector scopes={escopos} onChange={setEscopos} />
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={salvar} disabled={salvando || escopos.length === 0}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────── DEMAIS COMPONENTES ─────────────────── */

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
        <div className="mt-2 font-display text-[22px] font-semibold tracking-tight">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ConnectionGuide({ baseUrl }: { baseUrl: string }) {
  const claudeDesktopConfig = `{
  "mcpServers": {
    "sal-hub": {
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      }
    }
  }
}`;

  const claudeCodeCmd = `claude mcp add sal-hub --transport http \\
  ${baseUrl}/api/mcp \\
  --header "Authorization: Bearer SEU_TOKEN_AQUI"`;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center text-sm font-bold">D</div>
            <div className="font-semibold">Claude Desktop</div>
          </div>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Abra Claude Desktop → <strong className="text-foreground">Settings → Developer → Edit Config</strong></li>
            <li>Cole o JSON abaixo dentro do arquivo (ou mescle com config existente)</li>
            <li>Substitua <code className="font-mono text-sal-400">SEU_TOKEN_AQUI</code> pelo token gerado na aba "Tokens"</li>
            <li>Reinicie o Claude Desktop</li>
            <li>Vá em <strong className="text-foreground">Settings → Connectors</strong> e confirme que "sal-hub" está conectado</li>
          </ol>
          <CodeBlock content={claudeDesktopConfig} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center text-sm font-bold">C</div>
            <div className="font-semibold">Claude Code</div>
          </div>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Abra um terminal e rode o comando abaixo</li>
            <li>Substitua o token pelo gerado na aba "Tokens"</li>
            <li>Verifique com <code className="font-mono text-sal-400">claude mcp list</code></li>
            <li>O servidor estará disponível em qualquer sessão Claude Code que você abrir</li>
          </ol>
          <CodeBlock content={claudeCodeCmd} />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center text-sm">⚙</div>
            <div className="font-semibold">Testar conexão</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Após configurar, no Claude pergunte algo como <em>"liste os clientes ativos do SAL Hub"</em>.
            Se a integração estiver correta, ele chamará <code className="font-mono text-sal-400">cliente_listar</code> e retornará os dados.
            O Claude só verá as tools permitidas pelos escopos do token.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(content);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <div className="relative">
      <pre className="bg-secondary/60 border border-border rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{content}</code>
      </pre>
      <button onClick={copiar} className="absolute top-2 right-2 p-1.5 rounded hover:bg-card transition" aria-label="Copiar">
        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function ToolsList() {
  const groups: { title: string; scope: string; tools: { name: string; desc: string; write?: boolean }[] }[] = [
    {
      title: "Clientes", scope: "clientes",
      tools: [
        { name: "cliente_listar", desc: "Lista clientes com filtros por status, nome ou tag" },
        { name: "cliente_buscar", desc: "Detalhes completos de um cliente" },
        { name: "cliente_criar", desc: "Cria novo cliente com tags", write: true },
        { name: "cliente_atualizar", desc: "Edita campos do cliente", write: true },
        { name: "cliente_excluir", desc: "Remove cliente (destrutivo)", write: true },
      ],
    },
    {
      title: "Reuniões", scope: "reunioes",
      tools: [
        { name: "reuniao_listar", desc: "Lista reuniões com filtros de data/cliente" },
        { name: "reuniao_buscar", desc: "Reunião com transcrição completa, action items e capítulos" },
        { name: "reuniao_criar", desc: "Cria nova reunião", write: true },
        { name: "reuniao_adicionar_bloco", desc: "Adiciona linha de transcrição (speaker + timestamp + texto)", write: true },
        { name: "reuniao_adicionar_action", desc: "Cria action item vinculado", write: true },
        { name: "reuniao_atualizar", desc: "Atualiza resumo IA, notas, status", write: true },
        { name: "reuniao_action_toggle", desc: "Marca/desmarca action item como concluído", write: true },
      ],
    },
    {
      title: "Notas", scope: "notas",
      tools: [
        { name: "nota_listar", desc: "Lista notas com busca textual e filtros" },
        { name: "nota_buscar", desc: "Conteúdo markdown completo" },
        { name: "nota_criar", desc: "Cria nota em markdown", write: true },
        { name: "nota_atualizar", desc: "Edita nota existente", write: true },
        { name: "nota_anexar", desc: "Adiciona conteúdo ao final sem sobrescrever", write: true },
        { name: "nota_excluir", desc: "Remove nota", write: true },
      ],
    },
    {
      title: "Tarefas", scope: "tarefas",
      tools: [
        { name: "tarefa_listar", desc: "Lista tarefas com filtros (atrasadas, por cliente)" },
        { name: "tarefa_criar", desc: "Cria tarefa com prioridade e prazo", write: true },
        { name: "tarefa_atualizar", desc: "Atualiza status, prazo, prioridade", write: true },
        { name: "tarefa_excluir", desc: "Remove tarefa", write: true },
      ],
    },
    {
      title: "Editorial", scope: "editorial",
      tools: [
        { name: "post_listar", desc: "Lista posts do calendário editorial" },
        { name: "post_criar", desc: "Cria post (status AGENDADO sincroniza com Google Calendar)", write: true },
        { name: "post_atualizar", desc: "Atualiza post", write: true },
      ],
    },
    {
      title: "Projetos", scope: "projetos",
      tools: [
        { name: "projeto_listar", desc: "Lista projetos do Kanban" },
        { name: "projeto_criar", desc: "Cria projeto", write: true },
        { name: "projeto_mover", desc: "Move projeto entre colunas (Briefing → Entregue)", write: true },
      ],
    },
    {
      title: "Contratos", scope: "contratos",
      tools: [
        { name: "contrato_listar", desc: "Lista com filtro de vencimento próximo" },
        { name: "contrato_criar", desc: "Cria contrato (gera evento de aviso 30d antes)", write: true },
      ],
    },
    {
      title: "Financeiro", scope: "financeiro",
      tools: [
        { name: "lancamento_listar", desc: "Lista receitas/despesas PJ ou PF" },
        { name: "lancamento_criar", desc: "Cria lançamento", write: true },
        { name: "metricas_financeiras", desc: "MRR, receita/despesa do mês, lucro, projeção 3m" },
      ],
    },
    {
      title: "Outros", scope: "agenda",
      tools: [
        { name: "agenda_proximos_eventos", desc: "Próximos eventos agendados" },
        { name: "buscar_tudo", desc: "Busca uma string em todos os módulos (clientes, notas, transcrições, tarefas, posts)" },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <Card key={g.title}>
          <CardContent className="p-5">
            <div className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
              {g.title}
              <code className="text-[10px] font-mono bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                {g.scope}:read · {g.scope}:write
              </code>
            </div>
            <ul className="space-y-1.5 text-sm">
              {g.tools.map((t) => (
                <li key={t.name} className="flex gap-3 items-start">
                  <code className={cn("font-mono text-xs shrink-0 w-44", t.write ? "text-amber-400" : "text-emerald-400")}>{t.name}</code>
                  <span className="text-muted-foreground flex-1">{t.desc}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.write ? "write" : "read"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Examples() {
  const exs = [
    {
      titulo: "Resumir uma reunião e criar action items",
      prompt: '"Liste as reuniões do Pipeline Services dessa semana, pegue a transcrição da última, gere um resumo executivo de até 5 bullets e crie os action items extraídos. Salve o resumo no campo resumoIA da reunião."',
      tools: ["reuniao_listar", "reuniao_buscar", "reuniao_atualizar", "reuniao_adicionar_action"],
      escopos: ["reunioes:read", "reunioes:write"],
    },
    {
      titulo: "Relatório financeiro mensal por cliente",
      prompt: '"Para cada cliente ativo, calcule o LTV até hoje (soma das receitas com clienteId), liste os contratos vencendo nos próximos 60 dias e crie uma nota com o resumo na pasta Relatórios."',
      tools: ["cliente_listar", "lancamento_listar", "contrato_listar", "nota_criar"],
      escopos: ["clientes:read", "financeiro:read", "contratos:read", "notas:write"],
    },
    {
      titulo: "Pauta editorial automática",
      prompt: '"Liste os posts dos próximos 7 dias da Galeria Chaves. Para cada formato faltante (Reels, Carrossel, Stories), gere 3 sugestões de pauta alinhadas ao calendário comemorativo e crie posts em RASCUNHO."',
      tools: ["post_listar", "post_criar"],
      escopos: ["editorial:read", "editorial:write"],
    },
    {
      titulo: "Triagem diária de tarefas atrasadas",
      prompt: '"Liste minhas tarefas atrasadas. Reorganize por prioridade. Para cada urgente, crie uma nota em /Inbox com plano de execução e adicione o link na descrição da tarefa."',
      tools: ["tarefa_listar", "nota_criar", "tarefa_atualizar"],
      escopos: ["tarefas:read", "tarefas:write", "notas:write"],
    },
    {
      titulo: "Briefing pré-reunião (token só leitura)",
      prompt: '"Vou ter reunião com a Pipeline. Busque tudo que tenha menção a Pipeline nos últimos 3 meses (notas, reuniões, tarefas), me dê um briefing executivo de 1 página."',
      tools: ["buscar_tudo", "reuniao_buscar"],
      escopos: ["busca:read", "reunioes:read"],
    },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {exs.map((ex) => (
        <Card key={ex.titulo}>
          <CardContent className="p-5 space-y-3">
            <div className="font-display font-semibold text-sm">{ex.titulo}</div>
            <p className="text-sm text-muted-foreground italic leading-relaxed">{ex.prompt}</p>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">Tools usadas</div>
              <div className="flex flex-wrap gap-1">
                {ex.tools.map((t) => (
                  <code key={t} className="font-mono text-[10.5px] bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-sal-400">
                    {t}
                  </code>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">Escopos mínimos</div>
              <div className="flex flex-wrap gap-1">
                {ex.escopos.map((e) => (
                  <code key={e} className="font-mono text-[10.5px] bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 text-emerald-400">
                    {e}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
