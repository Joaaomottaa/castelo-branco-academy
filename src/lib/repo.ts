import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSupabaseAnon } from "./supabase";
import { msgErro } from "./modo";
import type {
  Aula, Certificado, CertificadoTrilha, Curso, HabilidadeSelo, Perfil, Trilha, Vaga,
} from "./types";
import { carregarTrilhas, carregarCertificadosTrilha, trilhasDemo } from "./repo-trilhas";
import {
  cursos as cursosDemo,
  vagas as vagasDemo,
  talentos as talentosDemo,
  certificados as certificadosDemo,
  habilidadesDisponiveis as habilidadesDemo,
} from "./data";

/* ==========================================================================
   REPOSITÓRIO
   Uma função por consulta. Se o Supabase estiver configurado, lê do banco;
   senão devolve o seed local (modo demo). As páginas não sabem a diferença.
   ========================================================================== */

export interface Snapshot {
  cursos: Curso[];
  vagas: Vaga[];
  talentos: Perfil[];
  certificados: Certificado[];
  trilhas: Trilha[];
  certificadosTrilha: CertificadoTrilha[];
  habilidades: string[];
  origem: "supabase" | "demo";
  erro?: string;
}

export const snapshotDemo = (): Snapshot => ({
  cursos: cursosDemo,
  vagas: vagasDemo,
  talentos: talentosDemo,
  certificados: certificadosDemo,
  trilhas: trilhasDemo,
  certificadosTrilha: [],
  habilidades: habilidadesDemo,
  origem: "demo",
});

/* --------------------------------------------------------------- cursos -- */
type LinhaAula = {
  id: string; titulo: string; descricao: string | null; tipo: string;
  duracao_min: number; ordem: number; gratuita: boolean;
  video_origem: string | null; video_path: string | null; video_url: string | null;
  video_nome: string | null; quiz_ativo: boolean | null; quiz_qtd: number | null;
  quiz_minimo: number | null; quiz_tentativas: number | null;
};
type LinhaModulo = {
  id: string; titulo: string; resumo: string | null; ordem: number; aulas: LinhaAula[];
};
type LinhaCurso = {
  id: string; slug: string; titulo: string; subtitulo: string | null;
  descricao: string | null; categoria: string; nivel: string; cor: string;
  instrutor: string | null; instrutor_cargo: string | null;
  carga_horaria: number; pontos_pepc: number; alunos: number; nota: number;
  tags: string[]; destaque: boolean; novo: boolean; modulos: LinhaModulo[];
};

function mapCurso(r: LinhaCurso): Curso {
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.titulo,
    subtitulo: r.subtitulo ?? "",
    descricao: r.descricao ?? "",
    categoria: r.categoria,
    nivel: r.nivel as Curso["nivel"],
    instrutor: r.instrutor ?? "Equipe Castelo Branco",
    instrutorCargo: r.instrutor_cargo ?? "",
    cargaHoraria: r.carga_horaria,
    pontosPEPC: r.pontos_pepc,
    alunos: r.alunos,
    nota: Number(r.nota),
    tags: r.tags ?? [],
    destaque: r.destaque,
    novo: r.novo,
    cor: r.cor,
    modulos: [...(r.modulos ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => ({
        id: m.id,
        titulo: m.titulo,
        resumo: m.resumo ?? undefined,
        aulas: [...(m.aulas ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .map((a) => ({
            id: a.id,
            titulo: a.titulo,
            descricao: a.descricao ?? undefined,
            tipo: a.tipo as "video" | "quiz" | "material" | "ao-vivo",
            duracaoMin: a.duracao_min,
            gratuita: a.gratuita,
            videoOrigem: (a.video_origem ?? "nenhum") as Aula["videoOrigem"],
            videoPath: a.video_path ?? undefined,
            videoUrl: a.video_url ?? undefined,
            videoNome: a.video_nome ?? undefined,
            quizAtivo: a.quiz_ativo ?? false,
            quizQtd: a.quiz_qtd ?? 3,
            quizMinimo: a.quiz_minimo ?? 2,
            quizTentativas: a.quiz_tentativas ?? 2,
          })),
      })),
  };
}

/* -------------------------------------------------------------- talentos -- */
type LinhaPerfil = {
  id: string; nome: string; email: string; role: string;
  cidade: string | null; uf: string | null; crc: string | null; cargo: string | null;
  bio: string | null; senioridade: string | null; pretensao: string | null;
  linkedin: string | null; disponivel: boolean; plano: string;
  pontos: number; nivel: number; ofensiva: number | null;
  ultimo_estudo: string | null;
  telefone?: string | null; contato_publico?: boolean | null;
  cadastro_completo?: boolean | null; consentimento_em?: string | null;
  cep?: string | null; logradouro?: string | null; bairro?: string | null;
  numero?: string | null; complemento?: string | null;
  ativo?: boolean | null; ultimo_acesso?: string | null;
  motivo_desativacao?: string | null;
  perfil_habilidades: Array<{
    nivel: number; verificada: boolean;
    origem?: string | null; selo?: string | null; obtida_em?: string | null;
    habilidades: { nome: string } | null;
    cursos?: { slug: string; titulo: string } | null;
    trilhas?: { slug: string; nome: string } | null;
  }>;
};

/**
 * Vínculos de habilidade → selos ordenados por valor.
 *
 * O ouro do certificado e o texto que alguém digitou no cadastro antigo não
 * podem sair na mesma lista sem distinção: é justamente a distinção que a
 * empresa compra.
 */
export function mapSelos(
  vinculos: LinhaPerfil["perfil_habilidades"]
): HabilidadeSelo[] {
  const peso = (s?: string | null) =>
    s === "ouro" ? 3 : s === "prata" ? 2 : s === "bronze" ? 1 : 0;

  return (vinculos ?? [])
    .filter((v) => v.habilidades?.nome)
    .map((v) => ({
      nome: v.habilidades!.nome,
      selo: (v.selo ?? null) as HabilidadeSelo["selo"],
      origem: (v.origem ?? "manual") as HabilidadeSelo["origem"],
      nivel: v.nivel,
      cursoSlug: v.cursos?.slug,
      cursoTitulo: v.cursos?.titulo,
      trilhaSlug: v.trilhas?.slug,
      trilhaNome: v.trilhas?.nome,
      obtidaEm: v.obtida_em ?? undefined,
    }))
    .sort((a, b) => peso(b.selo) - peso(a.selo) || b.nivel - a.nivel);
}

/** Colunas de habilidade usadas em todo select de perfil. */
const SELECT_HABILIDADES = `perfil_habilidades (
  nivel, verificada, origem, selo, obtida_em,
  habilidades ( nome ), cursos ( slug, titulo ), trilhas ( slug, nome )
)`;

function mapPerfil(r: LinhaPerfil): Perfil {
  return {
    id: r.id,
    nome: r.nome,
    email: r.email,
    role: r.role as Perfil["role"],
    cidade: r.cidade ?? undefined,
    uf: r.uf ?? undefined,
    crc: r.crc ?? undefined,
    cargo: r.cargo ?? undefined,
    bio: r.bio ?? undefined,
    senioridade: (r.senioridade ?? undefined) as Perfil["senioridade"],
    pretensao: r.pretensao ?? undefined,
    linkedin: r.linkedin ?? undefined,
    telefone: r.telefone ?? undefined,
    contatoPublico: r.contato_publico ?? true,
    disponivel: r.disponivel,
    plano: r.plano as Perfil["plano"],
    pontos: r.pontos,
    nivel: r.nivel,
    ofensiva: r.ofensiva ?? 0,
    ativo: r.ativo ?? true,
    cadastroCompleto: r.cadastro_completo ?? true,
    consentimentoEm: r.consentimento_em ?? undefined,
    cep: r.cep ?? undefined,
    logradouro: r.logradouro ?? undefined,
    bairro: r.bairro ?? undefined,
    numero: r.numero ?? undefined,
    complemento: r.complemento ?? undefined,
    ultimoAcesso: r.ultimo_acesso ?? undefined,
    motivoDesativacao: r.motivo_desativacao ?? undefined,
    selos: mapSelos(r.perfil_habilidades),
    habilidades: mapSelos(r.perfil_habilidades).map((s) => s.nome),
  };
}

/* ----------------------------------------------------------------- vagas -- */
type LinhaVaga = {
  id: string; titulo: string; descricao: string | null; cidade: string | null;
  uf: string | null; modelo: string; contrato: string; faixa: string | null;
  senioridade: string | null; requisitos: string[]; cursos_desejados: string[];
  trilhas_desejadas: string[]; publicada_em: string;
  empresas: { nome: string; cor: string | null } | null;
  candidaturas: Array<{ count: number }>;
};

function mapVaga(
  r: LinhaVaga,
  slugPorId: Map<string, string>,
  trilhaSlugPorId: Map<string, string>
): Vaga {
  return {
    id: r.id,
    titulo: r.titulo,
    empresa: r.empresas?.nome ?? "Empresa",
    logoCor: r.empresas?.cor ?? "#00204D",
    cidade: r.cidade ?? "",
    uf: r.uf ?? "",
    modelo: r.modelo as Vaga["modelo"],
    contrato: r.contrato as Vaga["contrato"],
    faixa: r.faixa ?? "A combinar",
    senioridade: r.senioridade ?? "",
    publicadaEm: r.publicada_em,
    requisitos: r.requisitos ?? [],
    certificacoesDesejadas: (r.cursos_desejados ?? [])
      .map((id) => slugPorId.get(id))
      .filter((s): s is string => Boolean(s)),
    trilhasDesejadas: (r.trilhas_desejadas ?? [])
      .map((id) => trilhaSlugPorId.get(id))
      .filter((s): s is string => Boolean(s)),
    descricao: r.descricao ?? "",
    candidatos: r.candidaturas?.[0]?.count ?? 0,
  };
}

/* ---------------------------------------------------------- certificados -- */
type LinhaCert = {
  id: string; perfil_id: string; codigo: string; carga_horaria: number;
  pontos_pepc: number; emitido_em: string;
  cursos: { slug: string; titulo: string } | null;
};

function mapCertificado(r: LinhaCert): Certificado {
  return {
    id: r.id,
    perfilId: r.perfil_id,
    cursoSlug: r.cursos?.slug ?? "",
    cursoTitulo: r.cursos?.titulo ?? "Curso",
    cargaHoraria: r.carga_horaria,
    emitidoEm: r.emitido_em,
    codigo: r.codigo,
    pontosPEPC: r.pontos_pepc,
  };
}

/* ======================================================================
   Carga completa
   ====================================================================== */
export async function carregarTudo(): Promise<Snapshot> {
  return carregar(getSupabase() as SupabaseClient | null);
}

/** Versão para Server Components (landing pública). */
export async function carregarPublico(): Promise<Snapshot> {
  return carregar(getSupabaseAnon());
}

async function carregar(sb: SupabaseClient | null): Promise<Snapshot> {
  if (!sb) return snapshotDemo();

  try {
    const [rCursos, rTalentos, rVagas, rCerts, rHabs] = await Promise.all([
      sb
        .from("cursos")
        .select(
          `id, slug, titulo, subtitulo, descricao, categoria, nivel, cor,
           instrutor, instrutor_cargo, carga_horaria, pontos_pepc, alunos, nota,
           tags, destaque, novo,
           modulos ( id, titulo, resumo, ordem,
             aulas ( id, titulo, descricao, tipo, duracao_min, ordem, gratuita,
                     video_origem, video_path, video_url, video_nome,
                     quiz_ativo, quiz_qtd, quiz_minimo, quiz_tentativas ) )`
        )
        .eq("publicado", true)
        .order("destaque", { ascending: false }),

      sb
        .from("perfis")
        .select(
          `id, nome, email, role, cidade, uf, crc, cargo, bio, senioridade,
           pretensao, linkedin, telefone, contato_publico, disponivel, plano,
           pontos, nivel, ofensiva, ultimo_estudo,
           ${SELECT_HABILIDADES}`
        )
        .eq("perfil_publico", true)
        .order("pontos", { ascending: false }),

      sb
        .from("vagas")
        .select(
          `id, titulo, descricao, cidade, uf, modelo, contrato, faixa, senioridade,
           requisitos, cursos_desejados, trilhas_desejadas, publicada_em,
           empresas ( nome, cor ),
           candidaturas ( count )`
        )
        .eq("ativa", true)
        .order("publicada_em", { ascending: false }),

      sb
        .from("certificados")
        .select(
          `id, perfil_id, codigo, carga_horaria, pontos_pepc, emitido_em,
           cursos ( slug, titulo )`
        ),

      sb.from("habilidades").select("nome").order("nome"),
    ]);

    const [trilhas, certificadosTrilha] = await Promise.all([
      carregarTrilhas(),
      carregarCertificadosTrilha(),
    ]);

    const erro =
      rCursos.error ?? rTalentos.error ?? rVagas.error ?? rCerts.error ?? rHabs.error;
    if (erro) throw erro;

    const cursos = ((rCursos.data ?? []) as unknown as LinhaCurso[]).map(mapCurso);
    const slugPorId = new Map(cursos.map((c) => [c.id!, c.slug]));
    const trilhaSlugPorId = new Map(trilhas.map((t) => [t.id, t.slug]));

    return {
      cursos,
      trilhas,
      certificadosTrilha,
      talentos: ((rTalentos.data ?? []) as unknown as LinhaPerfil[]).map(mapPerfil),
      vagas: ((rVagas.data ?? []) as unknown as LinhaVaga[]).map((v) =>
        mapVaga(v, slugPorId, trilhaSlugPorId)
      ),
      certificados: ((rCerts.data ?? []) as unknown as LinhaCert[]).map(mapCertificado),
      habilidades: ((rHabs.data ?? []) as Array<{ nome: string }>).map((h) => h.nome),
      origem: "supabase",
    };
  } catch (e) {
    const msg = msgErro(e);
    console.error("[repo] falha ao carregar do Supabase, usando seed local:", msg);
    return { ...snapshotDemo(), erro: msg };
  }
}

/* ======================================================================
   Match vaga ↔ candidato — regras explicáveis (ver dossiê, seção 4.5)
   ====================================================================== */
const ORDEM_SENIORIDADE = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];

export function calcularMatch(
  vaga: Vaga,
  perfil: Perfil | null,
  certificados: Certificado[],
  certificadosTrilha: CertificadoTrilha[] = []
): number | undefined {
  if (!perfil) return undefined;

  // 30% — formação pedida pela vaga.
  // A trilha completa vale mais que o curso avulso: é o selo que a empresa
  // realmente pede ("precisa ter a trilha de Analista Fiscal").
  const pedidas = vaga.certificacoesDesejadas;
  const trilhasPedidas = vaga.trilhasDesejadas ?? [];
  const concluidas = new Set(certificados.map((c) => c.cursoSlug));
  const trilhasFeitas = new Set(certificadosTrilha.map((c) => c.trilhaSlug));

  const sCurso = pedidas.length
    ? pedidas.filter((s) => concluidas.has(s)).length / pedidas.length
    : 0.5;
  const sTrilha = trilhasPedidas.length
    ? trilhasPedidas.filter((s) => trilhasFeitas.has(s)).length / trilhasPedidas.length
    : null;

  // Com trilha exigida, ela pesa 60% do critério de formação.
  const sCert = sTrilha === null ? sCurso : sTrilha * 0.6 + sCurso * 0.4;

  // 25% — habilidades
  const minhas = (perfil.habilidades ?? []).map((h) => h.toLowerCase());
  const req = vaga.requisitos.map((r) => r.toLowerCase());
  const bateu = req.filter((r) => minhas.some((h) => r.includes(h) || h.includes(r)));
  const sHab = req.length ? bateu.length / req.length : 0.5;

  // 15% — senioridade
  const iVaga = ORDEM_SENIORIDADE.indexOf(vaga.senioridade);
  const iPerfil = ORDEM_SENIORIDADE.indexOf(perfil.senioridade ?? "");
  const dist = iVaga >= 0 && iPerfil >= 0 ? Math.abs(iVaga - iPerfil) : 2;
  const sSen = dist === 0 ? 1 : dist === 1 ? 0.6 : 0;

  // 15% — localização
  const sLoc =
    vaga.modelo === "Remoto"
      ? 1
      : perfil.cidade && vaga.cidade === perfil.cidade
        ? 1
        : vaga.uf === perfil.uf
          ? 0.7
          : 0.2;

  // 10% — atividade e completude do perfil
  const sAtiv =
    (perfil.disponivel ? 0.4 : 0) +
    (perfil.bio ? 0.3 : 0) +
    ((perfil.habilidades?.length ?? 0) >= 4 ? 0.3 : 0);

  // 5% — faixa salarial declarada
  const sFaixa = perfil.pretensao ? 0.8 : 0.4;

  const score =
    sCert * 30 + sHab * 25 + sSen * 15 + sLoc * 15 + sAtiv * 10 + sFaixa * 5;

  return Math.round(Math.min(99, Math.max(12, score)));
}

/* ======================================================================
   Área administrativa — todos os perfis, não só os públicos.
   O RLS só devolve a lista completa para quem tem role = 'admin'
   (policy "perfis: admin lê tudo", via public.is_admin()).
   ====================================================================== */
export async function carregarAlunos(): Promise<Perfil[]> {
  const sb = getSupabase();
  if (!sb) return talentosDemo;

  const { data, error } = await sb
    .from("perfis")
    .select(
      `id, nome, email, role, cidade, uf, crc, cargo, bio, senioridade,
       pretensao, linkedin, telefone, contato_publico, disponivel, plano,
       pontos, nivel, ofensiva, ultimo_estudo, ativo, ultimo_acesso,
       motivo_desativacao, ${SELECT_HABILIDADES}`
    )
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[repo] falha ao listar alunos:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as LinhaPerfil[]).map(mapPerfil);
}

/* ======================================================================
   Perfil avulso por id

   O banco de talentos só carrega quem marcou `perfil_publico`. Quando o
   administrador abre a ficha de alguém que não está publicado, a lista em
   memória não tem a pessoa e a tela dava "não encontrado" — mesmo com o
   RLS permitindo a leitura. Esta função é o caminho direto.
   ====================================================================== */
export async function carregarPerfilPorId(id: string): Promise<Perfil | null> {
  const sb = getSupabase();
  if (!sb) return talentosDemo.find((t) => t.id === id) ?? null;

  const { data, error } = await sb
    .from("perfis")
    .select(
      `id, nome, email, role, cidade, uf, crc, cargo, bio, senioridade,
       pretensao, linkedin, telefone, contato_publico, disponivel, plano,
       pontos, nivel, ofensiva, ultimo_estudo, ativo, ultimo_acesso,
       motivo_desativacao, ${SELECT_HABILIDADES}`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[repo] perfil por id:", error.message);
    return null;
  }
  return mapPerfil(data as unknown as LinhaPerfil);
}

/** Certificados de curso de uma pessoa, buscados na hora. */
export async function certificadosDoPerfil(id: string): Promise<Certificado[]> {
  const sb = getSupabase();
  if (!sb) return certificadosDemo;

  const { data, error } = await sb
    .from("certificados")
    .select(
      `id, perfil_id, codigo, carga_horaria, pontos_pepc, emitido_em,
       cursos ( slug, titulo )`
    )
    .eq("perfil_id", id)
    .order("emitido_em", { ascending: false });

  if (error) {
    console.error("[repo] certificados do perfil:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as LinhaCert[]).map(mapCertificado);
}

/** Selos de trilha de uma pessoa, com as habilidades que cada selo cobre. */
export async function selosDeTrilhaDoPerfil(id: string) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("certificados_trilha")
    .select(
      `codigo, carga_horaria, pontos_pepc, emitido_em,
       trilhas ( slug, nome, cor, trilha_habilidades ( nivel_esperado, habilidades ( nome ) ) )`
    )
    .eq("perfil_id", id);

  if (error) {
    console.error("[repo] selos de trilha:", error.message);
    return [];
  }

  type L = {
    codigo: string; carga_horaria: number; pontos_pepc: number; emitido_em: string;
    trilhas: {
      slug: string; nome: string; cor: string;
      trilha_habilidades: Array<{ nivel_esperado: number; habilidades: { nome: string } | null }>;
    } | null;
  };

  return ((data ?? []) as unknown as L[])
    .filter((r) => r.trilhas)
    .map((r) => ({
      slug: r.trilhas!.slug,
      nome: r.trilhas!.nome,
      cor: r.trilhas!.cor,
      codigo: r.codigo,
      cargaHoraria: r.carga_horaria,
      pontosPEPC: r.pontos_pepc,
      emitidoEm: r.emitido_em,
      habilidades: (r.trilhas!.trilha_habilidades ?? [])
        .sort((a, b) => b.nivel_esperado - a.nivel_esperado)
        .map((h) => h.habilidades?.nome)
        .filter((n): n is string => Boolean(n)),
    }));
}
