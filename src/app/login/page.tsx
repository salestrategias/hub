import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 relative overflow-hidden">
      {/* Glow gradient sutil de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(126,48,225,0.18), transparent 70%)",
        }}
      />
      <div className="w-full max-w-md space-y-7 animate-slide-up relative">
        <div className="text-center space-y-3">
          <div
            className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)",
              boxShadow: "0 8px 24px rgba(126,48,225,0.45), 0 1px 0 rgba(255,255,255,0.15) inset",
            }}
          >
            <Image src="/sal-logo-white.svg" alt="SAL" width={28} height={28} className="brightness-0 invert" />
          </div>
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-tight">SAL Hub</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] mt-1">
              Estratégias de Marketing
            </p>
          </div>
          <p className="text-sm text-muted-foreground pt-2">
            Entre com suas credenciais ou conta Google para continuar.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
