import { SharePublica } from "@/components/share-publica";

export const dynamic = "force-dynamic";

export default function ShareTokenPage({ params }: { params: { token: string } }) {
  return <SharePublica token={params.token} />;
}
