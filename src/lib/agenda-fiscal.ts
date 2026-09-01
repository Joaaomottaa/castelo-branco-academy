/* ==========================================================================
   AGENDA DE OBRIGAÇÕES

   O que faltava na comunidade não era mais um lugar para conversar: era um
   motivo para abrir a tela todo dia. Para quem trabalha em escritório
   contábil, esse motivo tem nome — prazo.

   As datas aqui saem de regra, não de tabela: obrigação mensal vence em dia
   fixo do mês seguinte ao da apuração, ou no último dia útil dele. Isso
   dispensa alguém alimentar um calendário todo ano (e o calendário
   desatualizado é pior que nenhum).

   Duas ressalvas ficam explícitas na tela, porque o profissional vai conferir:

   · feriado não entra na conta. Só fim de semana é empurrado para o dia útil
     seguinte — feriado municipal e estadual não caberia em regra nenhuma.
   · prazo de obrigação estadual (EFD ICMS/IPI) varia por UF; o que está aqui
     é o vencimento mais comum, com o aviso de conferir na sua.

   A ordem de dependência da folha (eSocial → EFD-Reinf → DCTFWeb) é o detalhe
   que mais custa a quem está começando: sem fechar o eSocial não sai a
   Reinf, e sem a Reinf a DCTFWeb não gera o DARF.
   ========================================================================== */

export type Periodicidade = "mensal" | "anual";

export interface Obrigacao {
  sigla: string;
  nome: string;
  /** Para quem isso importa — some da lista de quem não atende esse regime. */
  publico: "Folha" | "Fiscal" | "Contábil" | "Simples" | "Pessoa física";
  periodicidade: Periodicidade;
  /**
   * Dia do vencimento.
   *
   * · número        — dia do calendário; cai em fim de semana, empurra.
   * · "ultimo-util" — último dia útil do mês.
   * · {utilN: n}    — n-ésimo dia útil do mês, que é como a Receita escreve o
   *                   prazo da EFD-Contribuições.
   */
  dia: number | "ultimo-util" | { utilN: number };
  /** Meses à frente do período apurado. 1 = mês seguinte. Só no mensal. */
  mesesAdiante?: number;
  /** Mês do vencimento (1–12). Só no anual. */
  mes?: number;
  nota?: string;
  /** Obrigação que precisa estar fechada antes desta. */
  depende?: string;
}

export const OBRIGACOES: Obrigacao[] = [
  {
    sigla: "eSocial",
    nome: "Fechamento da folha no eSocial",
    publico: "Folha",
    periodicidade: "mensal",
    dia: 15,
    mesesAdiante: 1,
    nota: "Primeiro da fila: sem o fechamento aqui, a EFD-Reinf não sai.",
  },
  {
    sigla: "EFD-Reinf",
    nome: "EFD-Reinf",
    publico: "Folha",
    periodicidade: "mensal",
    dia: 15,
    mesesAdiante: 1,
    depende: "eSocial",
    nota: "Retenções e serviços tomados. Depende do eSocial fechado.",
  },
  {
    sigla: "FGTS Digital",
    nome: "FGTS Digital",
    publico: "Folha",
    periodicidade: "mensal",
    dia: 20,
    mesesAdiante: 1,
    nota: "A guia nasce do que foi declarado no eSocial.",
  },
  {
    sigla: "DCTFWeb",
    nome: "DCTFWeb",
    publico: "Fiscal",
    periodicidade: "mensal",
    dia: "ultimo-util",
    mesesAdiante: 1,
    depende: "EFD-Reinf",
    nota: "Unificou a DCTF mensal. Sem ela não sai o DARF — e o MIT entra aqui.",
  },
  {
    sigla: "EFD-Contribuições",
    nome: "EFD-Contribuições (PIS/Cofins)",
    publico: "Fiscal",
    periodicidade: "mensal",
    dia: { utilN: 10 },
    mesesAdiante: 2,
    nota: "10º dia útil do segundo mês seguinte ao da apuração.",
  },
  {
    sigla: "EFD ICMS/IPI",
    nome: "SPED Fiscal — EFD ICMS/IPI",
    publico: "Fiscal",
    periodicidade: "mensal",
    dia: 20,
    mesesAdiante: 1,
    nota: "O prazo é definido por cada estado; confira o da sua UF.",
  },
  {
    sigla: "PGDAS-D",
    nome: "PGDAS-D e DAS do Simples",
    publico: "Simples",
    periodicidade: "mensal",
    dia: 20,
    mesesAdiante: 1,
    nota: "Desde 2026 a multa por atraso é aplicada automaticamente.",
  },
  {
    sigla: "DEFIS",
    nome: "DEFIS — declaração anual do Simples",
    publico: "Simples",
    periodicidade: "anual",
    dia: "ultimo-util",
    mes: 3,
    nota: "Último dia útil de março.",
  },
  {
    sigla: "ECD",
    nome: "ECD — Escrituração Contábil Digital",
    publico: "Contábil",
    periodicidade: "anual",
    dia: "ultimo-util",
    mes: 5,
    nota: "Último dia útil de maio, do ano-calendário anterior. É a base da ECF.",
  },
  {
    sigla: "IRPF",
    nome: "IRPF — declaração de ajuste anual",
    publico: "Pessoa física",
    periodicidade: "anual",
    dia: "ultimo-util",
    mes: 5,
  },
  {
    sigla: "ECF",
    nome: "ECF — Escrituração Contábil Fiscal",
    publico: "Contábil",
    periodicidade: "anual",
    dia: "ultimo-util",
    mes: 7,
    depende: "ECD",
    nota: "Último dia útil de julho.",
  },
];

export interface Vencimento {
  obrigacao: Obrigacao;
  /** Data do vencimento já ajustada para dia útil. */
  data: Date;
  /** Dias corridos até o vencimento. 0 = hoje. */
  faltam: number;
  /** O período a que a entrega se refere ("competência 08/2026", "ano 2025"). */
  competencia: string;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Empurra sábado e domingo para a segunda. Feriado não entra — ver o topo. */
function proximoDiaUtil(d: Date): Date {
  const r = new Date(d);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

function ultimoDiaUtilDoMes(ano: number, mes0: number): Date {
  const d = new Date(ano, mes0 + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function diaDoMes(ano: number, mes0: number, dia: number): Date {
  const ultimo = new Date(ano, mes0 + 1, 0).getDate();
  return proximoDiaUtil(new Date(ano, mes0, Math.min(dia, ultimo)));
}

/** O n-ésimo dia útil do mês. */
function nEsimoDiaUtil(ano: number, mes0: number, n: number): Date {
  const d = new Date(ano, mes0, 1);
  let contados = 0;
  while (true) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      contados += 1;
      if (contados >= n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
    // Estourou o mês (mês com menos dias úteis que o pedido): fica no último.
    if (d.getMonth() !== mes0) return ultimoDiaUtilDoMes(ano, mes0);
  }
}

/** Resolve qualquer forma de `dia` numa data. */
function resolverDia(ano: number, mes0: number, dia: Obrigacao["dia"]): Date {
  if (dia === "ultimo-util") return ultimoDiaUtilDoMes(ano, mes0);
  if (typeof dia === "object") return nEsimoDiaUtil(ano, mes0, dia.utilN);
  return diaDoMes(ano, mes0, dia);
}

function competenciaMensal(ano: number, mes0: number, mesesAdiante: number): string {
  const d = new Date(ano, mes0 - mesesAdiante, 1);
  return `competência ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Os próximos vencimentos a partir de `hoje`.
 *
 * `hoje` entra por parâmetro em vez de vir de `new Date()` lá dentro: assim a
 * função é testável e a tela decide o fuso.
 */
export function proximosVencimentos(hoje: Date, quantos = 6): Vencimento[] {
  const lista: Vencimento[] = [];
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  for (const o of OBRIGACOES) {
    // Olha 14 meses à frente: cobre o anual que já passou neste ano.
    for (let salto = 0; salto <= 14; salto++) {
      let data: Date;
      let competencia: string;

      if (o.periodicidade === "mensal") {
        const base = new Date(hoje.getFullYear(), hoje.getMonth() + salto, 1);
        data = resolverDia(base.getFullYear(), base.getMonth(), o.dia);
        competencia = competenciaMensal(
          base.getFullYear(),
          base.getMonth(),
          o.mesesAdiante ?? 1
        );
      } else {
        const ano = hoje.getFullYear() + Math.floor(salto / 12);
        const mes0 = (o.mes ?? 1) - 1;
        data = resolverDia(ano, mes0, o.dia);
        competencia = `ano-calendário ${ano - 1}`;
        if (data < inicio) continue;
      }

      if (data < inicio) continue;
      lista.push({
        obrigacao: o,
        data,
        faltam: Math.round((data.getTime() - inicio.getTime()) / 86400000),
        competencia,
      });
      break;
    }
  }

  return lista.sort((a, b) => a.data.getTime() - b.data.getTime()).slice(0, quantos);
}

export function porExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "vence hoje", "amanhã", "em 3 dias" — o texto que a pessoa lê primeiro. */
export function faltamEmTexto(dias: number): string {
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias <= 30) return `em ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "em cerca de um mês" : `em cerca de ${meses} meses`;
}
