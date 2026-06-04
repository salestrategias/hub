"use client";
import { useRef } from "react";
import { Plus, TrendingUp, ListTodo, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useQuickCreate } from "@/components/quick-create-provider";

type Alvo = "lead" | "tarefa" | "lancamento";

/**
 * Botão "+ Novo" global no header. Abre um menu (Lead / Tarefa / Lançamento)
 * e dispara o modal do QuickCreateProvider.
 *
 * IMPORTANTE — o modal é aberto em `onCloseAutoFocus`, ou seja, SÓ depois do
 * dropdown fechar de verdade. Abrir o Dialog direto no clique do item (com o
 * DropdownMenu modal ainda fechando) causa o conflito clássico do Radix: o
 * body fica com `pointer-events:none` preso e a página/modal ficam
 * inclicáveis. Guardamos o alvo num `ref` (não em state) pra o callback de
 * fechamento não ler uma closure desatualizada.
 */
export function QuickCreateButton() {
  const { abrir } = useQuickCreate();
  const pendente = useRef<Alvo | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label="Criar novo">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onCloseAutoFocus={(e) => {
          if (!pendente.current) return;
          e.preventDefault();
          const alvo = pendente.current;
          pendente.current = null;
          abrir(alvo);
        }}
      >
        <DropdownMenuItem onSelect={() => (pendente.current = "lead")}>
          <TrendingUp className="h-4 w-4 mr-2 text-primary" />
          Lead
          <Kbd>⇧L</Kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (pendente.current = "tarefa")}>
          <ListTodo className="h-4 w-4 mr-2 text-primary" />
          Tarefa
          <Kbd>⇧T</Kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (pendente.current = "lancamento")}>
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
