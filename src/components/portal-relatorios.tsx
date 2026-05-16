"use client";
/**
 * Tab Relatórios do Portal — reusa o PDF mensal que já existe.
 *
 * Lista os últimos 6 meses. Click → abre o PDF gerado on-demand pelo
 * endpoint `/api/clientes/[id]/relatorio-mensal?ano=...&mes=...`.
 *
 * NOTA: o endpoint do PDF requer auth interna (NextAuth) hoje. Pra
 * funcionar no portal, precisaria liberar via token. MVP: cliente
 * vê a lista mas o link só funciona depois que liberarmos o endpoint
 * pra portal (próxima sessão). Por enquanto, lista + nota explicativa.
 */
import { BarChart3, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function PortalRelatorios({ clienteId }: { clienteId: string }) {
  const hoje = new Date();
  const meses: { ano: number; mes: number; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 text-[12px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <BarChart3 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="text-foreground">Relatório mensal consolidado</strong> com métricas das redes,
              SEO, tráfego pago, conteúdo publicado e tarefas entregues.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        {meses.map((m) => (
          <a
            key={`${m.ano}-${m.mes}`}
            href={`/api/clientes/${clienteId}/relatorio-mensal?ano=${m.ano}&mes=${m.mes}`}
            target="_blank"
            rel="noreferrer"
            className="block touch-feedback"
          >
            <Card className="hover:border-primary/40 active:border-primary/60 transition-colors">
              <CardContent className="p-3.5 flex items-center gap-3 min-h-[56px]">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] sm:text-[13px] font-medium">{m.label}</div>
                  <div className="text-[10.5px] text-muted-foreground">Relatório mensal · PDF</div>
                </div>
                <span className="text-[11.5px] text-primary font-medium shrink-0">
                  Abrir →
                </span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      <p className="text-[10.5px] text-muted-foreground/70 text-center px-4">
        Se o PDF não abrir, peça ao seu contato na SAL — o relatório pode estar em produção.
      </p>
    </div>
  );
}
