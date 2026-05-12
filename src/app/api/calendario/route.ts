/**
 * GET /api/calendario
 *
 * Calendário unificado — combina tarefas, posts (cliente + SAL),
 * reuniões, contratos vencendo e propostas expirando numa única lista.
 *
 * Query params (todos opcionais):
 *   inicio      — ISO date (default: 60 dias atrás)
 *   fim         — ISO date (default: 90 dias à frente)
 *   tipos       — CSV de origens (TAREFA,POST,REUNIAO,...) — filtra
 *   clienteId   — limita ao cliente específico
 *
 * Performance: as 6 queries rodam em paralelo dentro de
 * `montarCalendarioUnificado`. Volume real (~200 eventos/mês de janela)
 * roda em < 300ms.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import {
  montarCalendarioUnificado,
  type CalendarioOrigem,
} from "@/lib/calendario-unificado";

const ORIGENS_VALIDAS: CalendarioOrigem[] = [
  "TAREFA",
  "POST",
  "CONTEUDO_SAL",
  "REUNIAO",
  "CONTRATO_VENCENDO",
  "PROPOSTA_EXPIRA",
];

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const inicioRaw = searchParams.get("inicio");
    const fimRaw = searchParams.get("fim");
    const tiposRaw = searchParams.get("tipos");
    const clienteId = searchParams.get("clienteId") || undefined;

    const filtros = tiposRaw
      ? new Set(
          tiposRaw
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter((s): s is CalendarioOrigem =>
              (ORIGENS_VALIDAS as string[]).includes(s)
            )
        )
      : undefined;

    return montarCalendarioUnificado({
      inicio: inicioRaw ? new Date(inicioRaw) : undefined,
      fim: fimRaw ? new Date(fimRaw) : undefined,
      filtros,
      clienteId,
    });
  });
}
