import {
  CONTRIBUICAO_MAXIMA_INSS, DEDUCAO_DEPENDENTE, DESCONTO_SIMPLIFICADO,
  FAIXAS_INSS, FAIXAS_IRRF, TETO_INSS,
} from "./tabelas";

/* ==========================================================================
   NÚCLEO DAS FERRAMENTAS

   Tipos, formatação e os dois cálculos que quase toda ferramenta trabalhista
   reaproveita: INSS progressivo e IRRF. Ficam aqui para existirem uma vez só —
   INSS calculado em dois lugares diferentes é INSS que vai divergir.
   ========================================================================== */

export type TipoCampo =
  | "moeda" | "numero" | "inteiro" | "percentual" | "select" | "data" | "texto";

export interface Campo {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  padrao?: string;
  dica?: string;
  opcoes?: Array<{ v: string; rotulo: string }>;
  /** Agrupa campos numa seção do formulário. */
  grupo?: string;
  /** Ocupa a linha inteira em vez de meia. */
  largo?: boolean;
}

export type EstiloLinha = "normal" | "desconto" | "subtotal" | "total" | "info";

export interface Linha {
  rotulo: string;
  valor: string;
  estilo?: EstiloLinha;
  detalhe?: string;
}

export interface Resultado {
  /** O número que a pessoa veio buscar. */
  destaque?: { rotulo: string; valor: string; detalhe?: string };
  linhas: Linha[];
  avisos?: string[];
  erro?: string;
}

export interface Ferramenta {
  slug: string;
  nome: string;
  descricao: string;
  categoria: string;
  icone: string;
  /** Preenchido quando o cálculo depende de tabela oficial. */
  vigencia?: string;
  /** Destaque no catálogo (o que a Castelo Branco usa mais). */
  destaque?: boolean;
  campos: Campo[];
  calcular: (v: Record<string, string>) => Resultado;
}

/* ------------------------------------------------------------ formatação -- */

/** Aceita "1.234,56", "1234.56" e "1234,56". Vazio vira 0. */
export function num(v: string | undefined): number {
  if (!v) return 0;
  const limpo = String(v).trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return 0;
  // Se tem vírgula, ela é o separador decimal (padrão brasileiro).
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function pct(v: number, casas = 2): string {
  return `${(v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

export function numero(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Arredonda em centavos, evitando o 0,1 + 0,2 do ponto flutuante. */
export function cent(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ INSS -- */
export interface ResultadoINSS {
  contribuicao: number;
  aliquotaEfetiva: number;
  detalhe: Array<{ faixa: string; base: number; aliquota: number; valor: number }>;
  tetoAtingido: boolean;
}

/**
 * INSS do empregado, progressivo por faixa.
 *
 * Erro clássico que isto evita: aplicar a alíquota da faixa sobre o salário
 * inteiro. Desde 2020 cada faixa incide só sobre a parcela dentro dela — como
 * no imposto de renda.
 */
export function calcularINSS(salario: number): ResultadoINSS {
  const base = Math.min(salario, TETO_INSS);
  let anterior = 0;
  let total = 0;
  const detalhe: ResultadoINSS["detalhe"] = [];

  for (const f of FAIXAS_INSS) {
    if (base <= anterior) break;
    const parcela = Math.min(base, f.ate) - anterior;
    const valor = parcela * f.aliquota;
    total += valor;
    detalhe.push({
      faixa: `${brl(anterior + 0.01)} a ${brl(f.ate)}`,
      base: cent(parcela),
      aliquota: f.aliquota,
      valor: cent(valor),
    });
    anterior = f.ate;
  }

  const contribuicao = Math.min(cent(total), CONTRIBUICAO_MAXIMA_INSS);
  return {
    contribuicao,
    aliquotaEfetiva: salario > 0 ? contribuicao / salario : 0,
    detalhe,
    tetoAtingido: salario > TETO_INSS,
  };
}

/* ------------------------------------------------------------------ IRRF -- */
export interface ResultadoIRRF {
  imposto: number;
  base: number;
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  usouSimplificado: boolean;
  deducoes: number;
}

/**
 * IRRF na fonte.
 *
 * Compara as deduções legais (INSS + dependentes + pensão) com o desconto
 * simplificado e usa o que der menos imposto — que é o que a lei manda e o que
 * a maioria das planilhas caseiras esquece.
 */
export function calcularIRRF(
  bruto: number,
  inss: number,
  dependentes = 0,
  outrasDeducoes = 0
): ResultadoIRRF {
  const legais = inss + dependentes * DEDUCAO_DEPENDENTE + outrasDeducoes;
  const usouSimplificado = DESCONTO_SIMPLIFICADO > legais;
  const deducoes = usouSimplificado ? DESCONTO_SIMPLIFICADO : legais;
  const base = Math.max(0, bruto - deducoes);

  const faixa = FAIXAS_IRRF.find((f) => base <= f.ate) ?? FAIXAS_IRRF[FAIXAS_IRRF.length - 1];
  const imposto = Math.max(0, cent(base * faixa.aliquota - faixa.deducao));

  return {
    imposto,
    base: cent(base),
    aliquotaNominal: faixa.aliquota,
    aliquotaEfetiva: bruto > 0 ? imposto / bruto : 0,
    usouSimplificado,
    deducoes: cent(deducoes),
  };
}

/* ------------------------------------------------------- dígito de módulo -- */
export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (ate: number) => {
    const pesos = ate === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Meses inteiros entre duas datas, contando fração ≥ 15 dias como mês cheio. */
export function mesesTrabalhados(inicio: Date, fim: Date): number {
  let meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
  if (fim.getDate() - inicio.getDate() + 1 >= 15) meses += 1;
  return Math.max(0, meses);
}

export function diasEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000);
}

export function data(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
