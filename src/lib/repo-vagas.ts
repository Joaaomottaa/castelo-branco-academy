import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Certificado, CertificadoTrilha, Perfil } from "./types";

/* ==========================================================================
   VAGAS E EMPRESAS — lado administrativo

   Uma decisão que vale registrar: os candidatos vêm por RPC, com certificados,
   trilhas e habilidades juntos, mas o *ranking* é calculado no cliente pela
   mesma `calcularMatch` que o aluno vê na tela de vagas.

   Duas implementações do mesmo score — uma no banco para o admin, outra no
   cliente para o aluno — divergiriam na primeira mudança de peso. A empresa
   precisa ver exatamente o número que o candidato viu.
   ========================================================================== */

const SEM_BANCO =
  "Esta ação grava no banco. Troque a chave no topo para “Supabase” e tente de novo.";

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  cor: string;
  site?: string;
  cidade?: string;
  uf?: string;
  vagas: number;
  /** Assentos do contrato. Só o admin da Academy altera — ver o gatilho
      `empresas_trava_licencas` no 18_area_da_empresa.sql. */
  licencasContratadas: number;
  /** Vínculos ativos, com ou sem licença. */
  membros: number;
  /** Assentos efetivamente ocupados. */
  licencasUsadas: number;
}

export interface VagaAdmin {
  id: string;
  empresaId: string;
  empresa: string;
  logoCor: string;
  titulo: string;
  descricao: string;
  cidade: string;
  uf: string;
  modelo: string;
  contrato: string;
  faixa: string;
  senioridade: string;
  area: string;
  requisitos: string[];
  cursosDesejados: string[];
  trilhasDesejadas: string[];
  ativa: boolean;
  publicadaEm: string;
  candidatos: number;
  /* Campos de recrutamento — ver 20_docente_recrutamento_comunidade.sql. */
  beneficios: string[];
  jornada: string;
  escolaridade: string;
  experienciaMinAnos: number | null;
  pcd: boolean;
  afirmativaPara: string[];
  acessibilidade: string;
  sigilosa: boolean;
}

/** Uma etapa do funil. Mesmos valores do enum `status_candidatura`. */
export const ETAPAS = [
  { v: "enviada", rotulo: "Enviada" },
  { v: "em_analise", rotulo: "Em análise" },
  { v: "entrevista", rotulo: "Entrevista" },
  { v: "aprovada", rotulo: "Aprovada" },
  { v: "recusada", rotulo: "Recusada" },
] as const;

export interface ResumoDaVaga {
  vagaId: string;
  titulo: string;
  ativa: boolean;
  publicadaEm: string;
  total: number;
  novas7d: number;
  naoVistas: number;
  porStatus: Record<string, number>;
  ultima?: string;
}

export interface DiversidadeDaVaga {
  disponivel: boolean;
  declaradas: number;
  minimo?: number;
  pcd?: number;
  genero?: Record<string, number>;
  racaCor?: Record<string, number>;
}

export interface Candidato {
  candidaturaId: string;
  status: string;
  criadaEm: string;
  atualizadaEm?: string;
  /** Quando a empresa abriu a ficha pela primeira vez. */
  vistaEm?: string;
  /** Anotação privada da empresa. O candidato nunca vê. */
  notaInterna?: string;
  mensagem?: string;
  perfil: Perfil;
  certificados: Certificado[];
  trilhas: CertificadoTrilha[];
}

/* --------------------------------------------------------------- vagas -- */
type LinhaVaga = {
  id: string; empresa_id: string; titulo: string; descricao: string | null;
  cidade: string | null; uf: string | null; modelo: string; contrato: string;
  faixa: string | null; senioridade: string | null; area: string | null;
  requisitos: string[] | null;
  cursos_desejados: string[] | null; trilhas_desejadas: string[] | null;
  ativa: boolean; publicada_em: string;
  beneficios: string[] | null; jornada: string | null; escolaridade: string | null;
  experiencia_min_anos: number | null; pcd: boolean | null;
  afirmativa_para: string[] | null; acessibilidade: string | null;
  sigilosa: boolean | null;
  empresas: { nome: string; cor: string | null } | null;
  candidaturas: Array<{ count: number }>;
};

const COLUNAS_VAGA = `id, empresa_id, titulo, descricao, cidade, uf, modelo, contrato,
   faixa, senioridade, area, requisitos, cursos_desejados, trilhas_desejadas, ativa,
   publicada_em, beneficios, jornada, escolaridade, experiencia_min_anos, pcd,
   afirmativa_para, acessibilidade, sigilosa,
   empresas ( nome, cor ), candidaturas ( count )`;

function mapVagaAdmin(v: LinhaVaga): VagaAdmin {
  return {
    id: v.id,
    empresaId: v.empresa_id,
    empresa: v.empresas?.nome ?? "Empresa",
    logoCor: v.empresas?.cor ?? "#00204D",
    titulo: v.titulo,
    descricao: v.descricao ?? "",
    cidade: v.cidade ?? "",
    uf: v.uf ?? "",
    modelo: v.modelo,
    contrato: v.contrato,
    faixa: v.faixa ?? "",
    senioridade: v.senioridade ?? "",
    area: v.area ?? "",
    requisitos: v.requisitos ?? [],
    cursosDesejados: v.cursos_desejados ?? [],
    trilhasDesejadas: v.trilhas_desejadas ?? [],
    ativa: v.ativa,
    publicadaEm: v.publicada_em,
    candidatos: v.candidaturas?.[0]?.count ?? 0,
    beneficios: v.beneficios ?? [],
    jornada: v.jornada ?? "",
    escolaridade: v.escolaridade ?? "",
    experienciaMinAnos: v.experiencia_min_anos,
    pcd: Boolean(v.pcd),
    afirmativaPara: v.afirmativa_para ?? [],
    acessibilidade: v.acessibilidade ?? "",
    sigilosa: Boolean(v.sigilosa),
  };
}

export async function carregarVagasAdmin(): Promise<{ vagas: VagaAdmin[]; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { vagas: [], erro: SEM_BANCO };

  const { data, error } = await sb
    .from("vagas")
    .select(COLUNAS_VAGA)
    .order("publicada_em", { ascending: false });

  if (error) return { vagas: [], erro: msgErro(error) };
  return { vagas: ((data ?? []) as unknown as LinhaVaga[]).map(mapVagaAdmin) };
}

/**
 * As vagas de uma empresa — inclusive as pausadas.
 *
 * A tela da empresa filtrava no cliente o resultado de `carregarVagasAdmin`,
 * que depende da policy "vagas ativas são públicas". Funcionava para vaga
 * aberta e escondia a pausada: a empresa perdia de vista exatamente a vaga que
 * ela precisava reabrir. Perguntar pela empresa resolve na origem.
 */
export async function carregarVagasDaEmpresa(
  empresaId: string
): Promise<{ vagas: VagaAdmin[]; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { vagas: [], erro: SEM_BANCO };
  if (!empresaId) return { vagas: [] };

  const { data, error } = await sb
    .from("vagas")
    .select(COLUNAS_VAGA)
    .eq("empresa_id", empresaId)
    .order("publicada_em", { ascending: false });

  if (error) return { vagas: [], erro: msgErro(error) };
  return { vagas: ((data ?? []) as unknown as LinhaVaga[]).map(mapVagaAdmin) };
}

/** Contagem por etapa de cada vaga, numa chamada. */
export async function resumoDasVagas(): Promise<ResumoDaVaga[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("empresa_vagas_resumo");
  if (error) {
    console.error("[vagas] resumo:", msgErro(error));
    return [];
  }
  type L = {
    vaga_id: string; titulo: string; ativa: boolean; publicada_em: string;
    total: number; novas_7d: number; nao_vistas: number;
    por_status: Record<string, number>; ultima: string | null;
  };
  return ((data ?? []) as L[]).map((r) => ({
    vagaId: r.vaga_id,
    titulo: r.titulo,
    ativa: r.ativa,
    publicadaEm: r.publicada_em,
    total: Number(r.total ?? 0),
    novas7d: Number(r.novas_7d ?? 0),
    naoVistas: Number(r.nao_vistas ?? 0),
    porStatus: r.por_status ?? {},
    ultima: r.ultima ?? undefined,
  }));
}

/**
 * Todas as candidaturas das vagas da empresa, cruas.
 *
 * É o insumo das estatísticas: a série por dia, o tempo até a primeira resposta
 * e a taxa de conversão saem daqui, calculados no cliente. Uma consulta é mais
 * honesta que cinco agregações no banco que ninguém consegue conferir.
 */
export async function candidaturasDaEmpresa(
  empresaId: string
): Promise<Array<{ id: string; vagaId: string; status: string; criadaEm: string; atualizadaEm?: string; vistaEm?: string }>> {
  const sb = getSupabase();
  if (!sb || !empresaId) return [];

  const { data, error } = await sb
    .from("candidaturas")
    .select("id, vaga_id, status, criada_em, atualizada_em, visualizada_em, vagas!inner ( empresa_id )")
    .eq("vagas.empresa_id", empresaId)
    .order("criada_em", { ascending: false });

  if (error) {
    console.error("[vagas] candidaturas da empresa:", msgErro(error));
    return [];
  }
  type L = {
    id: string; vaga_id: string; status: string; criada_em: string;
    atualizada_em: string | null; visualizada_em: string | null;
  };
  return ((data ?? []) as unknown as L[]).map((c) => ({
    id: c.id,
    vagaId: c.vaga_id,
    status: c.status,
    criadaEm: c.criada_em,
    atualizadaEm: c.atualizada_em ?? undefined,
    vistaEm: c.visualizada_em ?? undefined,
  }));
}

/** Representatividade agregada. Nunca por pessoa — ver a função no SQL. */
export async function diversidadeDaVaga(vagaId: string): Promise<DiversidadeDaVaga | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("empresa_diversidade_da_vaga", { p_vaga: vagaId });
  if (error) {
    console.error("[vagas] diversidade:", msgErro(error));
    return null;
  }
  return (data ?? null) as DiversidadeDaVaga | null;
}

export interface DadosVaga {
  id?: string;
  empresaId: string;
  titulo: string;
  descricao: string;
  cidade: string;
  uf: string;
  modelo: string;
  contrato: string;
  faixa: string;
  senioridade: string;
  /** Vazio deixa o banco decidir por `area_provavel_da_vaga`. */
  area?: string;
  requisitos: string[];
  cursosDesejados: string[];
  trilhasDesejadas: string[];
  ativa: boolean;
  beneficios?: string[];
  jornada?: string;
  escolaridade?: string;
  experienciaMinAnos?: number | null;
  /** Vaga reservada a PCD (cota da Lei 8.213/1991, art. 93). */
  pcd?: boolean;
  /** Grupos a que a vaga é afirmativa. Ação afirmativa é lícita. */
  afirmativaPara?: string[];
  acessibilidade?: string;
  sigilosa?: boolean;
}

/** Grupos aceitos em ação afirmativa. */
export const GRUPOS_AFIRMATIVOS = [
  "Pessoas com deficiência",
  "Mulheres",
  "Pessoas negras",
  "Pessoas 50+",
  "Pessoas trans",
  "Pessoas indígenas",
  "Refugiados",
] as const;

export const JORNADAS = ["Integral", "Meio período", "Escala 6x1", "Turno", "Flexível"];
export const ESCOLARIDADES = [
  "Ensino médio",
  "Técnico",
  "Superior cursando",
  "Superior completo",
  "Pós-graduação",
];

export async function salvarVaga(d: DadosVaga): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  if (!d.titulo.trim()) return { ok: false, erro: "Informe o título da vaga." };
  if (!d.empresaId) return { ok: false, erro: "Escolha a empresa." };

  const linha = {
    empresa_id: d.empresaId,
    titulo: d.titulo.trim(),
    descricao: d.descricao.trim() || null,
    cidade: d.cidade.trim() || null,
    uf: d.uf.trim().toUpperCase().slice(0, 2) || null,
    modelo: d.modelo,
    contrato: d.contrato,
    faixa: d.faixa.trim() || null,
    senioridade: d.senioridade || null,
    area: d.area?.trim() || null,
    // Arrays vazios são válidos: vaga sem certificação exigida é o caso comum.
    requisitos: d.requisitos,
    cursos_desejados: d.cursosDesejados,
    trilhas_desejadas: d.trilhasDesejadas,
    ativa: d.ativa,
    beneficios: d.beneficios ?? [],
    jornada: d.jornada?.trim() || null,
    escolaridade: d.escolaridade?.trim() || null,
    experiencia_min_anos:
      d.experienciaMinAnos === null || d.experienciaMinAnos === undefined
        ? null
        : Math.max(0, Math.min(40, d.experienciaMinAnos)),
    pcd: Boolean(d.pcd),
    afirmativa_para: d.afirmativaPara ?? [],
    acessibilidade: d.acessibilidade?.trim() || null,
    sigilosa: Boolean(d.sigilosa),
  };

  const { error } = d.id
    ? await sb.from("vagas").update(linha).eq("id", d.id)
    : await sb.from("vagas").insert(linha);

  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function apagarVaga(id: string): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("vagas").delete().eq("id", id);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function alternarVaga(id: string, ativa: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("vagas").update({ ativa }).eq("id", id);
}

/* ------------------------------------------------------------ empresas -- */
export async function carregarEmpresas(): Promise<Empresa[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("empresas")
    .select(
      `id, nome, cnpj, cor, site, cidade, uf, licencas_contratadas,
       vagas ( count ), empresa_membros ( perfil_id, status, licenca )`
    )
    .order("nome");

  if (error) {
    console.error("[vagas] empresas:", msgErro(error));
    return [];
  }

  type L = {
    id: string; nome: string; cnpj: string | null; cor: string | null;
    site: string | null; cidade: string | null; uf: string | null;
    licencas_contratadas: number | null;
    vagas: Array<{ count: number }>;
    empresa_membros: Array<{ status: string; licenca: boolean }>;
  };
  return ((data ?? []) as unknown as L[]).map((e) => {
    const ativos = (e.empresa_membros ?? []).filter((m) => m.status === "ativo");
    return {
      id: e.id,
      nome: e.nome,
      cnpj: e.cnpj ?? undefined,
      cor: e.cor ?? "#00204D",
      site: e.site ?? undefined,
      cidade: e.cidade ?? undefined,
      uf: e.uf ?? undefined,
      vagas: e.vagas?.[0]?.count ?? 0,
      licencasContratadas: e.licencas_contratadas ?? 0,
      membros: ativos.length,
      licencasUsadas: ativos.filter((m) => m.licenca).length,
    };
  });
}

export interface DadosEmpresa {
  id?: string;
  nome: string;
  cnpj: string;
  cor: string;
  site: string;
  cidade: string;
  uf: string;
  /** Assentos vendidos. Escrever isto é privilégio do admin: o gatilho no
      banco recusa a alteração vinda de qualquer outra sessão. */
  licencasContratadas: number;
}

export async function salvarEmpresa(d: DadosEmpresa): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  if (!d.nome.trim()) return { ok: false, erro: "Informe o nome da empresa." };

  const linha = {
    nome: d.nome.trim(),
    cnpj: d.cnpj.trim() || null,
    cor: d.cor,
    site: d.site.trim() || null,
    cidade: d.cidade.trim() || null,
    uf: d.uf.trim().toUpperCase().slice(0, 2) || null,
    licencas_contratadas: Math.max(0, Math.min(d.licencasContratadas, 9999)),
  };

  const { error } = d.id
    ? await sb.from("empresas").update(linha).eq("id", d.id)
    : await sb.from("empresas").insert(linha);

  if (error) {
    const m = msgErro(error);
    if (m.includes("duplicate") || m.includes("unique")) {
      return { ok: false, erro: "Já existe empresa com esse nome ou CNPJ." };
    }
    return { ok: false, erro: m };
  }
  return { ok: true };
}

export async function apagarEmpresa(id: string): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("empresas").delete().eq("id", id);
  if (error) {
    const m = msgErro(error);
    if (m.includes("foreign key")) {
      return { ok: false, erro: "A empresa tem vagas publicadas. Apague as vagas primeiro." };
    }
    return { ok: false, erro: m };
  }
  return { ok: true };
}

/* ---------------------------------------------------------- candidatos -- */
export async function carregarCandidatos(vagaId: string): Promise<Candidato[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc("candidatos_da_vaga", { p_vaga: vagaId });
  if (error) {
    console.error("[vagas] candidatos:", msgErro(error));
    return [];
  }

  type L = {
    candidatura_id: string; status: string; criada_em: string; mensagem: string | null;
    atualizada_em: string | null; visualizada_em: string | null; nota_interna: string | null;
    perfil: Record<string, unknown>;
    certificados: Array<{ cursoSlug: string; cursoTitulo: string }>;
    trilhas: Array<{ trilhaSlug: string; trilhaNome: string }>;
  };

  return ((data ?? []) as L[]).map((c) => {
    const p = c.perfil;
    return {
      candidaturaId: c.candidatura_id,
      status: c.status,
      criadaEm: c.criada_em,
      atualizadaEm: c.atualizada_em ?? undefined,
      vistaEm: c.visualizada_em ?? undefined,
      notaInterna: c.nota_interna ?? undefined,
      mensagem: c.mensagem ?? undefined,
      perfil: {
        id: String(p.id),
        nome: String(p.nome),
        email: String(p.email),
        role: "aluno",
        cargo: (p.cargo as string) ?? undefined,
        cidade: (p.cidade as string) ?? undefined,
        uf: (p.uf as string) ?? undefined,
        bio: (p.bio as string) ?? undefined,
        senioridade: (p.senioridade ?? undefined) as Perfil["senioridade"],
        pretensao: (p.pretensao as string) ?? undefined,
        telefone: (p.telefone as string) ?? undefined,
        linkedin: (p.linkedin as string) ?? undefined,
        crc: (p.crc as string) ?? undefined,
        disponivel: Boolean(p.disponivel),
        plano: (p.plano ?? "Free") as Perfil["plano"],
        nivel: Number(p.nivel ?? 1),
        pontos: Number(p.pontos ?? 0),
        habilidades: (p.habilidades as string[]) ?? [],
      },
      // Só os campos que `calcularMatch` consome; o resto não é usado no ranking.
      certificados: (c.certificados ?? []).map((x) => ({
        id: x.cursoSlug, cursoSlug: x.cursoSlug, cursoTitulo: x.cursoTitulo,
        cargaHoraria: 0, emitidoEm: "", codigo: "", pontosPEPC: 0,
      })),
      trilhas: (c.trilhas ?? []).map((x) => ({
        id: x.trilhaSlug, trilhaSlug: x.trilhaSlug, trilhaNome: x.trilhaNome,
        codigo: "", cargaHoraria: 0, pontosPEPC: 0, emitidoEm: "",
      })),
    };
  });
}

/** Anotação interna da empresa sobre o candidato. */
export async function definirNotaInterna(
  candidaturaId: string,
  nota: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb
    .from("candidaturas")
    .update({ nota_interna: nota.trim() || null })
    .eq("id", candidaturaId);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

/**
 * Marca a ficha como vista.
 *
 * Serve para o contador de "novas" da tela e, mais adiante, para responder ao
 * candidato quanto tempo a empresa leva para olhar — a métrica que ele mais
 * quer e que ninguém publica.
 */
export async function marcarCandidaturaVista(candidaturaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("candidaturas")
    .update({ visualizada_em: new Date().toISOString() })
    .eq("id", candidaturaId)
    .is("visualizada_em", null);
}

export async function definirStatusCandidatura(
  candidaturaId: string,
  status: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb
    .from("candidaturas").update({ status }).eq("id", candidaturaId);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}
