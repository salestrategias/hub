"use client";
import { Plus, TrendingUp, ListTodo, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useQuickCreate } from "@/components/quick-create-provider";

/**
 * Botão "+ Novo" global no header. Torna visível o quick-create que hoje
 * só responde aos atalhos Shift+L / Shift+T / Shift+F — afordância que
 * faltava. Reusa o mesmo contexto (QuickCreateProvider): abre exatamente
 * os mesmos modais, sem duplicar lógica.
 */
export function QuickCreateButton() {
  const { abrir } = useQuickCreate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label="Criar novo">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => abrir("lead")}>
          <TrendingUp className="h-4 w-4 mr-2 text-primary" />
          Lead
          <Kbd>⇧L</Kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => abrir("tarefa")}>
          <ListTodo className="h-4 w-4 mr-2 text-primary" />
          Tarefa
          <Kbd>⇧T</Kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => abrir("lancamento")}>
          <DollarSign className="h-4 w-4 mr-2 text-primary" />
          Lançamento
          <Kbd>⇧F</Kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto pl-4 text-[10px] font-mono text-muted-foreground/60">
      {children}
    </span>
  );
}
