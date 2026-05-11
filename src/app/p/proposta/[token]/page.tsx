import { PropostaPublica } from "@/components/proposta-publica";

export const dynamic = "force-dynamic";

export default function PropostaPublicaPage({ params }: { params: { token: string } }) {
  return <PropostaPublica token={params.token} />;
}
