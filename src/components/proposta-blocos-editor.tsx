"use client";
/**
 * Editor dos 5 blocos extras de personalização avançada da proposta:
 *  - 📦 Pacotes
 *  - 🏆 Cases de clientes
 *  - 📊 KPIs
 *  - 👥 Equipe
 *  - ❓ FAQ
 *
 * Cada bloco é colapsável e tem toggle "Mostrar na proposta" — Marcelo
 * liga só os que fazem sentido pro cliente em questão.
 *
 * Salva o objeto `extras` inteiro a cada mudança (PATCH na Proposta).
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Trophy,
  BarChart3,
  Users,
  HelpCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PropostaExtras,
  type Pacote,
  type Case,
  type Kpi,
  type MembroEquipe,
  type Faq,
  defaultPacotes,
  defaultCases,
  defaultKpis,
  defaultEquipe,
  defaultFaq,
  gerarBlocoItemId,
  normalizarExtras,
} from "@/lib/proposta-blocos";

type Props = {
  extras: unknown;
  onSave: (extras: PropostaExtras) => void;
};

type SecaoAberta = "pacotes" | "cases" | "kpis" | "equipe" | "faq" | null;

export function PropostaBlocosEditor({ extras: extrasRaw, onSave }: Props) {
  const extras = normalizarExtras(extrasRaw);
  const [aberta, setAberta] = useState<SecaoAberta>(null);

  function atualizar(patch: Partial<PropostaExtras>) {
    onSave({ ...extras, ...patch });
  }

  function toggleSecao(s: Exclude<SecaoAberta, null>) {
    setAberta((cur) => (cur === s ? null : s));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Ative os blocos que fazem sentido pra essa proposta. Cada um aparece em uma posição
          estratégica na pré-visualização e no PDF — pacotes após investimento, cases após
          diagnóstico, KPIs após objetivo, equipe e FAQ no final.
        </p>
      </div>

      {/* PACOTES */}
      <BlocoCard
        icon={Package}
        nome="Pacotes comparativos"
        descricao="3 colunas lado-a-lado (Starter / Profissional / Premium) com features. Cliente compara e escolhe."
        aberto={aberta === "pacotes"}
        onToggle={() => toggleSecao("pacotes")}
        visivel={extras.pacotes?.visivel ?? false}
        onVisivelChange={(v) => {
          const bloco = extras.pacotes ?? defaultPacotes();
          atualizar({ pacotes: { ...bloco, visivel: v } });
        }}
      >
        <PacotesEditor
          bloco={extras.pacotes ?? defaultPacotes()}
          onChange={(b) => atualizar({ pacotes: b })}
        />
      </BlocoCard>

      {/* CASES */}
      <BlocoCard
        icon={Trophy}
        nome="Cases de clientes"
        descricao="Grid com resultados de clientes anteriores. Foco em métrica + descrição curta. Aparece após o Diagnóstico."
        aberto={aberta === "cases"}
        onToggle={() => toggleSecao("cases")}
        visivel={extras.cases?.visivel ?? false}
        onVisivelChange={(v) => {
          const bloco = extras.cases ?? defaultCases();
          atualizar({ cases: { ...bloco, visivel: v } });
        }}
      >
        <CasesEditor
          bloco={extras.cases ?? defaultCases()}
          onChange={(b) => atualizar({ cases: b })}
        />
      </BlocoCard>

      {/* KPIs */}
      <BlocoCard
        icon={BarChart3}
        nome="KPIs / Metas"
        descricao="Cards com metas SMART em destaque. Compromisso público — você cobra. Aparece após o Objetivo."
        aberto={aberta === "kpis"}
        onToggle={() => toggleSecao("kpis")}
        visivel={extras.kpis?.visivel ?? false}
        onVisivelChange={(v) => {
          const bloco = extras.kpis ?? defaultKpis();
          atualizar({ kpis: { ...bloco, visivel: v } });
        }}
      >
        <KpisEditor
          bloco={extras.kpis ?? defaultKpis()}
          onChange={(b) => atualizar({ kpis: b })}
        />
      </BlocoCard>

      {/* EQUIPE */}
      <BlocoCard
        icon={Users}
        nome="Equipe dedicada"
        descricao="Headshots + bios de quem vai cuidar do cliente. Humaniza e gera confiança. Aparece antes do CTA."
        aberto={aberta === "equipe"}
        onToggle={() => toggleSecao("equipe")}
        visivel={extras.equipe?.visivel ?? false}
        onVisivelChange={(v) => {
          const bloco = extras.equipe ?? defaultEquipe();
          atualizar({ equipe: { ...bloco, visivel: v } });
        }}
      >
        <EquipeEditor
          bloco={extras.equipe ?? defaultEquipe()}
          onChange={(b) => atualizar({ equipe: b })}
        />
      </BlocoCard>

      {/* FAQ */}
      <BlocoCard
        icon={HelpCircle}
        nome="FAQ — Perguntas frequentes"
        descricao="Mata objeções comuns antes do CTA. Cliente vai com menos dúvida — aceita mais. Aparece antes do CTA."
        aberto={aberta === "faq"}
        onToggle={() => toggleSecao("faq")}
        visivel={extras.faq?.visivel ?? false}
        onVisivelChange={(v) => {
          const bloco = extras.faq ?? defaultFaq();
          atualizar({ faq: { ...bloco, visivel: v } });
        }}
      >
        <FaqEditor
          bloco={extras.faq ?? defaultFaq()}
          onChange={(b) => atualizar({ faq: b })}
        />
      </BlocoCard>
    </div>
  );
}

// ─── BlocoCard wrapper ────────────────────────────────────────────────

function BlocoCard({
  icon: Icon,
  nome,
  descricao,
  aberto,
  onToggle,
  visivel,
  onVisivelChange,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  nome: string;
  descricao: string;
  aberto: boolean;
  onToggle: () => void;
  visivel: boolean;
  onVisivelChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(visivel && "border-primary/40")}>
      <CardContent className="p-0">
        <div className="p-4 flex items-start gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-md flex items-center justify-center shrink-0 transition-colors",
              visivel
                ? "bg-primary/15 text-primary"
                : "bg-muted/40 text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <button onClick={onToggle} className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{nome}</span>
              {visivel && (
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
              {descricao}
            </p>
          </button>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              role="switch"
              aria-checked={visivel}
              onClick={() => onVisivelChange(!visivel)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                visivel ? "bg-primary" : "bg-muted/60"
              )}
              title={visivel ? "Desativar bloco" : "Ativar bloco"}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                  visivel ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
            <button
              onClick={onToggle}
              className="h-7 w-7 rounded hover:bg-muted/60 flex items-center justify-center text-muted-foreground"
              aria-label={aberto ? "Recolher" : "Expandir"}
            >
              {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {aberto && (
          <div className="border-t border-border bg-background/30 px-4 py-3.5">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PACOTES editor ───────────────────────────────────────────────────

function PacotesEditor({
  bloco,
  onChange,
}: {
  bloco: ReturnType<typeof defaultPacotes>;
  onChange: (b: ReturnType<typeof defaultPacotes>) => void;
}) {
  function setCampo<K extends keyof typeof bloco>(k: K, v: (typeof bloco)[K]) {
    onChange({ ...bloco, [k]: v });
  }

  function setPacote(idx: number, patch: Partial<Pacote>) {
    const novos = bloco.pacotes.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ ...bloco, pacotes: novos });
  }

  function addPacote() {
    onChange({
      ...bloco,
      pacotes: [
        ...bloco.pacotes,
        {
          id: gerarBlocoItemId("pacote"),
          nome: "Novo pacote",
          valor: "R$ —",
          features: [{ texto: "Feature 1", incluso: true }],
        },
      ],
    });
  }

  function removePacote(idx: number) {
    onChange({ ...bloco, pacotes: bloco.pacotes.filter((_, i) => i !== idx) });
  }

  function setFeature(pIdx: number, fIdx: number, patch: Partial<typeof bloco.pacotes[0]["features"][0]>) {
    const novos = bloco.pacotes.map((p, i) =>
      i === pIdx
        ? { ...p, features: p.features.map((f, j) => (j === fIdx ? { ...f, ...patch } : f)) }
        : p
    );
    onChange({ ...bloco, pacotes: novos });
  }

  function addFeature(pIdx: number) {
    const novos = bloco.pacotes.map((p, i) =>
      i === pIdx ? { ...p, features: [...p.features, { texto: "Nova feature", incluso: true }] } : p
    );
    onChange({ ...bloco, pacotes: novos });
  }

  function removeFeature(pIdx: number, fIdx: number) {
    const novos = bloco.pacotes.map((p, i) =>
      i === pIdx ? { ...p, features: p.features.filter((_, j) => j !== fIdx) } : p
    );
    onChange({ ...bloco, pacotes: novos });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoLabel label="Título do bloco">
          <Input
            value={bloco.titulo}
            onChange={(e) => setCampo("titulo", e.target.value)}
            className="h-8 text-xs"
          />
        </CampoLabel>
        <CampoLabel label="Subtítulo (opcional)">
          <Input
            value={bloco.subtitulo ?? ""}
            onChange={(e) => setCampo("subtitulo", e.target.value)}
            className="h-8 text-xs"
          />
        </CampoLabel>
      </div>

      <div className="space-y-2">
        {bloco.pacotes.map((pacote, idx) => (
          <Card key={pacote.id} className="bg-card/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={pacote.nome}
                  onChange={(e) => setPacote(idx, { nome: e.target.value })}
                  placeholder="Nome do pacote"
                  className="h-8 text-xs flex-1 font-medium"
                />
                <Button
                  variant={pacote.destaque ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setPacote(idx, { destaque: !pacote.destaque })}
                  title={pacote.destaque ? "Remover destaque" : "Marcar como recomendado"}
                >
                  <Star className={cn("h-3.5 w-3.5", pacote.destaque && "fill-current")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removePacote(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={pacote.valor}
                  onChange={(e) => setPacote(idx, { valor: e.target.value })}
                  placeholder="R$ 2.500/mês"
                  className="h-8 text-xs"
                />
                <Input
                  value={pacote.subtitulo ?? ""}
                  onChange={(e) => setPacote(idx, { subtitulo: e.target.value })}
                  placeholder="Pra começar"
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={pacote.cta ?? ""}
                onChange={(e) => setPacote(idx, { cta: e.target.value })}
                placeholder="Texto do botão (ex: Quero esse)"
                className="h-8 text-xs"
              />
              <div className="space-y-1 pt-1 border-t border-border/40">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Features
                </Label>
                {pacote.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-1.5">
                    <button
                      onClick={() => setFeature(idx, fIdx, { incluso: !feat.incluso })}
                      className={cn(
                        "h-5 w-5 rounded shrink-0 flex items-center justify-center text-[12px] font-bold",
                        feat.incluso
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-muted/40 text-muted-foreground"
                      )}
                      title={feat.incluso ? "Incluso (✓)" : "Não incluso (—)"}
                    >
                      {feat.incluso ? "✓" : "—"}
                    </button>
                    <Input
                      value={feat.texto}
                      onChange={(e) => setFeature(idx, fIdx, { texto: e.target.value })}
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      onClick={() => setFeature(idx, fIdx, { destaque: !feat.destaque })}
                      className={cn(
                        "h-7 w-7 rounded shrink-0 flex items-center justify-center transition",
                        feat.destaque
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Destacar feature"
                    >
                      <Star className={cn("h-3 w-3", feat.destaque && "fill-current")} />
                    </button>
                    <button
                      onClick={() => removeFeature(idx, fIdx)}
                      className="h-7 w-7 rounded shrink-0 flex items-center justify-center text-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addFeature(idx)}
                  className="w-full mt-1 h-7 text-[11px]"
                >
                  <Plus className="h-3 w-3" /> Feature
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addPacote} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar pacote
        </Button>
      </div>
    </div>
  );
}

// ─── CASES editor ─────────────────────────────────────────────────────

function CasesEditor({
  bloco,
  onChange,
}: {
  bloco: ReturnType<typeof defaultCases>;
  onChange: (b: ReturnType<typeof defaultCases>) => void;
}) {
  function setCase(idx: number, patch: Partial<Case>) {
    onChange({ ...bloco, cases: bloco.cases.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });
  }
  function addCase() {
    onChange({
      ...bloco,
      cases: [
        ...bloco.cases,
        { id: gerarBlocoItemId("case"), cliente: "", resultado: "", metricaPrincipal: "" },
      ],
    });
  }
  function removeCase(idx: number) {
    onChange({ ...bloco, cases: bloco.cases.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoLabel label="Título">
          <Input
            value={bloco.titulo}
            onChange={(e) => onChange({ ...bloco, titulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
        <CampoLabel label="Subtítulo">
          <Input
            value={bloco.subtitulo ?? ""}
            onChange={(e) => onChange({ ...bloco, subtitulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
      </div>

      <div className="space-y-2">
        {bloco.cases.map((c, idx) => (
          <Card key={c.id} className="bg-card/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={c.cliente}
                  onChange={(e) => setCase(idx, { cliente: e.target.value })}
                  placeholder="Nome do cliente"
                  className="h-8 text-xs flex-1 font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removeCase(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={c.segmento ?? ""}
                  onChange={(e) => setCase(idx, { segmento: e.target.value })}
                  placeholder="Segmento (Decoração, E-commerce...)"
                  className="h-8 text-xs"
                />
                <Input
                  value={c.metricaPrincipal ?? ""}
                  onChange={(e) => setCase(idx, { metricaPrincipal: e.target.value })}
                  placeholder="Métrica destaque (+340%)"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <Input
                value={c.resultado}
                onChange={(e) => setCase(idx, { resultado: e.target.value })}
                placeholder="Frase do resultado (ex: triplicou vendas em 6 meses)"
                className="h-8 text-xs"
              />
              <Textarea
                value={c.descricao ?? ""}
                onChange={(e) => setCase(idx, { descricao: e.target.value })}
                placeholder="Descrição opcional (contexto, como foi feito)"
                rows={2}
                className="text-xs resize-none"
              />
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addCase} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar case
        </Button>
      </div>
    </div>
  );
}

// ─── KPIs editor ──────────────────────────────────────────────────────

function KpisEditor({
  bloco,
  onChange,
}: {
  bloco: ReturnType<typeof defaultKpis>;
  onChange: (b: ReturnType<typeof defaultKpis>) => void;
}) {
  function setKpi(idx: number, patch: Partial<Kpi>) {
    onChange({ ...bloco, kpis: bloco.kpis.map((k, i) => (i === idx ? { ...k, ...patch } : k)) });
  }
  function addKpi() {
    onChange({
      ...bloco,
      kpis: [...bloco.kpis, { id: gerarBlocoItemId("kpi"), label: "", valorMeta: "" }],
    });
  }
  function removeKpi(idx: number) {
    onChange({ ...bloco, kpis: bloco.kpis.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoLabel label="Título">
          <Input
            value={bloco.titulo}
            onChange={(e) => onChange({ ...bloco, titulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
        <CampoLabel label="Subtítulo">
          <Input
            value={bloco.subtitulo ?? ""}
            onChange={(e) => onChange({ ...bloco, subtitulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
      </div>

      <div className="space-y-2">
        {bloco.kpis.map((k, idx) => (
          <Card key={k.id} className="bg-card/60">
            <CardContent className="p-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
              <Input
                value={k.label}
                onChange={(e) => setKpi(idx, { label: e.target.value })}
                placeholder="Métrica (ex: Conversões/mês)"
                className="h-8 text-xs"
              />
              <Input
                value={k.valorAtual ?? ""}
                onChange={(e) => setKpi(idx, { valorAtual: e.target.value })}
                placeholder="Atual"
                className="h-8 text-xs w-20 font-mono"
              />
              <Input
                value={k.valorMeta}
                onChange={(e) => setKpi(idx, { valorMeta: e.target.value })}
                placeholder="Meta"
                className="h-8 text-xs w-20 font-mono"
              />
              <Input
                value={k.variacao ?? ""}
                onChange={(e) => setKpi(idx, { variacao: e.target.value })}
                placeholder="+233%"
                className="h-8 text-xs w-20 font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removeKpi(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addKpi} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar KPI
        </Button>
      </div>
    </div>
  );
}

// ─── EQUIPE editor ────────────────────────────────────────────────────

function EquipeEditor({
  bloco,
  onChange,
}: {
  bloco: ReturnType<typeof defaultEquipe>;
  onChange: (b: ReturnType<typeof defaultEquipe>) => void;
}) {
  function setMembro(idx: number, patch: Partial<MembroEquipe>) {
    onChange({
      ...bloco,
      membros: bloco.membros.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    });
  }
  function addMembro() {
    onChange({
      ...bloco,
      membros: [...bloco.membros, { id: gerarBlocoItemId("membro"), nome: "", cargo: "" }],
    });
  }
  function removeMembro(idx: number) {
    onChange({ ...bloco, membros: bloco.membros.filter((_, i) => i !== idx) });
  }
  function uploadFoto(idx: number, file: File) {
    if (file.size > 1_500_000) {
      alert("Foto muito grande (max 1.5MB). Comprime antes de subir.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMembro(idx, { fotoUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoLabel label="Título">
          <Input
            value={bloco.titulo}
            onChange={(e) => onChange({ ...bloco, titulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
        <CampoLabel label="Subtítulo">
          <Input
            value={bloco.subtitulo ?? ""}
            onChange={(e) => onChange({ ...bloco, subtitulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
      </div>

      <div className="space-y-2">
        {bloco.membros.map((m, idx) => (
          <Card key={m.id} className="bg-card/60">
            <CardContent className="p-3 flex gap-3">
              <label className="shrink-0 cursor-pointer">
                <div
                  className="h-14 w-14 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted/40 text-muted-foreground"
                  title="Click pra subir foto"
                >
                  {m.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.fotoUrl} alt={m.nome} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFoto(idx, f);
                  }}
                />
              </label>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={m.nome}
                    onChange={(e) => setMembro(idx, { nome: e.target.value })}
                    placeholder="Nome"
                    className="h-8 text-xs font-medium"
                  />
                  <Input
                    value={m.cargo}
                    onChange={(e) => setMembro(idx, { cargo: e.target.value })}
                    placeholder="Cargo"
                    className="h-8 text-xs"
                  />
                </div>
                <Textarea
                  value={m.bio ?? ""}
                  onChange={(e) => setMembro(idx, { bio: e.target.value })}
                  placeholder="Bio curta (2-3 linhas)"
                  rows={2}
                  className="text-xs resize-none"
                />
                <Input
                  value={m.linkedinUrl ?? ""}
                  onChange={(e) => setMembro(idx, { linkedinUrl: e.target.value })}
                  placeholder="LinkedIn URL (opcional)"
                  className="h-7 text-[11px]"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive"
                onClick={() => removeMembro(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addMembro} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar membro
        </Button>
      </div>
    </div>
  );
}

// ─── FAQ editor ───────────────────────────────────────────────────────

function FaqEditor({
  bloco,
  onChange,
}: {
  bloco: ReturnType<typeof defaultFaq>;
  onChange: (b: ReturnType<typeof defaultFaq>) => void;
}) {
  function setFaq(idx: number, patch: Partial<Faq>) {
    onChange({
      ...bloco,
      perguntas: bloco.perguntas.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    });
  }
  function addFaq() {
    onChange({
      ...bloco,
      perguntas: [...bloco.perguntas, { id: gerarBlocoItemId("faq"), pergunta: "", resposta: "" }],
    });
  }
  function removeFaq(idx: number) {
    onChange({ ...bloco, perguntas: bloco.perguntas.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoLabel label="Título">
          <Input
            value={bloco.titulo}
            onChange={(e) => onChange({ ...bloco, titulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
        <CampoLabel label="Subtítulo">
          <Input
            value={bloco.subtitulo ?? ""}
            onChange={(e) => onChange({ ...bloco, subtitulo: e.target.value })}
            className="h-8 text-xs"
          />
        </CampoLabel>
      </div>

      <div className="space-y-2">
        {bloco.perguntas.map((f, idx) => (
          <Card key={f.id} className="bg-card/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={f.pergunta}
                  onChange={(e) => setFaq(idx, { pergunta: e.target.value })}
                  placeholder="Pergunta"
                  className="h-8 text-xs flex-1 font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removeFaq(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={f.resposta}
                onChange={(e) => setFaq(idx, { resposta: e.target.value })}
                placeholder="Resposta"
                rows={2}
                className="text-xs resize-none"
              />
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addFaq} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function CampoLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </Label>
      {children}
    </div>
  );
}
