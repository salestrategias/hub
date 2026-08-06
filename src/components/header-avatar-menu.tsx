"use client";
/**
 * Hub 2.0 F2 — menu do avatar no Header (desktop).
 *
 * O Admin saiu da sidebar e mora aqui: Configurações, Claude/MCP e
 * Backups (só ADMIN vê). Perfil e Sair também. O signOut é server
 * action recebida por prop (padrão Next: server action atravessa a
 * fronteira server → client e é executada via <form action>).
 */
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, Settings, Cpu, Database, LogOut, ChevronDown } from "lucide-react";

export function HeaderAvatarMenu({
  nome,
  email,
  role,
  image,
  signOutAction,
}: {
  nome: string;
  email: string;
  role: string;
  image: string | null;
  signOutAction: () => Promise<void>;
}) {
  const initial = (nome || email || "?").charAt(0).toUpperCase();
  const isAdmin = role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border hover:bg-secondary/40 -my-1.5 py-1.5 -mr-1 pr-2 rounded-md transition outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Menu do usuário"
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden shrink-0"
            style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={nome || email} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="text-right">
            <div className="text-[12.5px] font-medium leading-tight">{nome || email}</div>
            <div className="text-[10px] text-muted-foreground">{role}</div>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px]">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil" className="gap-2 text-[13px] cursor-pointer">
            <User className="h-3.5 w-3.5" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Administração
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/admin/configuracoes" className="gap-2 text-[13px] cursor-pointer">
                <Settings className="h-3.5 w-3.5" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/mcp" className="gap-2 text-[13px] cursor-pointer">
                <Cpu className="h-3.5 w-3.5" /> Claude / MCP
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/backups" className="gap-2 text-[13px] cursor-pointer">
                <Database className="h-3.5 w-3.5" /> Backups
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {/* Logout via server action — form dentro do item */}
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full gap-2 text-[13px] cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
