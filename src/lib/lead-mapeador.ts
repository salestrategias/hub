/**
 * Mapeador específico pra importação de Leads via CSV.
 *
 * Caso de uso principal: export do Meta Lead Ads (Facebook Forms),
 * cujas colunas padrão são:
 *   id, created_time, ad_id, ad_name, adset_id, adset_name,
 *   campaign_id, campaign_name, form_id, form_name, is_organic,
 *   platform, email, nome_completo, telefone, nome_da_empresa, endereço
 *
 * Também aceita exports mais simples (planilha manual com colunas
 * "Nome", "Email", "Telefone", "Empresa") e exports de LinkedIn Ads,
 * Google Ads Lead Form, RD Station, HubSpot.
 *
 * Regra de fallback de empresa: se `nome_da_empresa` está vazio,
 * usamos `nome_completo` (pessoa física é o "lead" — comum em
 * formulários B2C). Sem nome E sem empresa = linha ignorada.
 *
 * Dedup por email é responsabilidade do endpoint, não do mapeador.
 */
import { pegarValor } from "@/lib/csv-parser";

export type LeadImportRow = {
  empresa: string;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  origem: string;
  notas: string | null;          // captura campos extras (endereço, formulário, etc) como contexto
  createdTime: string | null;    // se vier no CSV, preservamos pra ordenar
};

export type LeadMapResult = {
  sucessos: { dados: LeadImportRow; raw: Record<string, string> }[];
  erros: { erro: string; raw: Record<string, string>; linha: number }[];
  totalLinhas: number;
};

const ALIASES = {
  email: ["email", "e_mail", "e-mail", "endereco_email"],
  nome: ["nome_completo", "full_name", "nome", "name", "first_name", "contato"],
  empresa: ["nome_da_empresa", "company_name", "company", "empresa", "organizacao", "organization", "business_name"],
  telefone: ["telefone", "phone_number", "phone", "celular", "whatsapp", "mobile", "telefone_celular"],
  endereco: ["endereco", "address", "cidade", "city", "localizacao"],
  // origem/campanha — usado pra montar lead.origem
  campanha: ["campaign_name", "campanha", "campaign"],
  anuncio: ["ad_name", "anuncio", "ad"],
  formulario: ["form_name", "formulario", "form"],
  platform: ["platform", "plataforma", "source", "origem"],
  // timestamp
  createdTime: ["created_time", "data", "date", "criado_em", "data_criacao", "lead_at", "submitted_at"],
};

export function mapearLeads(rows: Record<string, string>[]): LeadMapResult {
  const sucessos: LeadMapResult["sucessos"] = [];
  const erros: LeadMapResult["erros"] = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2;

    const email = pegarValor(row, ALIASES.email);
    const nome = pegarValor(row, ALIASES.nome);
    const empresaRaw = pegarValor(row, ALIASES.empresa);

    // Fallback de empresa: usa nome se empresa vazia
    const empresa = empresaRaw || nome;
    if (!empresa) {
      erros.push({ erro: "Linha sem empresa nem nome — preciso de pelo menos um", raw: row, linha });
      return;
    }

    sucessos.push({
      dados: {
        empresa: empresa.trim().slice(0, 200),
        contatoNome: nome ? nome.trim().slice(0, 120) : null,
        contatoEmail: email ? email.trim().toLowerCase() : null,
        contatoTelefone: pegarValor(row, ALIASES.telefone),
        origem: montarOrigem(row),
        notas: montarNotas(row),
        createdTime: pegarValor(row, ALIASES.createdTime),
      },
      raw: row,
    });
  });

  return { sucessos, erros, totalLinhas: rows.length };
}

/**
 * Monta string de origem combinando platform + campaign + ad/form.
 * Ex: "Meta · Campanha SAL Q1 · Formulário Orçamento"
 *     "Manual import"
 */
function montarOrigem(row: Record<string, string>): string {
  const partes: string[] = [];
  const platform = pegarValor(row, ALIASES.platform);
  const campanha = pegarValor(row, ALIASES.campanha);
  const anuncio = pegarValor(row, ALIASES.anuncio);
  const formulario = pegarValor(row, ALIASES.formulario);

  if (platform) {
    // "fb" → "Meta", "instagram" → "Meta", "linkedin" → "LinkedIn"
    const norm = platform.toLowerCase();
    if (norm.includes("facebook") || norm === "fb" || norm.includes("instagram")) partes.push("Meta");
    else if (norm.includes("linkedin")) partes.push("LinkedIn");
    else partes.push(platform);
  }
  if (campanha) partes.push(campanha);
  if (!campanha && anuncio) partes.push(anuncio);
  if (formulario) partes.push(formulario);

  if (partes.length === 0) return "Importação CSV";
  return partes.slice(0, 3).join(" · ").slice(0, 120);
}

/**
 * Anexa campos extras como notas iniciais (endereço, ad_id, etc).
 * Útil pra Marcelo qualificar o lead com mais contexto sem clicar
 * em "ver no Meta".
 */
function montarNotas(row: Record<string, string>): string | null {
  const linhas: string[] = [];
  const endereco = pegarValor(row, ALIASES.endereco);
  if (endereco) linhas.push(`Endereço: ${endereco}`);

  const createdTime = pegarValor(row, ALIASES.createdTime);
  if (createdTime) linhas.push(`Capturado em: ${createdTime}`);

  // Campos que NÃO mapeamos pra colunas estruturadas mas valem nota
  const extras = ["mensagem", "interesse", "produto", "servico", "comentario", "comentarios"];
  for (const e of extras) {
    const v = pegarValor(row, [e]);
    if (v) linhas.push(`${capitalize(e)}: ${v}`);
  }

  if (linhas.length === 0) return null;
  return linhas.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
