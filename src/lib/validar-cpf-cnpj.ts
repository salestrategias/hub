/**
 * Validação + formatação de CPF e CNPJ.
 *
 * Algoritmo módulo 11 — padrão Receita Federal. Não chama API externa
 * (não tem como validar se o CPF "existe", só se os dígitos batem).
 *
 * Aceita string com pontuação ("123.456.789-09") ou só dígitos.
 */

/** Remove tudo que não é dígito. */
export function apenasDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Aplica máscara visual conforme tamanho (11 = CPF, 14 = CNPJ). */
export function formatarCpfCnpj(s: string): string {
  const d = apenasDigitos(s);
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return s; // não formata se tamanho inválido
}

/** Valida CPF via módulo 11. */
export function validarCpf(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(d[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(d[10]);
}

/** Valida CNPJ via módulo 11. */
export function validarCnpj(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const soma1 = pesos1.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const dv1 = soma1 % 11 < 2 ? 0 : 11 - (soma1 % 11);
  if (dv1 !== Number(d[12])) return false;

  const soma2 = pesos2.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const dv2 = soma2 % 11 < 2 ? 0 : 11 - (soma2 % 11);
  return dv2 === Number(d[13]);
}

/** Valida CPF OU CNPJ (autodetecta pelo tamanho). */
export function validarCpfCnpj(s: string): boolean {
  const d = apenasDigitos(s);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

/** Retorna "CPF" ou "CNPJ" baseado no tamanho dos dígitos. */
export function tipoDocumento(s: string): "CPF" | "CNPJ" | null {
  const d = apenasDigitos(s);
  if (d.length === 11) return "CPF";
  if (d.length === 14) return "CNPJ";
  return null;
}
