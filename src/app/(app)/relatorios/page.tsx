import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { BarChart3, Search, Megaphone, ChevronRight } from "lucide-react";
import { ReportClienteSelector } from "@/components/report-cliente-selector";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const clientes = await prisma.cliente.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const tipos = [
    { href: "/relatorios/redes-sociais", label: "Redes Sociais", desc: "Seguidores, alcance, engajamento e evolução por rede.", icon: BarChart3 },
    { href: "/relatorios/seo", label: "SEO", desc: "Posição média, cliques orgânicos, keywords ranqueadas e score.", icon: Search },
    { href: "/relatorios/trafego-pago", label: "Tráfego Pago", desc: "Investimento, ROAS, CPA por plataforma e campanha.", icon: Megaphone },
  ];

  return (
    <PageShell title="Relatórios" subtitle="Selecione um cliente e escolha o tipo de relatório">
      <ReportClienteSelector clientes={clientes} />
      <div className="grid md:grid-cols-3 gap-4">
        {tipos.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="hover:border-primary/40 transition-colors h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><t.icon className="h-5 w-5 text-primary" /> {t.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{t.desc}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
