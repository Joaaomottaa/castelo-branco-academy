import type { Plano } from "./types";

/**
 * Planos da plataforma.
 *
 * Vive em código porque a tela é só vitrine neste momento — não há cobrança
 * ligada. Quando o gateway entrar, migrar para uma tabela `planos` e ler daqui
 * pelo mesmo formato.
 */
export const planos: Plano[] = [
  {
    slug: "free",
    nome: "Gratuito",
    preco: "R$ 0",
    periodo: "para sempre",
    chamada: "Conheça o método antes de decidir.",
    cta: "Seu plano atual",
    limites: { questoesPorDia: 3, iaExplicacoes: false, cadernos: 1 },
    recursos: [
      { texto: "Aulas gratuitas de todos os cursos", incluso: true },
      { texto: "Perfil no banco de talentos", incluso: true },
      { texto: "Candidatura a vagas", incluso: true },
      { texto: "Feed da comunidade", incluso: true },
      { texto: "3 questões por dia no banco", incluso: true },
      { texto: "1 caderno de questões", incluso: true },
      { texto: "Cursos e trilhas completos", incluso: false },
      { texto: "Certificados com validação", incluso: false },
      { texto: "Pontos para educação continuada (PEPC)", incluso: false },
      { texto: "Tino, o assistente de IA", incluso: false },
      { texto: "Explicação da questão por IA quando você erra", incluso: false },
    ],
  },
  {
    slug: "pro",
    nome: "Pro",
    preco: "R$ 89",
    precoAnual: "R$ 71/mês no anual",
    periodo: "/mês",
    chamada: "Acesso total, certificação e a IA que estuda com você.",
    destaque: true,
    cta: "Assinar Pro",
    limites: { questoesPorDia: "ilimitado", iaExplicacoes: true, cadernos: "ilimitado" },
    recursos: [
      { texto: "Tudo do plano Gratuito", incluso: true },
      { texto: "Todos os cursos e trilhas de carreira", incluso: true, destaque: true },
      { texto: "Certificados com código público de validação", incluso: true, destaque: true },
      { texto: "Pontos para educação continuada (PEPC)", incluso: true, destaque: true },
      { texto: "Questões ilimitadas no banco", incluso: true },
      { texto: "Cadernos ilimitados e simulados", incluso: true },
      { texto: "Tino explica por que você errou a questão", incluso: true, destaque: true },
      { texto: "Assistente de IA sobre as aulas, com fonte citada", incluso: true },
      { texto: "Mentorias ao vivo mensais", incluso: true },
      { texto: "Selo verificado no banco de talentos", incluso: true },
      { texto: "Materiais, planilhas e checklists", incluso: true },
    ],
  },
  {
    slug: "empresarial",
    nome: "Empresarial",
    preco: "Sob consulta",
    periodo: "",
    chamada: "Universidade corporativa e contratação no mesmo lugar.",
    cta: "Falar com vendas",
    limites: { questoesPorDia: "ilimitado", iaExplicacoes: true, cadernos: "ilimitado" },
    recursos: [
      { texto: "Tudo do plano Pro para cada colaborador", incluso: true },
      { texto: "Licenças por colaborador", incluso: true, destaque: true },
      { texto: "Trilhas obrigatórias por cargo", incluso: true, destaque: true },
      { texto: "Relatório de evolução por pessoa e por time", incluso: true },
      { texto: "Publicação ilimitada de vagas", incluso: true },
      { texto: "Busca avançada no banco de talentos", incluso: true, destaque: true },
      { texto: "Conteúdo exclusivo da sua empresa", incluso: true },
      { texto: "Perfil da empresa no feed da comunidade", incluso: true },
      { texto: "Gestor de conta dedicado", incluso: true },
    ],
  },
];

/**
 * Preços em número, para o checkout. Os textos dos cartões continuam nos
 * objetos acima; aqui fica o que entra na conta.
 *
 * Quando houver cobrança de verdade, isto vira uma tabela `planos` no banco e
 * o checkout passa a ler de lá — a forma do objeto não muda.
 */
export const PRECOS: Record<string, { mensal: number; anual: number; anualPorMes: number }> = {
  Pro: { mensal: 89, anual: 852, anualPorMes: 71 },
};

export function precoDoPlano(plano: string, ciclo: "mensal" | "anual"): number {
  const p = PRECOS[plano];
  if (!p) return 0;
  return ciclo === "anual" ? p.anual : p.mensal;
}

export const planoAtual = (slug?: string) =>
  planos.find((p) => p.nome.toLowerCase() === (slug ?? "free").toLowerCase()) ?? planos[0];

/** Limites por plano — usados para travar recurso na interface. */
export function limitesDoPlano(plano?: string) {
  const p = (plano ?? "Free").toLowerCase();
  if (p === "pro") return planos[1].limites;
  if (p === "enterprise" || p === "empresarial") return planos[2].limites;
  return planos[0].limites;
}

export const ehPago = (plano?: string) =>
  ["pro", "enterprise", "empresarial"].includes((plano ?? "free").toLowerCase());
