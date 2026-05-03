"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

const KEY = "salhub.report.clienteId";

export function ReportClienteSelector({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [v, setV] = useState<string>("");
  useEffect(() => { setV(localStorage.getItem(KEY) ?? ""); }, []);
  function set(id: string) { setV(id); localStorage.setItem(KEY, id); }
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Cliente padrão dos relatórios:</span>
        <Select value={v} onValueChange={set}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
          <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-auto">Salvo no navegador</span>
      </CardContent>
    </Card>
  );
}
