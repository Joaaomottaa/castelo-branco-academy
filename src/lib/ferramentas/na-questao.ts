import { FERRAMENTAS } from "./catalogo";
import type { Ferramenta } from "./nucleo";

/* ==========================================================================
   QUAIS FERRAMENTAS FAZEM SENTIDO DENTRO DE UMA QUESTÃO

   O catálogo tem dezoito ferramentas, mas nem toda ferramenta ajuda a
   responder. O validador de CPF/CNPJ resolve um problema de cadastro, não de
   prova; o simulador de parcelamento depende de uma dívida real, com data de
   consolidação — nada disso cabe num enunciado de múltipla escolha.

   O que sobra é o que reproduz uma conta: a que a banca fez para chegar ao
   gabarito. Essas ficam.

   E mesmo entre as que ficam, mostrar todas seria o mesmo que não sugerir
   nada. A questão diz do que trata — área, assunto, tags, enunciado — e daí
   sai um recorte de três ou quatro. As demais continuam a um clique, em
   "ver todas".
   ========================================================================== */

/** Fora da questão de propósito — ver o comentário acima. */
const NAO_ENTRAM = new Set(["validador-cpf-cnpj", "parcelamento"]);

/**
 * Palavras que ligam uma ferramenta a um enunciado.
 *
 * São termos que a banca usa, não sinônimos bonitos: "RBT12" aparece na prova,
 * "receita bruta acumulada" também, e as duas precisam cair no mesmo lugar.
 */
const PISTAS: Record<string, string[]> = {
  "salario-liquido": [
    "salário líquido", "salario liquido", "desconto em folha", "inss", "irrf",
    "imposto de renda retido", "folha de pagamento", "contracheque",
    "vale-transporte", "dependente",
  ],
  rescisao: [
    "rescisão", "rescisao", "demissão", "demissao", "aviso prévio", "aviso previo",
    "justa causa", "verbas rescisórias", "verbas rescisorias", "multa do fgts",
    "desligamento", "saldo de salário",
  ],
  ferias: [
    "férias", "ferias", "terço constitucional", "terco constitucional",
    "abono pecuniário", "abono pecuniario", "período aquisitivo", "periodo aquisitivo",
  ],
  "decimo-terceiro": [
    "décimo terceiro", "decimo terceiro", "13º", "13o", "gratificação natalina",
    "gratificacao natalina",
  ],
  "horas-extras": [
    "hora extra", "horas extras", "adicional noturno", "dsr",
    "descanso semanal", "jornada", "adicional de 50", "adicional de 100",
  ],
  "simples-nacional": [
    "simples nacional", "das", "anexo i", "anexo ii", "anexo iii", "anexo iv",
    "anexo v", "rbt12", "alíquota efetiva", "aliquota efetiva", "sublimite",
    "receita bruta dos últimos 12", "microempresa", "epp",
  ],
  "fator-r": [
    "fator r", "fator-r", "folha de salários", "folha de salarios",
    "anexo iii ou v", "anexo v",
  ],
  "lucro-presumido": [
    "lucro presumido", "presunção", "presuncao", "irpj", "csll",
    "adicional de irpj", "pis cumulativo", "cofins cumulativo", "trimestre",
  ],
  "pro-labore": [
    "pró-labore", "pro-labore", "pro labore", "sócio", "socio",
    "contribuinte individual", "retirada do sócio",
  ],
  "multa-e-juros": [
    "multa de mora", "juros de mora", "selic", "atraso no recolhimento",
    "denúncia espontânea", "denuncia espontanea", "multa moratória",
    "multa moratoria", "recolhimento em atraso",
  ],
  "reforma-tributaria": [
    "reforma tributária", "reforma tributaria", "cbs", "ibs", "iva",
    "imposto seletivo", "split payment", "não cumulatividade plena",
    "transição", "transicao", "ec 132", "lc 214",
  ],
  "custo-por-km": [
    "custo por km", "custo operacional", "frete", "transporte", "frota",
    "caminhão", "caminhao", "diesel", "pneu", "rodoviário", "rodoviario",
    "km rodado", "cte", "ct-e", "conhecimento de transporte", "logística", "logistica",
  ],
  "custo-importacao": [
    "importação", "importacao", "imposto de importação", "afrmm",
    "siscomex", "aduaneir", "valor aduaneiro", "comércio exterior",
    "comercio exterior", "comex", "incoterm", "drawback", "nacionalização",
    "ncm", "classificação fiscal", "classificacao fiscal", "ex tarifário",
  ],
  "preco-de-venda": [
    "preço de venda", "preco de venda", "markup", "mark-up", "margem",
    "formação de preço", "formacao de preco",
  ],
  "ponto-de-equilibrio": [
    "ponto de equilíbrio", "ponto de equilibrio", "break-even",
    "margem de contribuição", "margem de contribuicao", "custo fixo",
    "custo variável", "custo variavel", "alavancagem",
  ],
  depreciacao: [
    "depreciação", "depreciacao", "vida útil", "vida util", "valor residual",
    "imobilizado", "amortização", "amortizacao", "quotas constantes",
    "ativo imobilizado", "cpc 27",
  ],
};

/**
 * Rede de segurança por área.
 *
 * Nem toda questão traz a palavra que casa com uma ferramenta — "Regimes
 * Aduaneiros" não diz "importação", mas quem estuda isso quer o simulador de
 * custo de importação por perto. A área é classificação humana e confiável,
 * então vale ponto; só vale menos que a pista explícita, para não passar na
 * frente de um casamento direto.
 */
const POR_AREA: Record<string, string[]> = {
  pessoal: ["salario-liquido", "rescisao", "ferias", "horas-extras", "decimo-terceiro"],
  fiscal: ["simples-nacional", "lucro-presumido", "fator-r", "multa-e-juros"],
  tributario: ["reforma-tributaria", "simples-nacional", "lucro-presumido", "multa-e-juros"],
  comex: ["custo-importacao", "custo-por-km", "preco-de-venda"],
  contabil: ["depreciacao", "ponto-de-equilibrio", "preco-de-venda"],
  gestao: ["ponto-de-equilibrio", "preco-de-venda", "custo-por-km", "depreciacao"],
};

/** Quando nada casa, estas são as que mais resolvem no dia a dia da base. */
const PADRAO = ["salario-liquido", "simples-nacional", "lucro-presumido"];

export interface ContextoDaQuestao {
  area?: string;
  assunto?: string;
  tags?: string[];
  enunciado?: string;
}

/** Marcas de acento combinantes (U+0300–U+036F), removidas depois do NFD. */
const RANGE_ACENTOS = /[̀-ͯ]/g;

const semAcento = (s: string) =>
  s.normalize("NFD").replace(RANGE_ACENTOS, "").toLowerCase();

/** Todas as que podem aparecer numa questão, na ordem do catálogo. */
export const FERRAMENTAS_NA_QUESTAO: Ferramenta[] =
  FERRAMENTAS.filter((f) => !NAO_ENTRAM.has(f.slug));

/**
 * As ferramentas sugeridas para esta questão, da mais provável para a menos.
 *
 * A área e o assunto pesam mais que o enunciado: são classificação feita por
 * quem cadastrou a questão, enquanto o enunciado pode citar "férias" só para
 * montar o cenário de uma pergunta sobre outra coisa.
 */
export function ferramentasSugeridas(q: ContextoDaQuestao, quantas = 4): Ferramenta[] {
  const forte = semAcento([q.area, q.assunto, ...(q.tags ?? [])].filter(Boolean).join(" "));
  const fraco = semAcento((q.enunciado ?? "").slice(0, 1200));

  const daArea = POR_AREA[semAcento(q.area ?? "")] ?? [];

  const pontuadas = FERRAMENTAS_NA_QUESTAO.map((f) => {
    const pistas = PISTAS[f.slug] ?? [];
    let pontos = 0;
    for (const pista of pistas) {
      const p = semAcento(pista);
      if (forte.includes(p)) pontos += 3;
      else if (fraco.includes(p)) pontos += 1;
    }
    // O nome da própria ferramenta também vale como pista.
    if (forte.includes(semAcento(f.nome))) pontos += 2;
    // Ordem dentro da área desempata: a primeira da lista é a mais usada.
    const naArea = daArea.indexOf(f.slug);
    if (naArea >= 0) pontos += 2 - naArea * 0.1;
    return { f, pontos };
  })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);

  if (pontuadas.length === 0) {
    return PADRAO.map((s) => FERRAMENTAS_NA_QUESTAO.find((f) => f.slug === s)!).filter(Boolean);
  }
  return pontuadas.slice(0, quantas).map((x) => x.f);
}
