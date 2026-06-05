import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClienteFormButton } from "@/components/cliente-form";
import { ClienteMarcaCard } from "@/components/cliente-marca-card";
import { ClienteDriveButton } from "@/components/cliente-drive-button";
import { ClienteDeleteButton } from "@/components/cliente-delete-button";
import { TagsBadges } from "@/components/tag-picker";
import { formatBRL, formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BlockRenderer } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { MoneyValue } from "@/components/money-value";

import { buildClienteInsights } from "@/lib/cliente-insights";
import { buildClienteMarketing } from "@/lib/cliente-marketing";
import { buildClienteDocumentos } from "@/lib/cliente-documentos";
import { HealthScore } from "@/components/cliente-detalhe/health-score";
import { ClienteKpis } from "@/components/cliente-detalhe/cliente-kpis";
import { MrrSparkline } from "@/components/cliente-detalhe/mrr-sparkline";
import { AtividadeChart } from "@/components/cliente-detalhe/atividade-chart";
import { ClienteTimeline } from "@/components/cliente-detalhe/cliente-timeline";
import { MarketingPerformance } from "@/components/cliente-detalhe/marketing-performance";
import { DocumentosCliente } from "@/components/cliente-detalhe/documentos-cliente";
import { BriefingIaCard, type Briefing } from "@/components/cliente-detalhe/briefing-ia-card";
import { normalizarPerguntas, BRIEFING_STATUS_META, type BriefingStatusUi } from "@/lib/briefing";

export const dynamic = "force-dynamic";

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  // Busca em paralelo: cliente full + insights + marketing + documentos
  const [cliente, insights, marketing, documentos] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: params.id },
      include: {
        tags: true,
        posts: { orderBy: { dataPublicacao: "desc" }, take: 50 },
        projetos: { orderBy: { createdAt: "desc" } },
        tarefas: { orderBy: { dataEntrega: "asc" } },
        contratos: { orderBy: { dataInicio: "desc" } },
        lancamentos: { orderBy: { data: "desc" }, take: 50 },
        reunioes: { orderBy: { data: "desc" }, take: 50 },
        propostas: { where: { versaoAtual: true }, orderBy: { updatedAt: "desc" } },
        diagnosticos: { orderBy: { updatedAt: "desc" } },
        briefings: { orderBy: { updatedAt: "desc" } },
      },
    }),
    buildClienteInsights(params.id),
    buildClienteMarketing(params.id),
    buildClienteDocumentos(params.id),
  ]);

  if (!cliente || !insights) notFound();

  return (
    <PageShell
      title={cliente.nome}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span>{cliente.status.toLowerCase()}</span>
          <span className="text-muted-foreground/60">·</span>
          <MoneyValue value={Number(cliente.valorContratoMensal)} className="font-mono" /> /mês
        </span>
      }
      parent={{ label: "Clientes", href: "/clientes" }}
      actions={
        <div className="flex gap-2">
          <ClienteDriveButton clienteId={cliente.id} folderUrl={cliente.googleDriveFolderUrl} />
          <ClienteFormButton id={cliente.id} initial={{
            nome: cliente.nome,
            cnpj: cliente.cnpj,
            email: cliente.email,
            telefone: cliente.telefone,
            endereco: cliente.endereco,
            status: cliente.status,
            valorContratoMensal: Number(cliente.valorContratoMensal),
            notas: cliente.notas,
            tagIds: cliente.tags.map((t) => t.id),
          }} />
          <ClienteDeleteButton id={cliente.id} nome={cliente.nome} />
        </div>
      }
    >
      {cliente.tags.length > 0 && (
        <div className="-mt-2"><TagsBadges tags={cliente.tags} /></div>
      )}

      {/* ─── BRIEFING IA (Claude Max copy-paste) ─────────────────── */}
      <BriefingIaCard
        clienteId={cliente.id}
        clienteNome={cliente.nome}
        briefing={(cliente.briefingIA as Briefing | null) ?? null}
        briefingEm={cliente.briefingIAEm?.toISOString() ?? null}
      />

      {/* ─── BLOCO DE INTELIGÊNCIA ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_280px] gap-3">
        <HealthScore
          score={insights.healthScore}
          label={insights.healthLabel}
          breakdown={insights.healthBreakdown}
        />
        <ClienteKpis
          tempoComoClienteMeses={insights.tempoComoClienteMeses}
          primeiraInteracao={insights.primeiraInteracao}
          ltvTotal={insights.ltvTotal}
          ticketMedioMensal={insights.ticketMedioMensal}
          reunioesTotal={insights.reunioesTotal}
          reunioesUltimos30d={insights.reunioesUltimos30d}
          postsTotal={insights.postsTotal}
          postsPublicadosUltimos30d={insights.postsPublicadosUltimos30d}
        />
        <MrrSparkline data={insights.mrr12m} />
      </div>

      <AtividadeChart data={insights.atividadeSemanas} />

      {/* Documentos & Drive (esquerda) | Backlinks (direita) */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <DocumentosCliente
          clienteId={cliente.id}
          clienteNome={cliente.nome}
          driveFolderUrl={cliente.googleDriveFolderUrl}
          briefings={documentos.briefings}
          outrasNotas={documentos.outrasNotas}
        />
        <BacklinksPanel type="CLIENTE" id={cliente.id} title="Outras referências" hideWhenEmpty />
      </div>

      {/* Marketing performance (full width, 3 tabs internas) */}
      <MarketingPerformance
        trafegoPago={marketing.trafegoPago}
        redes={marketing.redes}
        seo={marketing.seo}
        clienteId={cliente.id}
      />

      <ClienteTimeline eventos={insights.timeline} />

      {/* ─── TABS (deep dive existentes) ────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões ({cliente.reunioes.length})</TabsTrigger>
          <TabsTrigger value="propostas">Propostas ({cliente.propostas.length})</TabsTrigger>
          <TabsTrigger value="diagnosticos">Diagnósticos ({cliente.diagnosticos.length})</TabsTrigger>
          <TabsTrigger value="briefings">Briefings ({cliente.briefings.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({cliente.posts.length})</TabsTrigger>
          <TabsTrigger value="projetos">Projetos ({cliente.projetos.length})</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({cliente.tarefas.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({cliente.contratos.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-3">
            <div className="grid lg:grid-cols-[1fr_360px] gap-3 items-start">
              <Card><CardContent className="p-6 grid md:grid-cols-2 gap-6 text-sm">
                <Info label="CNPJ" value={cliente.cnpj} />
                <Info label="Email" value={cliente.email} />
                <Info label="Telefone" value={cliente.telefone} />
                <Info label="Endereço" value={cliente.endereco} />
                <Info label="Pasta Drive" value={cliente.googleDriveFolderUrl ? "Vinculada" : "Não vinculada"} />
              </CardContent></Card>
              <ClienteMarcaCard
                clienteId={cliente.id}
                clienteNome={cliente.nome}
                logoUrl={cliente.logoUrl}
                corPrimaria={cliente.corPrimaria}
              />
            </div>
            {cliente.notas && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Notas</div>
                  <BlockRenderer value={cliente.notas} className="text-sm" />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reunioes">
          <SimpleTable
            cols={["Título", "Data", "Status"]}
            rows={cliente.reunioes.map((r) => [
              r.titulo, formatDate(r.data), <Badge key={r.id} variant="outline">{r.status}</Badge>,
            ])}
            hrefs={cliente.reunioes.map((r) => `/reunioes/${r.id}`)}
          />
        </TabsContent>

        <TabsContent value="propostas">
          <SimpleTable
            cols={["Número", "Título", "Status", "Valor/mês"]}
            rows={cliente.propostas.map((p) => [
              p.numero, p.titulo, <Badge key={p.id} variant="outline">{p.status}</Badge>,
              p.valorMensal ? formatBRL(Number(p.valorMensal)) : "—",
            ])}
            hrefs={cliente.propostas.map((p) => `/propostas/${p.id}`)}
          />
        </TabsContent>

        <TabsContent value="diagnosticos">
          <SimpleTable
            cols={["Número", "Título", "Status"]}
            rows={cliente.diagnosticos.map((d) => [
              d.numero, d.titulo, <Badge key={d.id} variant="outline">{d.status}</Badge>,
            ])}
            hrefs={cliente.diagnosticos.map((d) => `/diagnosticos/${d.id}`)}
          />
        </TabsContent>

        <TabsContent value="briefings">
          <SimpleTable
            cols={["Título", "Perguntas", "Status", "Respondido"]}
            rows={cliente.briefings.map((b) => [
              b.titulo,
              `${normalizarPerguntas(b.perguntas).length}`,
              <Badge key={b.id} variant="outline">
                {BRIEFING_STATUS_META[b.status as BriefingStatusUi].label}
              </Badge>,
              b.respondidoEm ? formatDate(b.respondidoEm) : "—",
            ])}
            hrefs={cliente.briefings.map((b) => `/briefings/${b.id}`)}
          />
        </TabsContent>

        <TabsContent value="posts">
          <SimpleTable
            cols={["Título", "Formato", "Status", "Publicação"]}
            rows={cliente.posts.map((p) => [
              p.titulo, p.formato, <Badge key={p.id} variant="outline">{p.status}</Badge>, formatDate(p.dataPublicacao),
            ])}
            hrefs={cliente.posts.map((p) => `/editorial?post=${p.id}`)}
          />
        </TabsContent>

        <TabsContent value="projetos">
          <SimpleTable
            cols={["Nome", "Status", "Prioridade", "Entrega"]}
            rows={cliente.projetos.map((p) => [p.nome, p.status, p.prioridade, formatDate(p.dataEntrega)])}
            hrefs={cliente.projetos.map((p) => `/projetos?projeto=${p.id}`)}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <SimpleTable
            cols={["Título", "Prioridade", "Concluída", "Entrega"]}
            rows={cliente.tarefas.map((t) => [t.titulo, t.prioridade, t.concluida ? "✔" : "—", formatDate(t.dataEntrega)])}
            hrefs={cliente.tarefas.map((t) => `/tarefas?tarefa=${t.id}`)}
          />
        </TabsContent>

        <TabsContent value="contratos">
          <SimpleTable
            cols={["Início", "Fim", "Valor", "Status"]}
            rows={cliente.contratos.map((c) => [
              formatDate(c.dataInicio), formatDate(c.dataFim), formatBRL(c.valor as unknown as number), c.status,
            ])}
          />
        </TabsContent>

        <TabsContent value="financeiro">
          <SimpleTable
            cols={["Data", "Descrição", "Tipo", "Valor"]}
            rows={cliente.lancamentos.map((l) => [
              formatDate(l.data), l.descricao, l.tipo,
              <span key={l.id} className={l.tipo === "RECEITA" ? "text-emerald-500" : "text-rose-500"}>
                <MoneyValue value={Number(l.valor)} className="font-mono" />
              </span>,
            ])}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1">{value ?? "—"}</div>
    </div>
  );
}

function SimpleTable({
  cols,
  rows,
  hrefs,
}: {
  cols: string[];
  rows: React.ReactNode[][];
  hrefs?: (string | null)[];
}) {
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">Sem registros.</TableCell></TableRow>
          )}
          {rows.map((row, i) => {
            const href = hrefs?.[i] ?? null;
            return (
              <TableRow key={i} className={href ? "hover:bg-secondary/40 transition-colors" : undefined}>
                {row.map((cell, j) => (
                  <TableCell key={j}>
                    {href && j === 0 ? (
                      <Link href={href} className="font-medium hover:text-sal-400 hover:underline">
                        {cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
