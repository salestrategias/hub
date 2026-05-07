import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClienteFormButton } from "@/components/cliente-form";
import { ClienteDriveButton } from "@/components/cliente-drive-button";
import { ClienteDeleteButton } from "@/components/cliente-delete-button";
import { TagsBadges } from "@/components/tag-picker";
import { formatBRL, formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BlockRenderer } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { MoneyValue } from "@/components/money-value";

import { buildClienteInsights } from "@/lib/cliente-insights";
import { HealthScore } from "@/components/cliente-detalhe/health-score";
import { ClienteKpis } from "@/components/cliente-detalhe/cliente-kpis";
import { MrrSparkline } from "@/components/cliente-detalhe/mrr-sparkline";
import { AtividadeChart } from "@/components/cliente-detalhe/atividade-chart";
import { ClienteTimeline } from "@/components/cliente-detalhe/cliente-timeline";

export const dynamic = "force-dynamic";

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  // Busca em paralelo: cliente full (pra header/edição) + insights agregados
  const [cliente, insights] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: params.id },
      include: {
        tags: true,
        posts: { orderBy: { dataPublicacao: "desc" }, take: 50 },
        projetos: { orderBy: { createdAt: "desc" } },
        tarefas: { orderBy: { dataEntrega: "asc" } },
        contratos: { orderBy: { dataInicio: "desc" } },
        lancamentos: { orderBy: { data: "desc" }, take: 50 },
      },
    }),
    buildClienteInsights(params.id),
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

      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <ClienteTimeline eventos={insights.timeline} />
        <BacklinksPanel type="CLIENTE" id={cliente.id} title="Mencionado em" hideWhenEmpty />
      </div>

      {/* ─── TABS (deep dive existentes) ────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="posts">Posts ({cliente.posts.length})</TabsTrigger>
          <TabsTrigger value="projetos">Projetos ({cliente.projetos.length})</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({cliente.tarefas.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({cliente.contratos.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-3">
            <Card><CardContent className="p-6 grid md:grid-cols-2 gap-6 text-sm">
              <Info label="CNPJ" value={cliente.cnpj} />
              <Info label="Email" value={cliente.email} />
              <Info label="Telefone" value={cliente.telefone} />
              <Info label="Endereço" value={cliente.endereco} />
              <Info label="Pasta Drive" value={cliente.googleDriveFolderUrl ? "Vinculada" : "Não vinculada"} />
            </CardContent></Card>
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

        <TabsContent value="posts">
          <SimpleTable
            cols={["Título", "Formato", "Status", "Publicação"]}
            rows={cliente.posts.map((p) => [
              p.titulo, p.formato, <Badge key={p.id} variant="outline">{p.status}</Badge>, formatDate(p.dataPublicacao),
            ])}
          />
        </TabsContent>

        <TabsContent value="projetos">
          <SimpleTable
            cols={["Nome", "Status", "Prioridade", "Entrega"]}
            rows={cliente.projetos.map((p) => [p.nome, p.status, p.prioridade, formatDate(p.dataEntrega)])}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <SimpleTable
            cols={["Título", "Prioridade", "Concluída", "Entrega"]}
            rows={cliente.tarefas.map((t) => [t.titulo, t.prioridade, t.concluida ? "✔" : "—", formatDate(t.dataEntrega)])}
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

function SimpleTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">Sem registros.</TableCell></TableRow>
          )}
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
