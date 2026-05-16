import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Palette, ArrowRight, HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManualLandingPage() {
  const [countPlaybook, countMarca, countHub] = await Promise.all([
    prisma.docSecao.count({ where: { tipo: "PLAYBOOK", publicada: true } }),
    prisma.docSecao.count({ where: { tipo: "MARCA", publicada: true } }),
    prisma.docSecao.count({ where: { tipo: "HUB", publicada: true } }),
  ]);

  return (
    <PageShell
      title="Manual SAL"
      subtitle="Playbook operacional, brand book e manual do Hub"
    >
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl">
        <Link href="/manual/playbook">
          <Card className="hover:border-primary/60 transition-colors cursor-pointer h-full">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}>
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-[10px]">{countPlaybook} seção(ões)</Badge>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Playbook</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Como a SAL opera: atendimento, onboarding, workflow editorial,
                  tráfego pago, SEO, comercial, reuniões padrão.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                Abrir <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manual/marca">
          <Card className="hover:border-primary/60 transition-colors cursor-pointer h-full">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#EC4899 0%,#BE185D 100%)" }}>
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-[10px]">{countMarca} seção(ões)</Badge>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Marca</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Brand book: logo, paleta, tipografia, tom de voz,
                  manifesto, personas, pilares editoriais.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                Abrir <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manual/hub">
          <Card className="hover:border-primary/60 transition-colors cursor-pointer h-full">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10B981 0%,#047857 100%)" }}>
                  <HelpCircle className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-[10px]">{countHub} seção(ões)</Badge>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Hub</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manual de uso do sistema: cada módulo explicado, atalhos,
                  workflows, portal do cliente, integrações.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                Abrir <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
}
