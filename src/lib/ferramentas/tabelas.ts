/* ==========================================================================
   TABELAS OFICIAIS

   Todo número que o governo muda mora AQUI, num arquivo só. Os cálculos em
   `calculos.ts` não têm constante fiscal solta — é o que permite atualizar a
   plataforma inteira mexendo em um lugar quando sai a portaria.

   ⚠️  RESPONSABILIDADE: as ferramentas fazem a conta certa com a tabela que
   estiver aqui. Manter a tabela vigente é trabalho humano. A tela mostra a
   vigência em todo cálculo que depende dela, de propósito: ninguém deve
   entregar número ao cliente sem saber de quando é a tabela.
   ========================================================================== */

/** Aparece na interface de toda ferramenta que usa tabela oficial. */
export const VIGENCIA = {
  inss: "Tabela de 2025 (Portaria Interministerial MPS/MF)",
  irrf: "Tabela mensal vigente desde maio/2025",
  simples: "LC 123/2006, anexos vigentes desde 2018",
  presumido: "Percentuais de presunção do art. 15 da Lei 9.249/1995",
  reforma: "EC 132/2023 e LC 214/2025",
  revisadoEm: "agosto de 2026",
};

/* ------------------------------------------------------------------ INSS -- */
export const SALARIO_MINIMO = 1518.0;

/** Contribuição do empregado — progressiva por faixa, como no holerite. */
export const FAIXAS_INSS = [
  { ate: 1518.0, aliquota: 0.075 },
  { ate: 2793.88, aliquota: 0.09 },
  { ate: 4190.83, aliquota: 0.12 },
  { ate: 8157.41, aliquota: 0.14 },
];

export const TETO_INSS = 8157.41;

/** Teto da contribuição: soma das faixas até o limite. */
export const CONTRIBUICAO_MAXIMA_INSS = (() => {
  let total = 0;
  let anterior = 0;
  for (const f of FAIXAS_INSS) {
    total += (f.ate - anterior) * f.aliquota;
    anterior = f.ate;
  }
  return Math.round(total * 100) / 100;
})();

/* ------------------------------------------------------------------ IRRF -- */
export const FAIXAS_IRRF = [
  { ate: 2259.2, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.0 },
];

export const DEDUCAO_DEPENDENTE = 189.59;

/**
 * Desconto simplificado: alternativa às deduções legais, escolhida sempre que
 * for mais vantagem para o contribuinte. É o instrumento que na prática isenta
 * quem ganha até dois salários mínimos.
 */
export const DESCONTO_SIMPLIFICADO = 607.2;

/* ------------------------------------------------------- Simples Nacional -- */
export interface FaixaSimples {
  ate: number;
  aliquota: number;
  deduzir: number;
}

export const ANEXOS_SIMPLES: Record<string, { nome: string; faixas: FaixaSimples[] }> = {
  I: {
    nome: "Anexo I — Comércio",
    faixas: [
      { ate: 180000, aliquota: 0.04, deduzir: 0 },
      { ate: 360000, aliquota: 0.073, deduzir: 5940 },
      { ate: 720000, aliquota: 0.095, deduzir: 13860 },
      { ate: 1800000, aliquota: 0.107, deduzir: 22500 },
      { ate: 3600000, aliquota: 0.143, deduzir: 87300 },
      { ate: 4800000, aliquota: 0.19, deduzir: 378000 },
    ],
  },
  II: {
    nome: "Anexo II — Indústria",
    faixas: [
      { ate: 180000, aliquota: 0.045, deduzir: 0 },
      { ate: 360000, aliquota: 0.078, deduzir: 5940 },
      { ate: 720000, aliquota: 0.1, deduzir: 13860 },
      { ate: 1800000, aliquota: 0.112, deduzir: 22500 },
      { ate: 3600000, aliquota: 0.147, deduzir: 85500 },
      { ate: 4800000, aliquota: 0.3, deduzir: 720000 },
    ],
  },
  III: {
    nome: "Anexo III — Serviços (locação, instalação, transporte municipal)",
    faixas: [
      { ate: 180000, aliquota: 0.06, deduzir: 0 },
      { ate: 360000, aliquota: 0.112, deduzir: 9360 },
      { ate: 720000, aliquota: 0.135, deduzir: 17640 },
      { ate: 1800000, aliquota: 0.16, deduzir: 35640 },
      { ate: 3600000, aliquota: 0.21, deduzir: 125640 },
      { ate: 4800000, aliquota: 0.33, deduzir: 648000 },
    ],
  },
  IV: {
    nome: "Anexo IV — Construção, limpeza, vigilância, advocacia",
    faixas: [
      { ate: 180000, aliquota: 0.045, deduzir: 0 },
      { ate: 360000, aliquota: 0.09, deduzir: 8100 },
      { ate: 720000, aliquota: 0.102, deduzir: 12420 },
      { ate: 1800000, aliquota: 0.14, deduzir: 39780 },
      { ate: 3600000, aliquota: 0.22, deduzir: 183780 },
      { ate: 4800000, aliquota: 0.33, deduzir: 828000 },
    ],
  },
  V: {
    nome: "Anexo V — Tecnologia, engenharia, consultoria (fator R < 28%)",
    faixas: [
      { ate: 180000, aliquota: 0.155, deduzir: 0 },
      { ate: 360000, aliquota: 0.18, deduzir: 4500 },
      { ate: 720000, aliquota: 0.195, deduzir: 9900 },
      { ate: 1800000, aliquota: 0.205, deduzir: 17100 },
      { ate: 3600000, aliquota: 0.23, deduzir: 62100 },
      { ate: 4800000, aliquota: 0.305, deduzir: 540000 },
    ],
  },
};

export const TETO_SIMPLES = 4800000;

/** Divisor do fator R: folha/RBT12 nesse patamar leva o serviço ao Anexo III. */
export const FATOR_R_CORTE = 0.28;

/* -------------------------------------------------------- Lucro Presumido -- */
export interface Atividade {
  rotulo: string;
  irpj: number;
  csll: number;
}

export const PRESUNCOES: Record<string, Atividade> = {
  comercio: { rotulo: "Comércio e indústria", irpj: 0.08, csll: 0.12 },
  cargas: { rotulo: "Transporte de cargas", irpj: 0.08, csll: 0.12 },
  passageiros: { rotulo: "Transporte de passageiros", irpj: 0.16, csll: 0.12 },
  servicos: { rotulo: "Serviços em geral", irpj: 0.32, csll: 0.32 },
  hospitalar: { rotulo: "Serviços hospitalares e laboratoriais", irpj: 0.08, csll: 0.12 },
  combustivel: { rotulo: "Revenda de combustível", irpj: 0.016, csll: 0.12 },
  imobiliaria: { rotulo: "Atividade imobiliária", irpj: 0.08, csll: 0.12 },
};

export const IRPJ_ALIQUOTA = 0.15;
export const IRPJ_ADICIONAL = 0.1;
/** O adicional de 10% incide sobre o que passar de R$ 20 mil por mês. */
export const IRPJ_LIMITE_MENSAL = 20000;
export const CSLL_ALIQUOTA = 0.09;
export const PIS_CUMULATIVO = 0.0065;
export const COFINS_CUMULATIVO = 0.03;

/* ------------------------------------------------------ Reforma tributária -- */
/**
 * Cronograma da transição. As alíquotas de referência são estimativa oficial
 * enquanto o Senado não fixa em lei complementar — por isso o campo é editável
 * na ferramenta.
 */
export const CBS_REFERENCIA = 0.088;
export const IBS_REFERENCIA = 0.177;

export const TRANSICAO: Record<
  number,
  { cbs: number; ibs: number; antigos: number; nota: string }
> = {
  2026: { cbs: 0.009, ibs: 0.001, antigos: 1, nota: "Ano de teste: o recolhido é compensável com PIS/Cofins." },
  2027: { cbs: 1, ibs: 0.001, antigos: 0, nota: "CBS integral; PIS e Cofins extintos; IPI zerado (salvo ZFM); Imposto Seletivo entra." },
  2028: { cbs: 1, ibs: 0.001, antigos: 0, nota: "Mantém 2027. Último ano antes da subida do IBS." },
  2029: { cbs: 1, ibs: 0.1, antigos: 0.9, nota: "IBS em 10%; ICMS e ISS reduzidos a 90%." },
  2030: { cbs: 1, ibs: 0.2, antigos: 0.8, nota: "IBS em 20%; ICMS e ISS reduzidos a 80%." },
  2031: { cbs: 1, ibs: 0.3, antigos: 0.7, nota: "IBS em 30%; ICMS e ISS reduzidos a 70%." },
  2032: { cbs: 1, ibs: 0.4, antigos: 0.6, nota: "IBS em 40%; ICMS e ISS reduzidos a 60%." },
  2033: { cbs: 1, ibs: 1, antigos: 0, nota: "Modelo pleno: ICMS e ISS extintos." },
};

/* -------------------------------------------------------------- Importação -- */
export const PIS_IMPORTACAO = 0.021;
export const COFINS_IMPORTACAO = 0.0965;
/** Adicional ao Frete para Renovação da Marinha Mercante — só marítimo. */
export const AFRMM = 0.08;
/** Taxa Siscomex — valor fixo por declaração de importação. */
export const TAXA_SISCOMEX = 154.23;

/* -------------------------------------------------------------- Trabalhista -- */
export const FGTS_MENSAL = 0.08;
export const FGTS_MULTA_RESCISORIA = 0.4;
export const JORNADA_MENSAL_PADRAO = 220;
