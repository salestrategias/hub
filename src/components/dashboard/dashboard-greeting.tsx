"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/**
 * Saudação contextual no topo do dashboard.
 *
 * - "Bom dia / Boa tarde / Boa noite" baseado na hora local
 * - Nome curto (primeiro nome) do user logado
 * - Data por extenso em pt-BR
 *
 * Client component porque depende de hora do browser (timezone do user)
 * e do nome do session.user.
 */
export function DashboardGreeting() {
  const { data: session } = useSession();
  const [agora, setAgora] = useState<Date>(() => new Date());

  // Atualiza a saudação à meia-noite (caso a aba fique aberta noite-virando-dia)
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hora = agora.getHours();
  const cumprimento = hora < 5 ? "Boa madrugada" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const primeiroNome = (session?.user?.name ?? "").split(" ")[0] || "";
  const dataExtenso = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Capitaliza primeira letra (locale pt-BR retorna minúsculo)
  const dataFormatada = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  return (
    <div className="space-y-0.5 animate-slide-up">
      <h1 className="font-display text-[28px] md:text-[32px] font-semibold tracking-tight leading-tight">
        {cumprimento}
        {primeiroNome && (
          <>
            ,{" "}
            <span className="bg-gradient-to-r from-sal-400 to-sal-500 bg-clip-text text-transparent">
              {primeiroNome}
            </span>
          </>
        )}
        .
      </h1>
      <p className="text-[13px] text-muted-foreground font-medium">{dataFormatada}</p>
    </div>
  );
}
