"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, FolderPlus } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export function ClienteDriveButton({ clienteId, folderUrl }: { clienteId: string; folderUrl?: string | null }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (folderUrl) {
    return (
      <Button variant="outline" asChild>
        <a href={folderUrl} target="_blank" rel="noreferrer">
          <FolderOpen className="h-4 w-4" /> Abrir pasta no Drive
        </a>
      </Button>
    );
  }

  async function criar() {
    setLoading(true);
    const res = await fetch(`/api/clientes/${clienteId}/drive-folder`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Não foi possível criar a pasta. Conecte com Google primeiro.");
      return;
    }
    toast.success("Pasta criada no Drive");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={criar} disabled={loading}>
      <FolderPlus className="h-4 w-4" /> {loading ? "Criando..." : "Criar pasta no Drive"}
    </Button>
  );
}
