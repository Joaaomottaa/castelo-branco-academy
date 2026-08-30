import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { QuestaoAula, ResultadoQuiz, StatusQuiz } from "./types";

/* ==========================================================================
   AVALIAÇÃO PÓS-AULA — lado do aluno

   Tudo passa por RPC de propósito. A tabela `questoes` só é legível pelo
   admin; o aluno recebe enunciado e alternativas por `quiz_da_aula` (sem o
   gabarito) e a nota por `corrigir_quiz`, que corrige dentro do banco.

   Consequência prática: abrir a aba de rede não mostra a resposta, e o limite
   de tentativas não é contornável pelo console.
   ========================================================================== */

/* ------------------------------------------------- seed da demonstração -- */
/**
 * No modo demonstração não há banco. Estas questões existem para a
 * apresentação ao CEO não depender de conexão — o fluxo é idêntico.
 */
const QUIZ_DEMO: QuestaoAula[] = [
  {
    id: "d1",
    enunciado:
      "Na transição da Reforma Tributária, o que caracteriza o período de teste de 2026?",
    alternativas: [
      { id: "a", texto: "CBS e IBS já substituem integralmente PIS, Cofins e ICMS." },
      { id: "b", texto: "As alíquotas são simbólicas e o valor recolhido pode ser compensado." },
      { id: "c", texto: "Apenas empresas do Simples Nacional apuram os novos tributos." },
      { id: "d", texto: "A obrigação vale só para operações de comércio exterior." },
    ],
    correta: "b",
    explicacao:
      "2026 é ano de teste: 0,9% de CBS e 0,1% de IBS, com compensação contra PIS/Cofins. O objetivo é adaptar sistema e equipe antes de o tributo pesar no caixa.",
  },
  {
    id: "d2",
    enunciado: "Qual documento sustenta a apropriação de crédito no novo modelo?",
    alternativas: [
      { id: "a", texto: "O contrato assinado entre as partes." },
      { id: "b", texto: "O comprovante de pagamento ao fornecedor." },
      { id: "c", texto: "O documento fiscal eletrônico com o tributo destacado e efetivamente recolhido." },
      { id: "d", texto: "O registro contábil da despesa no período." },
    ],
    correta: "c",
    explicacao:
      "O crédito no IVA dual é financeiro e condicionado ao recolhimento na etapa anterior. Sem documento fiscal com destaque e recolhimento, não há crédito a apropriar.",
  },
  {
    id: "d3",
    enunciado: "Sobre o Imposto Seletivo, é correto afirmar que:",
    alternativas: [
      { id: "a", texto: "Incide sobre todos os produtos, com alíquota única." },
      { id: "b", texto: "Substitui o IBS nas operações interestaduais." },
      { id: "c", texto: "Incide sobre bens e serviços prejudiciais à saúde ou ao meio ambiente." },
      { id: "d", texto: "É recolhido apenas por empresas do Lucro Real." },
    ],
    correta: "c",
    explicacao:
      "O Seletivo é extrafiscal: existe para desestimular consumo específico (fumo, bebida alcoólica, entre outros), não para arrecadar de forma geral.",
  },
  {
    id: "d4",
    enunciado: "O que muda na rotina do departamento fiscal com o IVA dual?",
    alternativas: [
      { id: "a", texto: "A conferência de crédito passa a depender do recolhimento do fornecedor." },
      { id: "b", texto: "As obrigações acessórias deixam de existir." },
      { id: "c", texto: "A apuração passa a ser anual." },
      { id: "d", texto: "O regime de caixa vira obrigatório para todos." },
    ],
    correta: "a",
    explicacao:
      "É a mudança mais concreta do dia a dia: o crédito deixa de ser presumido e passa a depender do que o fornecedor efetivamente recolheu — o que muda a régua de homologação de fornecedor.",
  },
  {
    id: "d5",
    enunciado: "Qual é o principal risco de não acompanhar o cronograma de transição?",
    alternativas: [
      { id: "a", texto: "Perder o direito de emitir nota fiscal eletrônica." },
      { id: "b", texto: "Apurar em duplicidade e formar passivo oculto." },
      { id: "c", texto: "Ser excluído do Simples Nacional automaticamente." },
      { id: "d", texto: "Precisar migrar para o Lucro Presumido." },
    ],
    correta: "b",
    explicacao:
      "Durante a coexistência dos dois sistemas, erro de parametrização gera recolhimento a maior ou a menor — e o passivo só aparece na fiscalização, quando já corrigi-lo custa multa.",
  },
];

const CHAVE_DEMO = "cba.quizDemo";

type EstadoDemo = Record<string, { tentativas: number; aprovada: boolean }>;

function lerDemo(): EstadoDemo {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_DEMO) ?? "{}") as EstadoDemo;
  } catch {
    return {};
  }
}

function gravarDemo(e: EstadoDemo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_DEMO, JSON.stringify(e));
  } catch {
    /* storage indisponível */
  }
}

const PADRAO_DEMO = { qtd: 3, minimo: 2, tentativas: 2 };

/* ================================================================ status -- */
export async function statusDoQuiz(aulaId: string): Promise<StatusQuiz> {
  const sb = getSupabase();

  if (!sb) {
    const e = lerDemo()[aulaId] ?? { tentativas: 0, aprovada: false };
    return {
      ativo: true,
      questoesNoBanco: QUIZ_DEMO.length,
      qtd: PADRAO_DEMO.qtd,
      minimo: PADRAO_DEMO.minimo,
      tentativasMax: PADRAO_DEMO.tentativas,
      tentativasUsadas: e.tentativas,
      aprovada: e.aprovada,
    };
  }

  const { data, error } = await sb.rpc("quiz_status", { p_aula: aulaId });
  if (error) {
    console.error("[quiz] status:", msgErro(error));
    return {
      ativo: false, questoesNoBanco: 0, qtd: 0, minimo: 0,
      tentativasMax: 0, tentativasUsadas: 0, aprovada: false,
    };
  }

  const d = (data ?? {}) as Record<string, unknown>;
  return {
    ativo: Boolean(d.ativo),
    questoesNoBanco: Number(d.questoes_no_banco ?? 0),
    qtd: Number(d.qtd ?? 3),
    minimo: Number(d.minimo ?? 2),
    tentativasMax: Number(d.tentativas_max ?? 2),
    tentativasUsadas: Number(d.tentativas_usadas ?? 0),
    aprovada: Boolean(d.aprovada),
  };
}

/* =============================================================== sorteio -- */
export async function sortearQuestoes(aulaId: string, qtd = 3): Promise<QuestaoAula[]> {
  const sb = getSupabase();

  if (!sb) {
    return [...QUIZ_DEMO]
      .sort(() => Math.random() - 0.5)
      .slice(0, qtd)
      .map(({ correta: _correta, explicacao: _explicacao, ...q }) => q);
  }

  const { data, error } = await sb.rpc("quiz_da_aula", { p_aula: aulaId });
  if (error) {
    console.error("[quiz] sorteio:", msgErro(error));
    return [];
  }

  type Linha = { id: string; enunciado: string; alternativas: Array<{ id: string; texto: string }> };
  return ((data ?? []) as Linha[]).map((q) => ({
    id: q.id,
    enunciado: q.enunciado,
    alternativas: q.alternativas ?? [],
  }));
}

/* ============================================================== correção -- */
export async function corrigirQuiz(
  aulaId: string,
  respostas: Array<{ questaoId: string; resposta: string | null }>
): Promise<{ resultado?: ResultadoQuiz; erro?: string }> {
  const sb = getSupabase();

  if (!sb) {
    const estado = lerDemo();
    const atual = estado[aulaId] ?? { tentativas: 0, aprovada: false };
    if (atual.tentativas >= PADRAO_DEMO.tentativas) {
      return { erro: "Tentativas esgotadas para esta aula." };
    }

    const gabarito = respostas.map((r) => {
      const q = QUIZ_DEMO.find((x) => x.id === r.questaoId);
      return {
        questaoId: r.questaoId,
        correta: q?.correta ?? "",
        marcada: r.resposta,
        acertou: Boolean(q && q.correta === r.resposta),
        explicacao: q?.explicacao,
      };
    });
    const acertos = gabarito.filter((g) => g.acertou).length;
    const aprovada = acertos >= PADRAO_DEMO.minimo;

    estado[aulaId] = { tentativas: atual.tentativas + 1, aprovada: atual.aprovada || aprovada };
    gravarDemo(estado);

    return {
      resultado: {
        acertos,
        total: respostas.length,
        minimo: PADRAO_DEMO.minimo,
        aprovada,
        tentativasUsadas: atual.tentativas + 1,
        tentativasMax: PADRAO_DEMO.tentativas,
        gabarito,
      },
    };
  }

  const { data, error } = await sb.rpc("corrigir_quiz", {
    p_aula: aulaId,
    p_respostas: respostas.map((r) => ({ questao_id: r.questaoId, resposta: r.resposta })),
  });

  if (error) return { erro: msgErro(error) };

  const d = (data ?? {}) as Record<string, unknown>;
  type LinhaGab = {
    questao_id: string; correta: string; marcada: string | null;
    acertou: boolean; explicacao: string | null;
  };

  return {
    resultado: {
      acertos: Number(d.acertos ?? 0),
      total: Number(d.total ?? 0),
      minimo: Number(d.minimo ?? 2),
      aprovada: Boolean(d.aprovada),
      tentativasUsadas: Number(d.tentativas_usadas ?? 0),
      tentativasMax: Number(d.tentativas_max ?? 2),
      gabarito: ((d.gabarito ?? []) as LinhaGab[]).map((g) => ({
        questaoId: g.questao_id,
        correta: g.correta,
        marcada: g.marcada,
        acertou: g.acertou,
        explicacao: g.explicacao ?? undefined,
      })),
    },
  };
}
