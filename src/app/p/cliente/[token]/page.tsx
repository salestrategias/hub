import { PortalCliente } from "@/components/portal-cliente";

export const dynamic = "force-dynamic";

export default function PortalClientePage({ params }: { params: { token: string } }) {
  return <PortalCliente token={params.token} />;
}
