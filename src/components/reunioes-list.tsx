"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mic, Clock, CheckCircle, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Reuniao = {
  id: string;
  titulo: string;
  data: string;
  duracaoSeg: number | null;
  status: "GRAVANDO" | "PROCESSANDO" | "TRANSCRITA" | "GRAVADA";
  participantes: string[];
  tagsLivres: string[];
  clienteNome: string | null;
  totalActions: number;
  totalBlocks: number;
};

export function ReunioesList({
  reunioes,
  kpi,
}: {
  reunioes: Reuniao[];
  kpi: { total: number; duracaoSeg: number; actions: number; clientes: number };
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Reuniões" value={String(kpi.total)} icon={<Mic className="h-3.5 w-3.5" />} />
        <Kpi label="Horas gravadas" value={fmtDur(kpi.duracaoSeg)} icon={<Clock className="h-3.5 w-3.5" />} />
        <Kpi label="Action items" value={String(kpi.actions)} icon={<CheckCircle className="h-3.5 w-3.5" />} />
        <Kpi label="Clientes atendidos" value={String(kpi.clientes)} icon={<Users className="h-3.5 w-3.5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reunião</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reunioes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/reunioes/${r.id}`} className="flex items-center gap-2.5 hover:text-primary transition">
                      <span className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: "rgba(126,48,225,0.12)" }}>
                        <Mic className="h-3.5 w-3.5 text-sal-400" />
                      </span>
                      <span>{r.titulo}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.clienteNome ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{formatDateTime(r.data)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.duracaoSeg ? fmtDur(r.duracaoSeg) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.participantes.length} pessoas</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.tagsLivres.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.status === "GRAVANDO" ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Gravando
                      </Badge>
                    ) : r.status === "PROCESSANDO" ? (
                      <Badge variant="warning">Processando</Badge>
                    ) : (
                      <Badge variant="success">Transcrita</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.totalActions > 0 ? (
                      <Badge variant="muted" className="bg-sal-600/15 text-sal-400 border-sal-600/30">
                        {r.totalActions} ações
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {reunioes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Sem reuniões cadastradas. Use o botão acima para gravar a primeira.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-2 font-display text-[22px] font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function fmtDur(seg: number): string {
  if (!seg) return "0m";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}
