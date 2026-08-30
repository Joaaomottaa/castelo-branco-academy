import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type {
  Caderno, QuestaoBanco, QuestaoParaRevisar, RespostaRegistrada, RespostaSimulado,
  ResultadoSimulado,
} from "./types";

/* ==========================================================================
   BANCO DE QUESTÕES, CADERNOS E SIMULADOS
   ========================================================================== */

export interface FiltroQuestoes {
  area?: string;
  assunto?: string;
  nivel?: string;
  busca?: string;
  cadernoId?: string;
}

type LQuestao = {
  id: string; enunciado: string; alternativas: unknown; correta: string;
  explicacao: string | null; area: string; assunto: string; nivel: string;
  banca: string | null; ano: number | null; tags: string[] | null;
};

function mapQuestao(r: LQuestao): QuestaoBanco {
  return {
    id: r.id,
    enunciado: r.enunciado,
    alternativas: Array.isArray(r.alternativas)
      ? (r.alternativas as QuestaoBanco["alternativas"])
      : [],
    correta: r.correta,
    explicacao: r.explicacao ?? undefined,
    area: r.area,
    assunto: r.assunto,
    nivel: r.nivel,
    banca: r.banca ?? undefined,
    ano: r.ano ?? undefined,
    tags: r.tags ?? [],
  };
}

export async function carregarQuestoes(): Promise<QuestaoBanco[]> {
  const sb = getSupabase();
  if (!sb) return questoesDemo;

  const { data, error } = await sb
    .from("questoes_banco")
    .select("id, enunciado, alternativas, correta, explicacao, area, assunto, nivel, banca, ano, tags")
    .eq("ativa", true)
    .order("area");

  if (error) {
    console.error("[questoes] falha:", msgErro(error));
    return questoesDemo;
  }
  return ((data ?? []) as unknown as LQuestao[]).map(mapQuestao);
}

export async function registrarResposta(
  perfilId: string,
  questaoId: string,
  alternativa: string,
  correta: boolean,
  segundos?: number
) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("respostas_questoes").insert({
    perfil_id: perfilId,
    questao_id: questaoId,
    alternativa,
    correta,
    segundos: segundos ?? null,
  });
  if (error) console.error("[questoes] resposta:", msgErro(error));
}

/** Quantas questões a pessoa já respondeu hoje — base do limite do plano Free. */
export async function respostasDeHoje(perfilId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from("respostas_questoes")
    .select("*", { head: true, count: "exact" })
    .eq("perfil_id", perfilId)
    .gte("criado_em", inicio.toISOString());

  return count ?? 0;
}

/* -------------------------------------------------------------- cadernos -- */
export async function carregarCadernos(perfilId: string): Promise<Caderno[]> {
  const sb = getSupabase();
  if (!sb) return cadernosDemo;

  const { data, error } = await sb
    .from("cadernos")
    .select("id, nome, descricao, cor, criado_em, caderno_questoes ( questao_id )")
    .eq("perfil_id", perfilId)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[cadernos] falha:", msgErro(error));
    return [];
  }

  type L = {
    id: string; nome: string; descricao: string | null; cor: string;
    criado_em: string; caderno_questoes: Array<{ questao_id: string }>;
  };

  return ((data ?? []) as unknown as L[]).map((c) => ({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao ?? undefined,
    cor: c.cor,
    total: (c.caderno_questoes ?? []).length,
    criadoEm: c.criado_em,
  }));
}

export async function criarCaderno(perfilId: string, nome: string, cor = "#00204D") {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("cadernos")
    .insert({ perfil_id: perfilId, nome, cor })
    .select("id")
    .single();
  if (error) {
    console.error("[cadernos] criar:", msgErro(error));
    return null;
  }
  return (data as { id: string }).id;
}

export async function adicionarAoCaderno(cadernoId: string, questaoId: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("caderno_questoes")
    .upsert({ caderno_id: cadernoId, questao_id: questaoId }, { onConflict: "caderno_id,questao_id" });
}

export async function questoesDoCaderno(cadernoId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("caderno_questoes")
    .select("questao_id")
    .eq("caderno_id", cadernoId);
  return ((data ?? []) as Array<{ questao_id: string }>).map((q) => q.questao_id);
}

/* ------------------------------------------------------------- simulados -- */
/**
 * Grava o simulado com as respostas questão a questão.
 *
 * Antes só o placar era salvo, e o histórico respondia "como fui" sem nunca
 * responder "onde errei" — que é a pergunta que faz o aluno voltar.
 */
export async function salvarSimulado(
  perfilId: string,
  nome: string,
  total: number,
  acertos: number,
  filtros: FiltroQuestoes,
  respostas: RespostaSimulado[] = []
): Promise<{ id?: string; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: "Conecte o Supabase para guardar o simulado." };

  const nota = total > 0 ? Number(((acertos / total) * 100).toFixed(2)) : 0;
  const { data, error } = await sb
    .from("simulados")
    .insert({
      perfil_id: perfilId,
      nome,
      filtros,
      total,
      acertos,
      nota,
      respostas,
      finalizado_em: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[simulados] salvar:", msgErro(error));
    return { erro: msgErro(error) };
  }
  return { id: (data as { id: string }).id };
}

/** Guarda a análise do Tino: ela é cara de gerar e o simulado não muda mais. */
export async function salvarFeedbackSimulado(id: string, texto: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("simulados")
    .update({ feedback: texto, feedback_em: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[simulados] feedback:", msgErro(error));
}

export async function apagarSimulado(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("simulados").delete().eq("id", id);
}

export async function carregarSimulados(
  perfilId: string,
  limite = 50
): Promise<ResultadoSimulado[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("simulados")
    .select("id, nome, total, acertos, nota, finalizado_em, respostas, feedback, feedback_em")
    .eq("perfil_id", perfilId)
    .not("finalizado_em", "is", null)
    .order("finalizado_em", { ascending: false })
    .limit(limite);

  type L = {
    id: string; nome: string; total: number; acertos: number; nota: number | null;
    finalizado_em: string | null; respostas: unknown; feedback: string | null;
    feedback_em: string | null;
  };

  return ((data ?? []) as unknown as L[]).map((s) => ({
    id: s.id,
    nome: s.nome,
    total: s.total,
    acertos: s.acertos,
    nota: Number(s.nota ?? 0),
    finalizadoEm: s.finalizado_em ?? undefined,
    respostas: Array.isArray(s.respostas) ? (s.respostas as RespostaSimulado[]) : [],
    feedback: s.feedback ?? undefined,
    feedbackEm: s.feedback_em ?? undefined,
  }));
}

/* ------------------------------------------------------------ seed local -- */
export const questoesDemo: QuestaoBanco[] = [
  {
    id: "q1",
    enunciado:
      "A Emenda Constitucional 132/2023 substitui cinco tributos sobre consumo. Qual conjunto é extinto para dar lugar a CBS e IBS?",
    alternativas: [
      { id: "a", texto: "PIS, COFINS, IPI, ICMS e ISS" },
      { id: "b", texto: "IRPJ, CSLL, PIS, COFINS e ISS" },
      { id: "c", texto: "ICMS, ISS, IOF, IPI e CIDE" },
      { id: "d", texto: "PIS, COFINS, ICMS, ITBI e ISS" },
    ],
    correta: "a",
    explicacao:
      "CBS substitui PIS e COFINS (federais). IBS substitui ICMS (estadual) e ISS (municipal). O IPI é praticamente zerado e cede espaço ao Imposto Seletivo. IRPJ e CSLL incidem sobre renda e ficam fora da reforma.",
    area: "Tributário", assunto: "Reforma Tributária", nivel: "Iniciante",
    banca: "Autoral", ano: 2026, tags: ["CBS", "IBS", "EC 132"],
  },
  {
    id: "q2",
    enunciado: "No modelo da CBS/IBS, o direito ao crédito do adquirente fica condicionado a:",
    alternativas: [
      { id: "a", texto: "Apenas à emissão do documento fiscal" },
      { id: "b", texto: "Ao efetivo recolhimento do tributo pelo fornecedor" },
      { id: "c", texto: "À classificação do bem como insumo essencial" },
      { id: "d", texto: "Ao regime tributário do adquirente" },
    ],
    correta: "b",
    explicacao:
      "É a mudança de lógica mais relevante: sai a não cumulatividade escritural e entra o crédito financeiro atrelado ao pagamento — base do split payment.",
    area: "Tributário", assunto: "Reforma Tributária", nivel: "Intermediário",
    banca: "Autoral", ano: 2026, tags: ["Crédito", "Split payment"],
  },
  {
    id: "q3",
    enunciado: "O Fator R do Simples Nacional determina:",
    alternativas: [
      { id: "a", texto: "O limite de faturamento do regime" },
      { id: "b", texto: "Se a empresa é tributada pelo Anexo III ou pelo Anexo V" },
      { id: "c", texto: "A alíquota do ISS" },
      { id: "d", texto: "O prazo de entrega do PGDAS" },
    ],
    correta: "b",
    explicacao:
      "Fator R = folha dos últimos 12 meses ÷ receita bruta dos últimos 12 meses. Igual ou acima de 28%, Anexo III. Abaixo, Anexo V.",
    area: "Fiscal", assunto: "Simples Nacional", nivel: "Intermediário",
    banca: "Autoral", ano: 2026, tags: ["Simples Nacional", "Fator R"],
  },
  {
    id: "q4",
    enunciado: "O CT-e é o documento fiscal que ampara:",
    alternativas: [
      { id: "a", texto: "A circulação de mercadoria própria" },
      { id: "b", texto: "A prestação de serviço de transporte de cargas" },
      { id: "c", texto: "A prestação de serviço de comunicação" },
      { id: "d", texto: "A importação de bens" },
    ],
    correta: "b",
    explicacao:
      "Conhecimento de Transporte Eletrônico. Quem move carga de terceiro emite CT-e; quem move mercadoria própria emite NF-e.",
    area: "Fiscal", assunto: "Transporte", nivel: "Iniciante",
    banca: "Autoral", ano: 2026, tags: ["CT-e"],
  },
  {
    id: "q5",
    enunciado: "A NCM utilizada na classificação fiscal de mercadorias tem quantos dígitos?",
    alternativas: [
      { id: "a", texto: "6" }, { id: "b", texto: "8" },
      { id: "c", texto: "10" }, { id: "d", texto: "4" },
    ],
    correta: "b",
    explicacao:
      "Oito dígitos: seis do Sistema Harmonizado internacional e dois do desdobramento do Mercosul. Classificação errada muda alíquota e pode gerar multa de 1% sobre o valor aduaneiro.",
    area: "Comex", assunto: "Classificação Fiscal", nivel: "Iniciante",
    banca: "Autoral", ano: 2026, tags: ["NCM"],
  },
  {
    id: "q6",
    enunciado:
      "O prazo para pagamento das verbas rescisórias, na dispensa sem justa causa com aviso prévio indenizado, é de:",
    alternativas: [
      { id: "a", texto: "10 dias corridos a contar do término do contrato" },
      { id: "b", texto: "30 dias" },
      { id: "c", texto: "O primeiro dia útil seguinte" },
      { id: "d", texto: "48 horas" },
    ],
    correta: "a",
    explicacao:
      "Art. 477 da CLT: dez dias corridos do término do contrato, independentemente da modalidade de aviso. Atraso gera multa de um salário.",
    area: "Pessoal", assunto: "Rescisão", nivel: "Intermediário",
    banca: "Autoral", ano: 2026, tags: ["CLT", "Rescisão"],
  },
  {
    id: "q7",
    enunciado: "A margem de contribuição é obtida por:",
    alternativas: [
      { id: "a", texto: "Receita menos custos e despesas fixas" },
      { id: "b", texto: "Receita menos custos e despesas variáveis" },
      { id: "c", texto: "Lucro líquido dividido pela receita" },
      { id: "d", texto: "Receita menos impostos" },
    ],
    correta: "b",
    explicacao:
      "Margem de contribuição = receita − custos e despesas variáveis. É quanto sobra de cada venda para cobrir a estrutura fixa e gerar lucro.",
    area: "Gestão", assunto: "Custos", nivel: "Intermediário",
    banca: "Autoral", ano: 2026, tags: ["Margem", "Custos"],
  },
  {
    id: "q8",
    enunciado: "Pelo regime de competência, a receita deve ser reconhecida:",
    alternativas: [
      { id: "a", texto: "No recebimento do dinheiro" },
      { id: "b", texto: "Quando o serviço é prestado ou o bem entregue, independentemente do pagamento" },
      { id: "c", texto: "Na emissão do boleto" },
      { id: "d", texto: "No encerramento do exercício" },
    ],
    correta: "b",
    explicacao:
      "Competência olha o fato gerador econômico, não o caixa. É a razão de existir diferença entre lucro e saldo bancário.",
    area: "Contábil", assunto: "Princípios", nivel: "Iniciante",
    banca: "CFC", ano: 2026, tags: ["Competência"],
  },
];

const cadernosDemo: Caderno[] = [
  { id: "cd1", nome: "Revisar antes da prova", cor: "#B88A45", total: 3, criadoEm: new Date().toISOString() },
  { id: "cd2", nome: "Reforma Tributária", cor: "#00204D", total: 2, criadoEm: new Date().toISOString() },
];

/* ==========================================================================
   ADMINISTRAÇÃO DO BANCO DE QUESTÕES

   A policy "questoes: admin escreve" já existia desde o schema inicial; o que
   faltava era a tela. Sem ela, corrigir um gabarito errado exigia abrir o
   Supabase — e gabarito errado é o tipo de defeito que o aluno descobre no
   pior momento possível.
   ========================================================================== */

/** Lista para o admin: inclui as inativas e o gabarito. */
export async function listarQuestoesAdmin(): Promise<QuestaoBanco[]> {
  const sb = getSupabase();
  if (!sb) return questoesDemo;

  const { data, error } = await sb
    .from("questoes_banco")
    .select(
      `id, enunciado, alternativas, correta, explicacao, area, assunto, nivel,
       banca, ano, tags, origem, prova, ativa, atualizado_em`
    )
    .order("atualizado_em", { ascending: false });

  if (error) {
    console.error("[questoes] admin:", msgErro(error));
    return [];
  }

  type L = LQuestao & {
    origem: string | null; prova: string | null; ativa: boolean;
    atualizado_em: string | null;
  };

  return ((data ?? []) as unknown as L[]).map((r) => ({
    ...mapQuestao(r),
    origem: (r.origem ?? "manual") as QuestaoBanco["origem"],
    prova: r.prova ?? undefined,
    ativa: r.ativa,
    atualizadoEm: r.atualizado_em ?? undefined,
  }));
}

export interface EntradaQuestao {
  id?: string;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  explicacao?: string;
  area: string;
  assunto: string;
  nivel: string;
  banca?: string;
  ano?: number;
  prova?: string;
  origem?: "manual" | "ia" | "prova";
  tags?: string[];
  ativa?: boolean;
}

/** Validação que vale para o formulário e para a importação em lote. */
export function validarQuestao(q: EntradaQuestao): string | null {
  if (!q.enunciado.trim()) return "Escreva o enunciado.";
  const preenchidas = q.alternativas.filter((a) => a.texto.trim());
  if (preenchidas.length < 2) return "A questão precisa de pelo menos duas alternativas.";
  if (!q.correta) return "Marque qual alternativa é a correta.";
  if (!q.alternativas.some((a) => a.id === q.correta && a.texto.trim())) {
    return "A alternativa marcada como correta está vazia.";
  }
  if (!q.area.trim()) return "Informe a área.";
  if (!q.assunto.trim()) return "Informe o assunto.";
  return null;
}

export async function salvarQuestao(
  q: EntradaQuestao
): Promise<{ id?: string; erro?: string }> {
  const erro = validarQuestao(q);
  if (erro) return { erro };

  const sb = getSupabase();
  if (!sb) return { erro: "Conecte o Supabase para gravar questões." };

  const linha = {
    enunciado: q.enunciado.trim(),
    alternativas: q.alternativas.filter((a) => a.texto.trim()),
    correta: q.correta,
    explicacao: q.explicacao?.trim() || null,
    area: q.area.trim(),
    assunto: q.assunto.trim(),
    nivel: q.nivel,
    banca: q.banca?.trim() || null,
    ano: q.ano ?? null,
    prova: q.prova?.trim() || null,
    origem: q.origem ?? "manual",
    tags: q.tags ?? [],
    ativa: q.ativa ?? true,
  };

  if (q.id) {
    const { error } = await sb.from("questoes_banco").update(linha).eq("id", q.id);
    return error ? { erro: msgErro(error) } : { id: q.id };
  }

  const { data, error } = await sb
    .from("questoes_banco")
    .insert(linha)
    .select("id")
    .single();

  return error ? { erro: msgErro(error) } : { id: (data as { id: string }).id };
}

/** Grava várias de uma vez — usado ao confirmar o lote gerado por IA. */
export async function salvarQuestoesEmLote(
  lista: EntradaQuestao[]
): Promise<{ salvas: number; erro?: string }> {
  let salvas = 0;
  for (const q of lista) {
    const { erro } = await salvarQuestao(q);
    if (erro) return { salvas, erro };
    salvas += 1;
  }
  return { salvas };
}

export async function alternarQuestaoAtiva(id: string, ativa: boolean) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("questoes_banco").update({ ativa }).eq("id", id);
}

/**
 * Apagar de verdade só quando ninguém respondeu.
 *
 * `respostas_questoes` referencia a questão; apagar com histórico levaria
 * junto o desempenho de quem respondeu. Nesse caso a questão é apenas
 * desativada — some do estudo e mantém a estatística de pé.
 */
export async function apagarQuestao(
  id: string
): Promise<{ apagada: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { apagada: false, erro: "Conecte o Supabase." };

  const { count } = await sb
    .from("respostas_questoes")
    .select("*", { head: true, count: "exact" })
    .eq("questao_id", id);

  if ((count ?? 0) > 0) {
    await alternarQuestaoAtiva(id, false);
    return { apagada: false };
  }

  await sb.from("caderno_questoes").delete().eq("questao_id", id);
  const { error } = await sb.from("questoes_banco").delete().eq("id", id);
  return error ? { apagada: false, erro: msgErro(error) } : { apagada: true };
}

/* ==========================================================================
   DESEMPENHO DO ALUNO

   Lido direto de `respostas_questoes` com a questão embutida: a policy
   "respostas: próprias" garante que só volta o que é da pessoa, então não
   existe caminho para ver o desempenho de outra.
   ========================================================================== */
export async function minhasRespostas(
  perfilId: string,
  limite = 2000
): Promise<RespostaRegistrada[]> {
  const sb = getSupabase();
  if (!sb) return respostasDemo();

  const { data, error } = await sb
    .from("respostas_questoes")
    .select(
      `id, questao_id, alternativa, correta, segundos, criado_em,
       questoes_banco ( area, assunto, nivel )`
    )
    .eq("perfil_id", perfilId)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("[questoes] desempenho:", msgErro(error));
    return [];
  }

  type L = {
    id: string; questao_id: string; alternativa: string; correta: boolean;
    segundos: number | null; criado_em: string;
    questoes_banco: { area: string; assunto: string; nivel: string } | null;
  };

  return ((data ?? []) as unknown as L[]).map((r) => ({
    id: r.id,
    questaoId: r.questao_id,
    alternativa: r.alternativa,
    correta: r.correta,
    segundos: r.segundos ?? undefined,
    criadoEm: r.criado_em,
    area: r.questoes_banco?.area ?? "Sem área",
    assunto: r.questoes_banco?.assunto ?? "Sem assunto",
    nivel: r.questoes_banco?.nivel ?? "Iniciante",
  }));
}

/** Histórico sintético para a demonstração — 60 dias de estudo plausível. */
function respostasDemo(): RespostaRegistrada[] {
  const areas: Array<[string, string, string]> = [
    ["Tributário", "Reforma Tributária", "Intermediário"],
    ["Tributário", "Recuperação de Créditos", "Avançado"],
    ["Fiscal", "Simples Nacional", "Iniciante"],
    ["Fiscal", "SPED", "Intermediário"],
    ["Fiscal", "Transporte", "Iniciante"],
    ["Pessoal", "Rescisão", "Intermediário"],
    ["Comex", "Classificação Fiscal", "Iniciante"],
    ["Gestão", "Custos", "Intermediário"],
  ];

  const saida: RespostaRegistrada[] = [];
  let semente = 7;
  const proximo = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };

  for (let dia = 59; dia >= 0; dia--) {
    const quantas = Math.floor(proximo() * 7);
    for (let i = 0; i < quantas; i++) {
      const [area, assunto, nivel] = areas[Math.floor(proximo() * areas.length)];
      const facil = nivel === "Iniciante" ? 0.82 : nivel === "Intermediário" ? 0.68 : 0.54;
      const d = new Date();
      d.setDate(d.getDate() - dia);
      d.setHours(9 + Math.floor(proximo() * 10), 0, 0, 0);
      saida.push({
        id: `d-${dia}-${i}`,
        questaoId: `q-${Math.floor(proximo() * 30)}`,
        alternativa: "a",
        correta: proximo() < facil,
        segundos: 30 + Math.floor(proximo() * 90),
        criadoEm: d.toISOString(),
        area, assunto, nivel,
      });
    }
  }
  return saida.reverse();
}

/**
 * Quantas vezes cada questão foi respondida e quanto se acerta nela.
 *
 * É o sinal mais barato de gabarito errado: quando quase todo mundo erra uma
 * questão isolada, normalmente o problema é a questão, não a turma.
 */
export async function estatisticasPorQuestao(): Promise<
  Map<string, { respostas: number; acertos: number }>
> {
  const mapa = new Map<string, { respostas: number; acertos: number }>();
  const sb = getSupabase();
  if (!sb) return mapa;

  const { data, error } = await sb
    .from("respostas_questoes")
    .select("questao_id, correta")
    .limit(20000);

  if (error) {
    console.error("[questoes] estatísticas:", msgErro(error));
    return mapa;
  }

  for (const r of (data ?? []) as Array<{ questao_id: string; correta: boolean }>) {
    const atual = mapa.get(r.questao_id) ?? { respostas: 0, acertos: 0 };
    atual.respostas += 1;
    if (r.correta) atual.acertos += 1;
    mapa.set(r.questao_id, atual);
  }
  return mapa;
}

/* ==========================================================================
   A QUESTÃO COMO LUGAR — estatística, aulas, comentários, anotação e erro

   Responder e seguir é o que a plataforma fazia. O que fixa conteúdo é o que
   vem depois: ver que a maioria caiu na mesma alternativa que você, ler o que
   um colega escreveu, anotar a regra que confundiu e avisar quando o gabarito
   está errado.
   ========================================================================== */

export interface TentativaMinha {
  alternativa: string;
  correta: boolean;
  em: string;
}

export interface EstatisticaQuestao {
  respostas: number;
  acertos: number;
  pct: number | null;
  distribuicao: Array<{ alternativa: string; total: number; pct: number }>;
  /** Todas as minhas tentativas, da mais recente para a mais antiga. */
  minhas: TentativaMinha[];
  minha: TentativaMinha | null;
}

export async function estatisticasQuestao(
  questaoId: string
): Promise<EstatisticaQuestao | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc("estatisticas_questao", { p_questao: questaoId });
  if (error) {
    console.error("[questoes] estatística:", msgErro(error));
    return null;
  }
  const d = data as EstatisticaQuestao;
  return { ...d, minhas: Array.isArray(d.minhas) ? d.minhas : [] };
}

/* ------------------------------------------------ meu histórico geral ---- */
export interface SituacaoQuestao {
  /** Quantas vezes respondi. */
  tentativas: number;
  /** Acertei na última vez? É o que define "ainda erro isso". */
  ultimaCorreta: boolean;
  /** Já acertei alguma vez. */
  jaAcertei: boolean;
}

/**
 * Mapa questão → como eu fui nela.
 *
 * É o que permite filtrar "não respondidas" e "que eu errei". Sem isso o aluno
 * refazia a mesma questão que já sabe enquanto a que ele erra continuava
 * escondida no meio da lista.
 */
export async function meuHistoricoQuestoes(
  perfilId: string
): Promise<Map<string, SituacaoQuestao>> {
  const mapa = new Map<string, SituacaoQuestao>();
  const sb = getSupabase();
  if (!sb) return mapa;

  const { data, error } = await sb
    .from("respostas_questoes")
    .select("questao_id, correta, criado_em")
    .eq("perfil_id", perfilId)
    .order("criado_em", { ascending: true })
    .limit(5000);

  if (error) {
    console.error("[questoes] histórico:", msgErro(error));
    return mapa;
  }

  // Em ordem crescente, a última linha lida de cada questão é a mais recente.
  for (const r of (data ?? []) as Array<{ questao_id: string; correta: boolean }>) {
    const atual = mapa.get(r.questao_id) ?? {
      tentativas: 0,
      ultimaCorreta: false,
      jaAcertei: false,
    };
    atual.tentativas += 1;
    atual.ultimaCorreta = r.correta;
    atual.jaAcertei = atual.jaAcertei || r.correta;
    mapa.set(r.questao_id, atual);
  }
  return mapa;
}

/* -------------------------------------------- cadernos de uma questão ---- */
/** Em quais cadernos meus esta questão já está. */
export async function cadernosDaQuestao(
  perfilId: string,
  questaoId: string
): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("caderno_questoes")
    .select("caderno_id, cadernos!inner(perfil_id)")
    .eq("questao_id", questaoId)
    .eq("cadernos.perfil_id", perfilId);

  if (error) {
    console.error("[cadernos] da questão:", msgErro(error));
    return [];
  }
  return ((data ?? []) as Array<{ caderno_id: string }>).map((c) => c.caderno_id);
}

export async function removerDoCaderno(cadernoId: string, questaoId: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("caderno_questoes")
    .delete()
    .eq("caderno_id", cadernoId)
    .eq("questao_id", questaoId);
}

export interface AulaDaQuestao {
  aulaId: string;
  aulaTitulo: string;
  duracaoMin: number;
  modulo: string;
  cursoSlug: string;
  cursoTitulo: string;
  cursoCor: string;
  habilidade?: string;
  origem: "vinculo" | "selo" | "assunto" | "area";
}

/** As aulas que explicam a questão — ver `aulas_da_questao` no banco. */
export async function aulasDaQuestao(questaoId: string): Promise<AulaDaQuestao[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc("aulas_da_questao", { p_questao: questaoId });
  if (error) {
    console.error("[questoes] aulas:", msgErro(error));
    return [];
  }

  type L = {
    aula_id: string; aula_titulo: string; duracao_min: number; modulo: string;
    curso_slug: string; curso_titulo: string; curso_cor: string;
    habilidade: string | null; origem: string;
  };

  return ((data ?? []) as L[]).map((r) => ({
    aulaId: r.aula_id,
    aulaTitulo: r.aula_titulo,
    duracaoMin: r.duracao_min,
    modulo: r.modulo,
    cursoSlug: r.curso_slug,
    cursoTitulo: r.curso_titulo,
    cursoCor: r.curso_cor,
    habilidade: r.habilidade ?? undefined,
    origem: r.origem as AulaDaQuestao["origem"],
  }));
}

/* ------------------------------------------------------- comentários ----- */
export interface ComentarioQuestao {
  id: string;
  perfilId: string;
  autorNome: string;
  autorCargo?: string;
  conteudo: string;
  criadoEm: string;
  curtidas: number;
  curti: boolean;
  meu: boolean;
}

export async function comentariosDaQuestao(
  questaoId: string
): Promise<ComentarioQuestao[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id ?? "";

  const { data, error } = await sb
    .from("questao_comentarios")
    .select(
      "id, perfil_id, autor_nome, autor_cargo, conteudo, criado_em, questao_comentario_curtidas(count)"
    )
    .eq("questao_id", questaoId)
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[questoes] comentários:", msgErro(error));
    return [];
  }

  type L = {
    id: string; perfil_id: string; autor_nome: string; autor_cargo: string | null;
    conteudo: string; criado_em: string;
    questao_comentario_curtidas: Array<{ count: number }>;
  };
  const linhas = (data ?? []) as unknown as L[];

  // As minhas curtidas vêm numa consulta separada: filtrar o embed por
  // perfil_id derrubaria os comentários que ninguém curtiu.
  const meusIds = new Set<string>();
  if (uid && linhas.length) {
    const { data: curtidas } = await sb
      .from("questao_comentario_curtidas")
      .select("comentario_id")
      .eq("perfil_id", uid)
      .in("comentario_id", linhas.map((l) => l.id));
    for (const c of (curtidas ?? []) as Array<{ comentario_id: string }>) {
      meusIds.add(c.comentario_id);
    }
  }

  return linhas.map((l) => ({
    id: l.id,
    perfilId: l.perfil_id,
    autorNome: l.autor_nome || "Aluno",
    autorCargo: l.autor_cargo ?? undefined,
    conteudo: l.conteudo,
    criadoEm: l.criado_em,
    curtidas: l.questao_comentario_curtidas?.[0]?.count ?? 0,
    curti: meusIds.has(l.id),
    meu: l.perfil_id === uid,
  }));
}

export async function comentarQuestao(
  questaoId: string,
  conteudo: string
): Promise<{ erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: "Conecte o Supabase para comentar." };
  if (!conteudo.trim()) return { erro: "Escreva o comentário." };

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { erro: "Sessão expirada." };

  const { error } = await sb
    .from("questao_comentarios")
    .insert({ questao_id: questaoId, perfil_id: uid, conteudo: conteudo.trim() });

  return error ? { erro: msgErro(error) } : {};
}

export async function apagarComentarioQuestao(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("questao_comentarios").delete().eq("id", id);
}

export async function alternarCurtidaComentario(id: string, curtir: boolean) {
  const sb = getSupabase();
  if (!sb) return;
  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return;

  if (curtir) {
    await sb
      .from("questao_comentario_curtidas")
      .upsert({ comentario_id: id, perfil_id: uid }, { onConflict: "comentario_id,perfil_id" });
  } else {
    await sb
      .from("questao_comentario_curtidas")
      .delete()
      .eq("comentario_id", id)
      .eq("perfil_id", uid);
  }
}

/* --------------------------------------------------------- anotações ----- */
export async function minhaAnotacao(questaoId: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "";
  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return "";

  const { data } = await sb
    .from("questao_anotacoes")
    .select("texto")
    .eq("perfil_id", uid)
    .eq("questao_id", questaoId)
    .maybeSingle();

  return (data as { texto: string } | null)?.texto ?? "";
}

export async function salvarAnotacao(
  questaoId: string,
  texto: string
): Promise<{ erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: "Conecte o Supabase." };
  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { erro: "Sessão expirada." };

  if (!texto.trim()) {
    await sb
      .from("questao_anotacoes")
      .delete()
      .eq("perfil_id", uid)
      .eq("questao_id", questaoId);
    return {};
  }

  const { error } = await sb.from("questao_anotacoes").upsert(
    {
      perfil_id: uid,
      questao_id: questaoId,
      texto: texto.trim(),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "perfil_id,questao_id" }
  );

  return error ? { erro: msgErro(error) } : {};
}

/* ---------------------------------------------------------- reportes ----- */
export const MOTIVOS_REPORTE = [
  ["gabarito", "O gabarito está errado"],
  ["enunciado", "O enunciado tem erro ou está confuso"],
  ["alternativa", "Uma alternativa está errada"],
  ["explicacao", "A explicação não bate com o gabarito"],
  ["duplicada", "Questão repetida"],
  ["outro", "Outro motivo"],
] as const;

export async function reportarQuestao(
  questaoId: string,
  motivo: string,
  descricao: string
): Promise<{ erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: "Conecte o Supabase." };
  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { erro: "Sessão expirada." };

  const { error } = await sb.from("questao_reportes").insert({
    questao_id: questaoId,
    perfil_id: uid,
    motivo,
    descricao: descricao.trim() || null,
  });

  return error ? { erro: msgErro(error) } : {};
}

export interface ReporteQuestao {
  id: string;
  questaoId: string;
  motivo: string;
  descricao?: string;
  status: string;
  criadoEm: string;
  enunciado?: string;
}

/** Para o admin: quantos avisos de erro cada questão tem em aberto. */
export async function reportesAbertos(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const sb = getSupabase();
  if (!sb) return mapa;

  const { data, error } = await sb
    .from("questao_reportes")
    .select("questao_id")
    .eq("status", "aberto");

  if (error) {
    console.error("[questoes] reportes:", msgErro(error));
    return mapa;
  }
  for (const r of (data ?? []) as Array<{ questao_id: string }>) {
    mapa.set(r.questao_id, (mapa.get(r.questao_id) ?? 0) + 1);
  }
  return mapa;
}

export async function listarReportesDaQuestao(
  questaoId: string
): Promise<ReporteQuestao[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("questao_reportes")
    .select("id, questao_id, motivo, descricao, status, criado_em")
    .eq("questao_id", questaoId)
    .order("criado_em", { ascending: false });

  type L = {
    id: string; questao_id: string; motivo: string; descricao: string | null;
    status: string; criado_em: string;
  };
  return ((data ?? []) as L[]).map((r) => ({
    id: r.id,
    questaoId: r.questao_id,
    motivo: r.motivo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    criadoEm: r.criado_em,
  }));
}

export async function resolverReporte(id: string, status: "resolvido" | "descartado") {
  const sb = getSupabase();
  if (!sb) return;
  const { data: sessao } = await sb.auth.getUser();
  await sb
    .from("questao_reportes")
    .update({
      status,
      resolvido_em: new Date().toISOString(),
      resolvido_por: sessao.user?.id ?? null,
    })
    .eq("id", id);
}

/* ==========================================================================
   REVISÃO ESPAÇADA

   O intervalo cresce conforme a pessoa acerta seguidamente — 1, 3, 7, 14 e 30
   dias, as caixas de Leitner. Errar zera e a questão volta amanhã; acertar
   sempre, desde a primeira, tira a questão da fila.

   Toda a conta acontece no banco (`questoes_para_revisar`), a partir de
   `respostas_questoes`. Sem tabela de agendamento: ela seria mais um lugar
   para sair de sincronia com o histórico real.
   ========================================================================== */
export async function questoesParaRevisar(
  limite = 20
): Promise<QuestaoParaRevisar[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc("questoes_para_revisar", { p_limite: limite });
  if (error) {
    console.error("[revisao] lista:", msgErro(error));
    return [];
  }

  type L = {
    questao_id: string; enunciado: string; area: string; assunto: string;
    nivel: string; tentativas: number; acertos: number; sequencia: number;
    ultima_em: string; dias_de_atraso: number;
  };

  return ((data ?? []) as L[]).map((r) => ({
    questaoId: r.questao_id,
    enunciado: r.enunciado,
    area: r.area,
    assunto: r.assunto,
    nivel: r.nivel,
    tentativas: r.tentativas,
    acertos: r.acertos,
    sequencia: r.sequencia,
    ultimaEm: r.ultima_em,
    diasDeAtraso: r.dias_de_atraso,
  }));
}

/** Só o número, para o cartão do painel não carregar a lista inteira. */
export async function totalParaRevisar(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc("total_para_revisar");
  if (error) {
    console.error("[revisao] total:", msgErro(error));
    return 0;
  }
  return Number(data ?? 0);
}
