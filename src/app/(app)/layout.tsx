import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
      <CommandPalette />
    </div>
  );
}
