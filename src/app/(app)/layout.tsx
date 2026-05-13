import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* `min-w-0` permite flex shrink em filhos com conteúdo largo (tabelas,
         kanbans). `overflow-x-clip` é defesa contra estouro horizontal —
         qualquer filho que tente ser maior que o viewport fica clipado em
         vez de gerar scroll do body. (`clip` em vez de `hidden` preserva
         position:sticky de descendentes em browsers modernos.) */}
      <main className="flex-1 min-w-0 overflow-x-clip">{children}</main>
      <CommandPalette />
    </div>
  );
}
