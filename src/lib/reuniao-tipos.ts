/**
 * Catálogo dos tipos de reunião (Fase 2). Reusado em reuniao-detalhe,
 * reunioes-list e reuniao-form pra label/cor consistentes.
 *
 * Mantém paridade com o enum ReuniaoTipo do schema.prisma.
 */
export type ReuniaoTipo = "DIAGNOSTICO" | "ALINHAMENTO" | "KICKOFF" | "RETRO" | "COMERCIAL" | "INTERNA";

export const REUNIAO_TIPOS: { value: ReuniaoTipo; label: string; cor: string }[] = [
  { value: "DIAGNOSTICO", label: "Diagnóstico", cor: "#7E30E1" },
  { value: "COMERCIAL", label: "Comercial", cor: "#EC4899" },
  { value: "ALINHAMENTO", label: "Alinhamento", cor: "#3B82F6" },
  { value: "KICKOFF", label: "Kickoff", cor: "#10B981" },
  { value: "RETRO", label: "Retrospectiva", cor: "#F59E0B" },
  { value: "INTERNA", label: "Interna", cor: "#9696A8" },
];

const BY_VALUE = new Map(REUNIAO_TIPOS.map((t) => [t.value, t]));

export function reuniaoTipoLabel(tipo: ReuniaoTipo | null | undefined): string {
  return tipo ? BY_VALUE.get(tipo)?.label ?? tipo : "Sem tipo";
}

export function reuniaoTipoCor(tipo: ReuniaoTipo | null | undefined): string {
  return (tipo && BY_VALUE.get(tipo)?.cor) || "#9696A8";
}
