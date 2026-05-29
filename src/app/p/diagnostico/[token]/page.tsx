import { DiagnosticoPublica } from "@/components/diagnostico-publica";

export const dynamic = "force-dynamic";

export default function DiagnosticoPublicaPage({ params }: { params: { token: string } }) {
  return <DiagnosticoPublica token={params.token} />;
}
