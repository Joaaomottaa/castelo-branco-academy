import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import { nomeDaFerramenta } from "./ferramentas/catalogo";

/* ==========================================================================
   MÉTRICAS DO PAINEL ADMINISTRATIVO

   Dois modos, e a distinção é explícita na tela:

   'real' — agregações do banco, via RPC restrita a admin. É o que a plataforma
            realmente registrou. Numa base nova muitos gráficos ficam quase
            vazios — e isso é a verdade.

   'demo' — cenário de demonstração: operação coerente com sazonalidade contábil
            de verdade (pico em janeiro pelo fechamento, queda em dezembro,
            fim de semana fraco). Serve para apresentar a leitura que o painel
            entrega quando a base estiver cheia.

   Os dois passam pela MESMA estrutura e pelos mesmos componentes. Quando os
   dados reais crescerem, é só deixar em 'real'.

   Cada indicador declara a `origem`:
     'medido'   — contado no banco
     'estimado' — derivado de um medido por um modelo declarado (visitantes,
                  MRR). Vira medido quando a funcionalidade existir.
   ========================================================================== */

export type ModoMetricas = "real" | "demo";
export type OrigemMetrica = "medido" | "estimado";
export type Granularidade = "dia" | "semana" | "mes";
export type Periodo = "7d" | "30d" | "12s" | "mes" | "trimestre" | "semestre" | "ano";
export type ChaveMetrica =
  | "matriculas" | "receita" | "certificados" | "cadastros" | "candidaturas";

export const PERIODOS: Array<{ v: Periodo; rotulo: string; gran: Granularidade }> = [
  { v: "7d", rotulo: "7 dias", gran: "dia" },
  { v: "30d", rotulo: "30 dias", gran: "dia" },
  { v: "12s", rotulo: "12 semanas", gran: "semana" },
  { v: "mes", rotulo: "Mês", gran: "dia" },
  { v: "trimestre", rotulo: "Trimestre", gran: "mes" },
  { v: "semestre", rotulo: "Semestre", gran: "mes" },
  { v: "ano", rotulo: "Ano", gran: "mes" },
];

export const METRICAS: Array<{
  v: ChaveMetrica; rotulo: string; cor: string; moeda?: boolean;
}> = [
  { v: "matriculas", rotulo: "Matrículas", cor: "#C89F50" },
  { v: "receita", rotulo: "Receita recorrente", cor: "#2F6E75", moeda: true },
  { v: "certificados", rotulo: "Certificados", cor: "#00204D" },
  { v: "cadastros", rotulo: "Novos cadastros", cor: "#1F4A7A" },
  { v: "candidaturas", rotulo: "Candidaturas", cor: "#7A3E2F" },
];

export const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export interface Indicador {
  valor: number;
  origem: OrigemMetrica;
  /** Como foi obtido — aparece no tooltip do cartão. */
  nota?: string;
}

export interface Serie {
  rotulos: string[];
  gran: Granularidade;
  valores: Record<ChaveMetrica, number[]>;
}

export interface Metricas {
  modo: ModoMetricas;
  ano: number;
  periodo: Periodo;
  anosDisponiveis: number[];
  /** Texto do recorte, para o subtítulo da página. */
  rotuloJanela: string;

  receita: Indicador;
  vagas: Indicador;

  /** Totais do recorte e do mesmo recorte um ano antes. */
  totais: Record<ChaveMetrica, number>;
  totaisAnterior: Record<ChaveMetrica, number>;

  serie: Serie;

  funil: Array<{ rotulo: string; valor: number; nota?: string }>;
  planos: Array<{ rotulo: string; valor: number }>;
  ferramentas: Array<{ rotulo: string; valor: number; detalhe?: string }>;
  cursos: Array<{ titulo: string; alunos: number; conclusao: number; nota: number; cor: string }>;
  saude: Array<{ rotulo: string; valor: string; estado: "ok" | "atencao" | "critico"; detalhe: string }>;

  erro?: string;
}

/** Preço do plano Pro. Fonte única: quando houver cobrança, vem da assinatura. */
const PRECO_PRO = 89;
const PRECO_EMPRESARIAL = 890;

/**
 * Visitantes por cadastro. 4:1 é a razão que a média do mercado de educação
 * B2C sustenta; vira medido no dia em que houver analytics na landing.
 */
const VISITAS_POR_CADASTRO = 4;

/* ======================================================================
   JANELA DE TEMPO
   ====================================================================== */
export interface Janela {
  inicio: Date;
  fim: Date;
  gran: Granularidade;
  rotulo: string;
}

function dia(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

/**
 * Monta a janela do recorte. Quando o ano escolhido não é o corrente, os
 * períodos relativos ancoram no fim daquele ano — "últimos 30 dias de 2024"
 * significa dezembro de 2024, não os últimos 30 dias de hoje.
 */
export function janela(periodo: Periodo, ano: number, mes: number): Janela {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const ref = ano === anoAtual ? hoje : new Date(ano, 11, 31);
  const gran = PERIODOS.find((p) => p.v === periodo)?.gran ?? "mes";

  switch (periodo) {
    case "7d":
      return { inicio: dia(ref, -6), fim: ref, gran, rotulo: "Últimos 7 dias" };
    case "30d":
      return { inicio: dia(ref, -29), fim: ref, gran, rotulo: "Últimos 30 dias" };
    case "12s":
      return { inicio: dia(ref, -83), fim: ref, gran, rotulo: "Últimas 12 semanas" };
    case "mes": {
      const inicio = new Date(ano, mes, 1);
      const ultimo = new Date(ano, mes + 1, 0);
      const fim = ano === anoAtual && mes === hoje.getMonth() ? hoje : ultimo;
      return { inicio, fim, gran, rotulo: `${MESES[mes]} de ${ano}` };
    }
    case "trimestre": {
      const fim = ref;
      const inicio = new Date(fim.getFullYear(), fim.getMonth() - 2, 1);
      return { inicio, fim, gran, rotulo: "Último trimestre" };
    }
    case "semestre": {
      const fim = ref;
      const inicio = new Date(fim.getFullYear(), fim.getMonth() - 5, 1);
      return { inicio, fim, gran, rotulo: "Últimos 6 meses" };
    }
    default: {
      const inicio = new Date(ano, 0, 1);
      const fim = ano === anoAtual ? hoje : new Date(ano, 11, 31);
      return { inicio, fim, gran, rotulo: `Ano de ${ano}` };
    }
  }
}

function umAnoAntes(j: Janela): Janela {
  const desloca = (d: Date) => {
    const x = new Date(d);
    x.setFullYear(x.getFullYear() - 1);
    return x;
  };
  return { ...j, inicio: desloca(j.inicio), fim: desloca(j.fim) };
}

function rotularBalde(iso: string, gran: Granularidade): string {
  const d = new Date(`${iso}T12:00:00`);
  if (gran === "mes") return MESES[d.getMonth()];
  if (gran === "semana") return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ======================================================================
   CENÁRIO DE DEMONSTRAÇÃO
   ====================================================================== */

/**
 * Sazonalidade real de escritório contábil: janeiro dispara (fechamento e
 * obrigações anuais), julho sobe (planejamento de meio de ano), dezembro cai
 * (ninguém começa curso em dezembro).
 */
const SAZONALIDADE = [1.35, 1.1, 1.05, 0.95, 1.0, 0.9, 1.15, 1.2, 1.05, 1.0, 0.85, 0.6];

/** Contador estuda em dia útil. Domingo à noite ainda tem algum movimento. */
const DIA_DA_SEMANA = [0.45, 1.15, 1.2, 1.15, 1.1, 0.95, 0.35];

/** Matrículas de um dia. Determinístico: mesma data, mesmo número. */
function matriculasNoDia(d: Date, anoBase: number): number {
  const fator = Math.pow(0.62, anoBase - d.getFullYear());
  const crescimento = Math.pow(1.055, d.getMonth());
  const ondulacao = 1 + Math.sin(d.getDate() * 1.7 + d.getMonth()) * 0.14;
  const base = (96 / 30) * fator * crescimento;
  return Math.max(0, Math.round(base * SAZONALIDADE[d.getMonth()] * DIA_DA_SEMANA[d.getDay()] * ondulacao));
}

function chaveBalde(d: Date, gran: Granularidade): string {
  if (gran === "mes") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  if (gran === "semana") {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // segunda-feira
    return x.toISOString().slice(0, 10);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function serieDemo(j: Janela, anoBase: number): Serie {
  const baldes = new Map<string, number>();
  for (let d = new Date(j.inicio); d <= j.fim; d = dia(d, 1)) {
    const k = chaveBalde(d, j.gran);
    baldes.set(k, (baldes.get(k) ?? 0) + matriculasNoDia(d, anoBase));
  }

  const chaves = [...baldes.keys()].sort();
  const matriculas = chaves.map((k) => baldes.get(k) ?? 0);

  // Receita: base recorrente que acumula ao longo do recorte.
  let assinantes = Math.round(340 * Math.pow(0.62, anoBase - j.inicio.getFullYear()));
  const receita = matriculas.map((m) => {
    assinantes += Math.round(m * 0.34);
    return Math.round(assinantes * PRECO_PRO + m * 0.06 * PRECO_EMPRESARIAL);
  });

  return {
    rotulos: chaves.map((k) => rotularBalde(k, j.gran)),
    gran: j.gran,
    valores: {
      matriculas,
      receita,
      certificados: matriculas.map((m, i) => Math.round(m * (0.28 + i * 0.002))),
      cadastros: matriculas.map((m) => Math.round(m * 2.4)),
      candidaturas: matriculas.map((m) => Math.round(m * 0.42)),
    },
  };
}

const CURSOS_DEMO = [
  { titulo: "Departamento Fiscal do Zero", alunos: 2103, conclusao: 68, nota: 4.8, cor: "#B88A45" },
  { titulo: "Reforma Tributária na Prática", alunos: 1284, conclusao: 71, nota: 4.9, cor: "#00204D" },
  { titulo: "Excel e Power BI para Contadores", alunos: 1163, conclusao: 82, nota: 4.9, cor: "#2F6E75" },
  { titulo: "Recuperação de Créditos Tributários", alunos: 968, conclusao: 54, nota: 4.7, cor: "#1F4A7A" },
  { titulo: "Departamento Pessoal do Zero", alunos: 894, conclusao: 61, nota: 4.8, cor: "#7A3E2F" },
  { titulo: "Contabilidade para Transporte e Logística", alunos: 742, conclusao: 66, nota: 4.9, cor: "#3D5A3C" },
  { titulo: "Contabilidade Consultiva", alunos: 655, conclusao: 49, nota: 4.6, cor: "#00204D" },
  { titulo: "eSocial e EFD-Reinf na Prática", alunos: 612, conclusao: 58, nota: 4.7, cor: "#B88A45" },
  { titulo: "Comércio Exterior e Rotina Aduaneira", alunos: 531, conclusao: 63, nota: 4.9, cor: "#2F6E75" },
  { titulo: "Contabilidade Gerencial e Controladoria", alunos: 437, conclusao: 57, nota: 4.7, cor: "#1F4A7A" },
];

/** Acessos por mês — é o número que o painel mostra. */
const FERRAMENTAS_DEMO = [
  { slug: "salario-liquido", mes: 614 },
  { slug: "rescisao", mes: 465 },
  { slug: "simples-nacional", mes: 376 },
  { slug: "custo-por-km", mes: 288 },
  { slug: "fator-r", mes: 235 },
  { slug: "custo-importacao", mes: 171 },
  { slug: "reforma-tributaria", mes: 149 },
];

function somar(v: number[]): number {
  return v.reduce((a, b) => a + b, 0);
}

function totaisDe(s: Serie): Record<ChaveMetrica, number> {
  return {
    matriculas: somar(s.valores.matriculas),
    // Receita é estoque, não fluxo: o total do recorte é o último valor.
    receita: s.valores.receita.at(-1) ?? 0,
    certificados: somar(s.valores.certificados),
    cadastros: somar(s.valores.cadastros),
    candidaturas: somar(s.valores.candidaturas),
  };
}

function metricasDemo(ano: number, periodo: Periodo, mes: number, anoAtual: number): Metricas {
  const j = janela(periodo, ano, mes);
  const serie = serieDemo(j, anoAtual);
  const anterior = serieDemo(umAnoAntes(j), anoAtual);

  const totais = totaisDe(serie);
  const cadastros = totais.cadastros;
  const assinantes = Math.round(cadastros * 0.4);

  return {
    modo: "demo",
    ano,
    periodo,
    anosDisponiveis: anosDe(anoAtual - 4, anoAtual),
    rotuloJanela: j.rotulo,
    receita: { valor: totais.receita, origem: "estimado", nota: "Base de assinantes × preço do plano" },
    vagas: { valor: 5, origem: "medido" },
    totais,
    totaisAnterior: totaisDe(anterior),
    serie,
    funil: [
      { rotulo: "Visitantes", valor: cadastros * VISITAS_POR_CADASTRO, nota: "Chegaram à landing" },
      { rotulo: "Cadastros", valor: cadastros, nota: "Criaram conta" },
      { rotulo: "Ativaram", valor: Math.round(cadastros * 0.63), nota: "Assistiram a primeira aula" },
      { rotulo: "Assinantes Pro", valor: assinantes, nota: "Converteram para plano pago" },
      { rotulo: "Concluíram trilha", valor: Math.round(cadastros * 0.156), nota: "Receberam o selo" },
    ],
    planos: [
      { rotulo: "Free", valor: Math.round(cadastros * 0.52) },
      { rotulo: "Pro", valor: assinantes },
      { rotulo: "Empresarial", valor: Math.round(cadastros * 0.08) },
    ],
    ferramentas: FERRAMENTAS_DEMO.map((f) => ({
      rotulo: nomeDaFerramenta(f.slug),
      valor: f.mes,
      detalhe: "acessos por mês",
    })),
    cursos: CURSOS_DEMO,
    saude: [
      { rotulo: "Aulas com vídeo", valor: "73 de 73", estado: "ok", detalhe: "Catálogo completo" },
      { rotulo: "Aulas com avaliação", valor: "58 de 73", estado: "atencao", detalhe: "15 aulas sem banco de questões" },
      { rotulo: "Dúvidas sem resposta", valor: "4", estado: "atencao", detalhe: "Fórum aberto há mais de 48h" },
      { rotulo: "Aprovação nas avaliações", valor: "78%", estado: "ok", detalhe: "Acerto na primeira tentativa" },
    ],
  };
}

function anosDe(inicio: number, fim: number): number[] {
  const lista: number[] = [];
  for (let a = fim; a >= inicio; a--) lista.push(a);
  return lista;
}

/* ======================================================================
   DADOS REAIS
   ====================================================================== */
type LinhaBalde = {
  balde: string; matriculas: number; certificados: number;
  cadastros: number; candidaturas: number;
};

async function serieReal(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  j: Janela,
  assinantesPro: number
): Promise<Serie> {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data, error } = await sb.rpc("metricas_periodo", {
    p_inicio: iso(j.inicio),
    p_fim: iso(j.fim),
    p_gran: j.gran,
  });
  if (error) throw error;

  const linhas = (data ?? []) as LinhaBalde[];
  const matriculas = linhas.map((l) => Number(l.matriculas));

  // Receita: sem cobrança implantada, o proxy honesto é a base Pro distribuída
  // pelo acumulado de matrículas do recorte.
  const total = somar(matriculas) || 1;
  let acumulado = 0;
  const receita = matriculas.map((m) => {
    acumulado += m;
    return Math.round((acumulado / total) * assinantesPro * PRECO_PRO);
  });

  return {
    rotulos: linhas.map((l) => rotularBalde(String(l.balde), j.gran)),
    gran: j.gran,
    valores: {
      matriculas,
      receita,
      certificados: linhas.map((l) => Number(l.certificados)),
      cadastros: linhas.map((l) => Number(l.cadastros)),
      candidaturas: linhas.map((l) => Number(l.candidaturas)),
    },
  };
}

async function metricasReais(
  ano: number, periodo: Periodo, mes: number, anoAtual: number
): Promise<Metricas> {
  const sb = getSupabase();
  if (!sb) return metricasDemo(ano, periodo, mes, anoAtual);

  const { data: resumoBruto, error } = await sb.rpc("metricas_resumo");
  if (error) throw error;

  const r = (resumoBruto ?? {}) as Record<string, number | Record<string, number>>;
  const n = (k: string) => Number(r[k] ?? 0);
  const planosMap = (r.planos ?? {}) as Record<string, number>;
  const assinantesPro = Number(planosMap.Pro ?? 0);
  const empresarial = Number(planosMap.Enterprise ?? 0);

  const j = janela(periodo, ano, mes);

  const [serie, anterior, ferramentasBrutas, cursosBrutos, anoInicial] = await Promise.all([
    serieReal(sb, j, assinantesPro),
    serieReal(sb, umAnoAntes(j), assinantesPro),
    sb.rpc("metricas_ferramentas", { p_dias: 90 }),
    sb.rpc("metricas_cursos"),
    sb.rpc("metricas_ano_inicial"),
  ]);

  const totais = totaisDe(serie);
  const cadastros = n("perfis");
  const matriculas = n("matriculas");

  const ferramentas = ((ferramentasBrutas.data ?? []) as Array<{ slug: string; usos: number }>)
    .map((f) => ({
      rotulo: nomeDaFerramenta(f.slug),
      // A RPC devolve 90 dias; o painel mostra a média mensal.
      valor: Math.max(1, Math.round(Number(f.usos) / 3)),
      detalhe: "acessos por mês",
    }));

  // `alunos` vem de `matriculados`, não da coluna `cursos.alunos` — aquela é
  // número do seed e ficaria ao lado de uma conclusão calculada sobre a base
  // real, dando uma linha que se contradiz (2.103 alunos, 100% de conclusão).
  type LinhaCurso = {
    titulo: string; alunos: number; nota: number; cor: string;
    conclusao: number; matriculados: number;
  };
  const cursos = ((cursosBrutos.data ?? []) as LinhaCurso[]).map((c) => ({
    titulo: c.titulo,
    alunos: Number(c.matriculados),
    conclusao: Number(c.conclusao),
    nota: Number(c.nota),
    cor: c.cor,
  }));

  const aulas = n("aulas");
  const comVideo = n("aulas_com_video");
  const semResposta = n("duvidas_sem_resposta");
  const primeiro = Number(anoInicial.data ?? anoAtual);

  return {
    modo: "real",
    ano,
    periodo,
    anosDisponiveis: anosDe(Math.min(primeiro, anoAtual - 4), anoAtual),
    rotuloJanela: j.rotulo,
    receita: {
      valor: assinantesPro * PRECO_PRO + empresarial * PRECO_EMPRESARIAL,
      origem: "estimado",
      nota: `${assinantesPro} Pro × ${PRECO_PRO} + ${empresarial} Empresarial × ${PRECO_EMPRESARIAL}. Vira medido quando a cobrança existir.`,
    },
    vagas: { valor: n("vagas"), origem: "medido" },
    totais,
    totaisAnterior: totaisDe(anterior),
    serie,
    funil: [
      {
        rotulo: "Visitantes", valor: cadastros * VISITAS_POR_CADASTRO,
        nota: `Estimado em ${VISITAS_POR_CADASTRO}× os cadastros`,
      },
      { rotulo: "Cadastros", valor: cadastros, nota: "Perfis criados" },
      { rotulo: "Ativaram", valor: matriculas, nota: "Matricularam-se em um curso" },
      { rotulo: "Assinantes Pro", valor: assinantesPro + empresarial, nota: "Plano pago no perfil" },
      { rotulo: "Concluíram trilha", valor: n("selos_trilha"), nota: "Selo de carreira emitido" },
    ],
    planos: Object.entries(planosMap).map(([k, v]) => ({
      rotulo: k === "Enterprise" ? "Empresarial" : k,
      valor: Number(v),
    })),
    ferramentas,
    cursos,
    saude: [
      {
        rotulo: "Aulas com vídeo",
        valor: `${comVideo} de ${aulas}`,
        estado: comVideo === aulas ? "ok" : comVideo === 0 ? "critico" : "atencao",
        detalhe: comVideo === 0
          ? "Nenhuma aula tem vídeo — publique ao menos as do curso carro-chefe"
          : `${aulas - comVideo} aulas ainda sem vídeo`,
      },
      {
        rotulo: "Avaliações respondidas",
        valor: `${n("tentativas")} ${n("tentativas") === 1 ? "tentativa" : "tentativas"}`,
        estado: n("tentativas") > 0 ? "ok" : "atencao",
        detalhe: n("tentativas") > 0
          ? `${n("aprovacao_quiz")}% de aprovação`
          : "Nenhum aluno fez avaliação ainda",
      },
      {
        rotulo: "Dúvidas sem resposta",
        valor: String(semResposta),
        estado: semResposta === 0 ? "ok" : semResposta > 5 ? "critico" : "atencao",
        detalhe: semResposta === 0
          ? "Fórum em dia"
          : "Pergunta sem resposta é o que mais faz aluno abandonar",
      },
      {
        rotulo: "Cursos em rascunho",
        valor: String(n("cursos_rascunho")),
        estado: n("cursos_rascunho") === 0 ? "ok" : "atencao",
        detalhe: n("cursos_rascunho") === 0 ? "Tudo publicado" : "Aguardando publicação",
      },
    ],
  };
}

/* ======================================================================
   Porta de entrada
   ====================================================================== */
export async function carregarMetricas(opcoes: {
  ano: number;
  periodo: Periodo;
  mes: number;
  modo: ModoMetricas;
}): Promise<Metricas> {
  const { ano, periodo, mes, modo } = opcoes;
  const anoAtual = new Date().getFullYear();
  if (modo === "demo") return metricasDemo(ano, periodo, mes, anoAtual);

  try {
    return await metricasReais(ano, periodo, mes, anoAtual);
  } catch (e) {
    const msg = msgErro(e);
    console.error("[metricas] falha ao ler do banco:", msg);
    return { ...metricasDemo(ano, periodo, mes, anoAtual), erro: msg };
  }
}

/** Variação percentual, protegida contra divisão por zero. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}
