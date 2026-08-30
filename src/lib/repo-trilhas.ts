import { getSupabase, getSupabaseAnon } from "./supabase";
import { msgErro } from "./modo";
import type { CertificadoTrilha, Trilha } from "./types";

/* ==========================================================================
   TRILHAS DE CARREIRA
   Uma trilha agrupa cursos numa sequência com objetivo de cargo. Sem Supabase,
   devolve o seed local para a demonstração continuar funcionando.
   ========================================================================== */

type LinhaTrilha = {
  id: string; slug: string; nome: string; subtitulo: string | null;
  descricao: string | null; cargo_alvo: string; area: string;
  nivel_entrada: string; nivel_saida: string; cor: string; icone: string | null;
  faixa_salarial: string | null;
  trilha_cursos: Array<{
    ordem: number; obrigatorio: boolean;
    cursos: { slug: string; titulo: string; carga_horaria: number; pontos_pepc: number } | null;
  }>;
  trilha_habilidades: Array<{
    nivel_esperado: number;
    habilidades: { nome: string } | null;
  }>;
};

function mapTrilha(r: LinhaTrilha): Trilha {
  const cursos = (r.trilha_cursos ?? [])
    .filter((tc) => tc.cursos)
    .sort((a, b) => a.ordem - b.ordem)
    .map((tc) => ({
      slug: tc.cursos!.slug,
      titulo: tc.cursos!.titulo,
      ordem: tc.ordem,
      obrigatorio: tc.obrigatorio,
      cargaHoraria: tc.cursos!.carga_horaria,
    }));

  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    subtitulo: r.subtitulo ?? undefined,
    descricao: r.descricao ?? undefined,
    cargoAlvo: r.cargo_alvo,
    area: r.area,
    nivelEntrada: r.nivel_entrada,
    nivelSaida: r.nivel_saida,
    cor: r.cor,
    icone: r.icone ?? undefined,
    faixaSalarial: r.faixa_salarial ?? undefined,
    cursos,
    habilidades: (r.trilha_habilidades ?? [])
      .filter((th) => th.habilidades)
      .sort((a, b) => b.nivel_esperado - a.nivel_esperado)
      .map((th) => ({ nome: th.habilidades!.nome, nivelEsperado: th.nivel_esperado })),
    cargaHoraria: (r.trilha_cursos ?? []).reduce(
      (a, tc) => a + (tc.cursos?.carga_horaria ?? 0),
      0
    ),
    pontosPEPC: (r.trilha_cursos ?? []).reduce(
      (a, tc) => a + (tc.cursos?.pontos_pepc ?? 0),
      0
    ),
  };
}

const SELECT_TRILHA = `
  id, slug, nome, subtitulo, descricao, cargo_alvo, area,
  nivel_entrada, nivel_saida, cor, icone, faixa_salarial,
  trilha_cursos ( ordem, obrigatorio, cursos ( slug, titulo, carga_horaria, pontos_pepc ) ),
  trilha_habilidades ( nivel_esperado, habilidades ( nome ) )
`;

export async function carregarTrilhas(): Promise<Trilha[]> {
  const sb = getSupabase() ?? getSupabaseAnon();
  if (!sb) return trilhasDemo;

  const { data, error } = await sb
    .from("trilhas")
    .select(SELECT_TRILHA)
    .eq("publicada", true)
    .order("ordem");

  if (error) {
    console.error("[trilhas] falha ao carregar:", msgErro(error));
    return trilhasDemo;
  }
  return ((data ?? []) as unknown as LinhaTrilha[]).map(mapTrilha);
}

/** Certificados de trilha visíveis (próprios + de perfis públicos). */
export async function carregarCertificadosTrilha(): Promise<CertificadoTrilha[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("certificados_trilha")
    .select("id, perfil_id, codigo, carga_horaria, pontos_pepc, emitido_em, trilhas ( slug, nome )");

  if (error) {
    console.error("[trilhas] certificados:", msgErro(error));
    return [];
  }

  type Linha = {
    id: string; perfil_id: string; codigo: string; carga_horaria: number;
    pontos_pepc: number; emitido_em: string; trilhas: { slug: string; nome: string } | null;
  };

  return ((data ?? []) as unknown as Linha[]).map((r) => ({
    id: r.id,
    perfilId: r.perfil_id,
    trilhaSlug: r.trilhas?.slug ?? "",
    trilhaNome: r.trilhas?.nome ?? "Trilha",
    codigo: r.codigo,
    cargaHoraria: r.carga_horaria,
    pontosPEPC: r.pontos_pepc,
    emitidoEm: r.emitido_em,
  }));
}

/* ------------------------------------------------------------ seed local -- */
export const trilhasDemo: Trilha[] = [
  {
    id: "t-fiscal", slug: "analista-fiscal",
    nome: "Analista Fiscal — do iniciante ao profissional",
    subtitulo: "A trilha que tira você do zero e coloca no departamento fiscal",
    descricao:
      "Comece sem saber nada de rotina fiscal e termine apurando, conferindo documento eletrônico e fechando o mês sozinho.",
    cargoAlvo: "Analista Fiscal", area: "Fiscal",
    nivelEntrada: "Iniciante", nivelSaida: "Avançado",
    cor: "#00204D", icone: "file-text", faixaSalarial: "R$ 2.500 – R$ 7.200",
    cursos: [
      { slug: "departamento-fiscal-do-zero", titulo: "Departamento Fiscal do Zero", ordem: 1, obrigatorio: true, cargaHoraria: 24 },
      { slug: "contabilidade-para-transporte-e-logistica", titulo: "Contabilidade para Transporte e Logística", ordem: 2, obrigatorio: true, cargaHoraria: 16 },
      { slug: "reforma-tributaria-na-pratica", titulo: "Reforma Tributária na Prática", ordem: 3, obrigatorio: true, cargaHoraria: 18 },
    ],
    habilidades: [
      { nome: "SPED", nivelEsperado: 85 }, { nome: "Obrigações acessórias", nivelEsperado: 85 },
      { nome: "Simples Nacional", nivelEsperado: 80 }, { nome: "CT-e", nivelEsperado: 75 },
    ],
    cargaHoraria: 58, pontosPEPC: 58,
  },
  {
    id: "t-trib", slug: "especialista-tributario",
    nome: "Especialista Tributário",
    subtitulo: "De quem executa para quem decide a tese",
    descricao: "Revisão de créditos, planejamento e a transição da Reforma com sustentação documental.",
    cargoAlvo: "Consultor Tributário", area: "Tributário",
    nivelEntrada: "Intermediário", nivelSaida: "Avançado",
    cor: "#B88A45", icone: "scale", faixaSalarial: "R$ 8.000 – R$ 16.000",
    cursos: [
      { slug: "reforma-tributaria-na-pratica", titulo: "Reforma Tributária na Prática", ordem: 1, obrigatorio: true, cargaHoraria: 18 },
      { slug: "recuperacao-de-creditos-tributarios", titulo: "Recuperação de Créditos Tributários", ordem: 2, obrigatorio: true, cargaHoraria: 22 },
      { slug: "contabilidade-consultiva-e-gestao", titulo: "Contabilidade Consultiva", ordem: 3, obrigatorio: true, cargaHoraria: 14 },
    ],
    habilidades: [
      { nome: "Reforma Tributária", nivelEsperado: 90 }, { nome: "Recuperação de créditos", nivelEsperado: 90 },
      { nome: "PER/DCOMP", nivelEsperado: 85 }, { nome: "Lucro Real", nivelEsperado: 80 },
    ],
    cargaHoraria: 54, pontosPEPC: 54,
  },
  {
    id: "t-comex", slug: "comercio-exterior",
    nome: "Analista de Comércio Exterior",
    subtitulo: "Importação, exportação e o controle que evita autuação",
    descricao: "A vertical que menos tem profissional formado no Brasil.",
    cargoAlvo: "Analista de Comex", area: "Comex",
    nivelEntrada: "Iniciante", nivelSaida: "Avançado",
    cor: "#2F6E75", icone: "ship", faixaSalarial: "R$ 3.200 – R$ 9.000",
    cursos: [
      { slug: "departamento-fiscal-do-zero", titulo: "Departamento Fiscal do Zero", ordem: 1, obrigatorio: true, cargaHoraria: 24 },
      { slug: "comercio-exterior-e-rotina-aduaneira", titulo: "Comércio Exterior e Rotina Aduaneira", ordem: 2, obrigatorio: true, cargaHoraria: 20 },
      { slug: "contabilidade-para-transporte-e-logistica", titulo: "Contabilidade para Transporte e Logística", ordem: 3, obrigatorio: true, cargaHoraria: 16 },
    ],
    habilidades: [
      { nome: "NCM", nivelEsperado: 88 }, { nome: "Siscomex", nivelEsperado: 82 },
      { nome: "Drawback", nivelEsperado: 80 },
    ],
    cargaHoraria: 60, pontosPEPC: 60,
  },
  {
    id: "t-consult", slug: "contador-consultivo",
    nome: "Contador Consultivo e Controller",
    subtitulo: "Sair da apuração e sentar na mesa de decisão",
    descricao: "Contabilidade que vira decisão de caixa, contrato e margem.",
    cargoAlvo: "Contador Consultivo", area: "Gestão",
    nivelEntrada: "Intermediário", nivelSaida: "Avançado",
    cor: "#1F4A7A", icone: "trending-up", faixaSalarial: "R$ 9.000 – R$ 18.000",
    cursos: [
      { slug: "contabilidade-consultiva-e-gestao", titulo: "Contabilidade Consultiva", ordem: 1, obrigatorio: true, cargaHoraria: 14 },
      { slug: "reforma-tributaria-na-pratica", titulo: "Reforma Tributária na Prática", ordem: 2, obrigatorio: false, cargaHoraria: 18 },
    ],
    habilidades: [
      { nome: "Consultivo", nivelEsperado: 90 }, { nome: "Power BI", nivelEsperado: 78 },
    ],
    cargaHoraria: 32, pontosPEPC: 32,
  },
];
