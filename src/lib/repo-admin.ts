import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Curso, QuestaoAula, Trilha } from "./types";

/* ==========================================================================
   REPOSITÓRIO ADMINISTRATIVO

   Escreve no catálogo. Tudo aqui depende do RLS `public.is_admin()`: se quem
   chamar não for admin, o Postgres devolve 0 linhas em vez de erro — por isso
   as funções conferem o retorno e não só o `error`.

   No modo demonstração não há banco para escrever. Em vez de fingir que
   salvou, as funções devolvem um aviso claro: a área administrativa é a única
   parte do sistema que exige Supabase.
   ========================================================================== */

export const SEM_BANCO =
  "A área administrativa grava no banco. Troque a chave no topo para “Supabase” e tente de novo.";

export interface Resultado<T = void> {
  ok: boolean;
  erro?: string;
  dado?: T;
}

function falha(e: unknown): Resultado<never> {
  return { ok: false, erro: msgErro(e) };
}

export function gerarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ======================================================================
   CURSOS — leitura completa (inclui rascunho)
   ====================================================================== */
type LinhaAulaAdmin = {
  id: string; titulo: string; descricao: string | null; tipo: string;
  duracao_min: number; ordem: number; gratuita: boolean;
  video_origem: string; video_path: string | null; video_url: string | null;
  video_nome: string | null;
  quiz_ativo: boolean; quiz_qtd: number; quiz_minimo: number; quiz_tentativas: number;
  questoes: Array<{ count: number }>;
};

type LinhaModuloAdmin = {
  id: string; titulo: string; resumo: string | null; ordem: number;
  aulas: LinhaAulaAdmin[];
};

type LinhaCursoAdmin = {
  id: string; slug: string; titulo: string; subtitulo: string | null;
  descricao: string | null; categoria: string; nivel: string; cor: string;
  instrutor: string | null; instrutor_cargo: string | null;
  instrutor_registro: string | null; instrutor_assinatura_url: string | null;
  carga_horaria: number; pontos_pepc: number; alunos: number; nota: number;
  tags: string[] | null; destaque: boolean; novo: boolean; publicado: boolean;
  criado_em: string;
  modulos: LinhaModuloAdmin[];
};

/** Curso da área administrativa: tem rascunho, contagem de questões e vídeo. */
export interface CursoAdmin extends Curso {
  id: string;
  publicado: boolean;
  criadoEm: string;
  modulos: Array<{
    id: string;
    titulo: string;
    resumo?: string;
    ordem: number;
    aulas: Array<{
      id: string;
      titulo: string;
      descricao?: string;
      tipo: "video" | "quiz" | "material" | "ao-vivo";
      duracaoMin: number;
      ordem: number;
      gratuita: boolean;
      videoOrigem: "nenhum" | "upload" | "youtube" | "vimeo" | "externo";
      videoPath?: string;
      videoUrl?: string;
      videoNome?: string;
      quizAtivo: boolean;
      quizQtd: number;
      quizMinimo: number;
      quizTentativas: number;
      totalQuestoes: number;
    }>;
  }>;
}

const SELECT_CURSO_ADMIN = `
  id, slug, titulo, subtitulo, descricao, categoria, nivel, cor,
  instrutor, instrutor_cargo, instrutor_registro, instrutor_assinatura_url,
  carga_horaria, pontos_pepc, alunos, nota,
  tags, destaque, novo, publicado, criado_em,
  modulos ( id, titulo, resumo, ordem,
    aulas ( id, titulo, descricao, tipo, duracao_min, ordem, gratuita,
            video_origem, video_path, video_url, video_nome,
            quiz_ativo, quiz_qtd, quiz_minimo, quiz_tentativas,
            questoes ( count ) ) )
`;

function mapCursoAdmin(r: LinhaCursoAdmin): CursoAdmin {
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.titulo,
    subtitulo: r.subtitulo ?? "",
    descricao: r.descricao ?? "",
    categoria: r.categoria,
    nivel: r.nivel as Curso["nivel"],
    instrutor: r.instrutor ?? "",
    instrutorCargo: r.instrutor_cargo ?? "",
    instrutorRegistro: r.instrutor_registro ?? "",
    instrutorAssinaturaUrl: r.instrutor_assinatura_url ?? "",
    cargaHoraria: r.carga_horaria,
    pontosPEPC: r.pontos_pepc,
    alunos: r.alunos,
    nota: Number(r.nota),
    tags: r.tags ?? [],
    destaque: r.destaque,
    novo: r.novo,
    cor: r.cor,
    publicado: r.publicado,
    criadoEm: r.criado_em,
    modulos: [...(r.modulos ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => ({
        id: m.id,
        titulo: m.titulo,
        resumo: m.resumo ?? undefined,
        ordem: m.ordem,
        aulas: [...(m.aulas ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .map((a) => ({
            id: a.id,
            titulo: a.titulo,
            descricao: a.descricao ?? undefined,
            tipo: a.tipo as "video" | "quiz" | "material" | "ao-vivo",
            duracaoMin: a.duracao_min,
            ordem: a.ordem,
            gratuita: a.gratuita,
            videoOrigem: (a.video_origem ?? "nenhum") as CursoAdmin["modulos"][0]["aulas"][0]["videoOrigem"],
            videoPath: a.video_path ?? undefined,
            videoUrl: a.video_url ?? undefined,
            videoNome: a.video_nome ?? undefined,
            quizAtivo: a.quiz_ativo,
            quizQtd: a.quiz_qtd,
            quizMinimo: a.quiz_minimo,
            quizTentativas: a.quiz_tentativas,
            totalQuestoes: a.questoes?.[0]?.count ?? 0,
          })),
      })),
  };
}

export async function carregarCursosAdmin(): Promise<Resultado<CursoAdmin[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO, dado: [] };

  const { data, error } = await sb
    .from("cursos")
    .select(SELECT_CURSO_ADMIN)
    .order("criado_em", { ascending: false });

  if (error) return { ok: false, erro: msgErro(error), dado: [] };
  return {
    ok: true,
    dado: ((data ?? []) as unknown as LinhaCursoAdmin[]).map(mapCursoAdmin),
  };
}

/* ------------------------------------------------------------- escrita -- */
export interface DadosCurso {
  id?: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  categoria: string;
  nivel: string;
  cor: string;
  /** Obrigatório: é quem assina o certificado de quem concluir. */
  instrutor: string;
  instrutorCargo: string;
  instrutorRegistro?: string;
  instrutorAssinaturaUrl?: string;
  cargaHoraria: number;
  pontosPEPC: number;
  tags: string[];
  destaque: boolean;
  publicado: boolean;
}

/**
 * Sobe a imagem da assinatura do docente.
 *
 * Vai para o bucket `capas`, que já é público e só aceita imagem — assinatura
 * é peça de arte do certificado, não arquivo restrito, e o certificado é
 * exibido para quem confere o código sem ter conta.
 */
export async function enviarAssinaturaDocente(
  arquivo: File,
  cursoSlug: string
): Promise<{ url?: string; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: SEM_BANCO };
  if (!arquivo.type.startsWith("image/")) {
    return { erro: "A assinatura precisa ser uma imagem (PNG com fundo transparente é o ideal)." };
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { erro: "A imagem tem mais de 2 MB. Reduza antes de enviar." };
  }

  const ext = (arquivo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `assinaturas/${cursoSlug || "curso"}-${Date.now()}.${ext}`;

  const { error } = await sb.storage
    .from("capas")
    .upload(path, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) return { erro: msgErro(error) };

  const { data } = sb.storage.from("capas").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function salvarCurso(d: DadosCurso): Promise<Resultado<string>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  // O docente não é um adorno do catálogo: é quem assina o certificado de quem
  // concluir. Curso sem docente emitiria diploma sem assinatura, então a
  // recusa vem antes do banco (que também tem a própria trava).
  if (!d.instrutor.trim()) {
    return {
      ok: false,
      erro: "Informe o docente que ministra o curso — é a assinatura do certificado.",
    };
  }

  const linha = {
    slug: d.slug,
    titulo: d.titulo,
    subtitulo: d.subtitulo || null,
    descricao: d.descricao || null,
    categoria: d.categoria,
    nivel: d.nivel,
    cor: d.cor,
    instrutor: d.instrutor.trim() || null,
    instrutor_cargo: d.instrutorCargo.trim() || null,
    instrutor_registro: d.instrutorRegistro?.trim() || null,
    instrutor_assinatura_url: d.instrutorAssinaturaUrl?.trim() || null,
    carga_horaria: d.cargaHoraria,
    pontos_pepc: d.pontosPEPC,
    tags: d.tags,
    destaque: d.destaque,
    publicado: d.publicado,
  };

  try {
    if (d.id) {
      const { data, error } = await sb
        .from("cursos").update(linha).eq("id", d.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, erro: "Nada foi atualizado — confira se sua conta é admin." };
      return { ok: true, dado: data.id as string };
    }
    const { data, error } = await sb
      .from("cursos").insert(linha).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, erro: "O curso não foi criado — confira se sua conta é admin." };
    return { ok: true, dado: data.id as string };
  } catch (e) {
    return falha(e);
  }
}

export async function apagarCurso(id: string): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("cursos").delete().eq("id", id);
  return error ? falha(error) : { ok: true };
}

export async function publicarCurso(id: string, publicado: boolean): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("cursos").update({ publicado }).eq("id", id);
  return error ? falha(error) : { ok: true };
}

/* ======================================================================
   MÓDULOS
   ====================================================================== */
export async function salvarModulo(d: {
  id?: string; cursoId: string; titulo: string; resumo: string; ordem?: number;
}): Promise<Resultado<string>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  try {
    if (d.id) {
      const { error } = await sb
        .from("modulos")
        .update({ titulo: d.titulo, resumo: d.resumo || null })
        .eq("id", d.id);
      if (error) throw error;
      return { ok: true, dado: d.id };
    }

    // Nova posição = fim da lista.
    const { data: ultimos } = await sb
      .from("modulos").select("ordem").eq("curso_id", d.cursoId)
      .order("ordem", { ascending: false }).limit(1);
    const ordem = d.ordem ?? ((ultimos?.[0]?.ordem as number | undefined) ?? 0) + 1;

    const { data, error } = await sb
      .from("modulos")
      .insert({ curso_id: d.cursoId, titulo: d.titulo, resumo: d.resumo || null, ordem })
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, erro: "O módulo não foi criado — confira se sua conta é admin." };
    return { ok: true, dado: data.id as string };
  } catch (e) {
    return falha(e);
  }
}

export async function apagarModulo(id: string): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("modulos").delete().eq("id", id);
  return error ? falha(error) : { ok: true };
}

/* ======================================================================
   AULAS
   ====================================================================== */
export interface DadosAula {
  id?: string;
  moduloId: string;
  titulo: string;
  descricao: string;
  tipo: string;
  duracaoMin: number;
  gratuita: boolean;
  videoOrigem: string;
  videoPath?: string | null;
  videoUrl?: string | null;
  videoNome?: string | null;
  videoBytes?: number | null;
  quizAtivo: boolean;
  quizQtd: number;
  quizMinimo: number;
  quizTentativas: number;
}

export async function salvarAula(d: DadosAula): Promise<Resultado<string>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  const linha = {
    titulo: d.titulo,
    descricao: d.descricao || null,
    tipo: d.tipo,
    duracao_min: d.duracaoMin,
    gratuita: d.gratuita,
    video_origem: d.videoOrigem,
    video_path: d.videoPath ?? null,
    video_url: d.videoUrl ?? null,
    video_nome: d.videoNome ?? null,
    video_bytes: d.videoBytes ?? null,
    quiz_ativo: d.quizAtivo,
    quiz_qtd: d.quizQtd,
    quiz_minimo: d.quizMinimo,
    quiz_tentativas: d.quizTentativas,
  };

  try {
    if (d.id) {
      const { error } = await sb.from("aulas").update(linha).eq("id", d.id);
      if (error) throw error;
      return { ok: true, dado: d.id };
    }

    const { data: ultimos } = await sb
      .from("aulas").select("ordem").eq("modulo_id", d.moduloId)
      .order("ordem", { ascending: false }).limit(1);
    const ordem = ((ultimos?.[0]?.ordem as number | undefined) ?? 0) + 1;

    const { data, error } = await sb
      .from("aulas")
      .insert({ ...linha, modulo_id: d.moduloId, ordem })
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, erro: "A aula não foi criada — confira se sua conta é admin." };
    return { ok: true, dado: data.id as string };
  } catch (e) {
    return falha(e);
  }
}

export async function apagarAula(id: string): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("aulas").delete().eq("id", id);
  return error ? falha(error) : { ok: true };
}

/**
 * Troca a posição de duas aulas (ou dois módulos).
 * A unicidade de `ordem` foi removida no 08 justamente para isto: sem
 * transação no cliente, a troca passa por um instante com valores iguais.
 */
export async function trocarOrdem(
  tabela: "aulas" | "modulos",
  a: { id: string; ordem: number },
  b: { id: string; ordem: number }
): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const [r1, r2] = await Promise.all([
    sb.from(tabela).update({ ordem: b.ordem }).eq("id", a.id),
    sb.from(tabela).update({ ordem: a.ordem }).eq("id", b.id),
  ]);
  const erro = r1.error ?? r2.error;
  return erro ? falha(erro) : { ok: true };
}

/* ======================================================================
   QUESTÕES DA AULA
   ====================================================================== */
type LinhaQuestao = {
  id: string; enunciado: string; alternativas: Array<{ id: string; texto: string }>;
  correta: string; explicacao: string | null; ordem: number;
};

export async function questoesDaAula(aulaId: string): Promise<Resultado<QuestaoAula[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO, dado: [] };

  const { data, error } = await sb
    .from("questoes")
    .select("id, enunciado, alternativas, correta, explicacao, ordem")
    .eq("aula_id", aulaId)
    .order("ordem");

  if (error) return { ok: false, erro: msgErro(error), dado: [] };
  return {
    ok: true,
    dado: ((data ?? []) as unknown as LinhaQuestao[]).map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      alternativas: q.alternativas ?? [],
      correta: q.correta,
      explicacao: q.explicacao ?? undefined,
      ordem: q.ordem,
    })),
  };
}

/**
 * Substitui todas as questões da aula pela lista revisada.
 * Apagar e reinserir é aceitável porque as tentativas guardam a resposta em
 * jsonb, não uma FK para a questão — o histórico do aluno não se perde.
 */
export async function salvarQuestoesDaAula(
  aulaId: string,
  questoes: Array<{ enunciado: string; alternativas: Array<{ id: string; texto: string }>; correta: string; explicacao?: string }>,
  geradaPorIA: boolean
): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  try {
    const { error: eDel } = await sb.from("questoes").delete().eq("aula_id", aulaId);
    if (eDel) throw eDel;

    if (questoes.length) {
      const { error } = await sb.from("questoes").insert(
        questoes.map((q, i) => ({
          aula_id: aulaId,
          enunciado: q.enunciado,
          alternativas: q.alternativas,
          correta: q.correta,
          explicacao: q.explicacao ?? null,
          gerada_por_ia: geradaPorIA,
          revisada: true,          // só chega aqui depois de o admin confirmar
          ordem: i + 1,
        }))
      );
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

/* ======================================================================
   TRILHAS
   ====================================================================== */
export interface TrilhaAdmin extends Trilha {
  publicada: boolean;
  ordem: number;
  cursoIds: string[];
  cursosDetalhe: Array<{ cursoId: string; ordem: number; obrigatorio: boolean }>;
  habilidadeIds: Array<{ habilidadeId: string; nivelEsperado: number }>;
}

type LinhaTrilhaAdmin = {
  id: string; slug: string; nome: string; subtitulo: string | null;
  descricao: string | null; cargo_alvo: string; area: string;
  nivel_entrada: string; nivel_saida: string; cor: string; icone: string | null;
  faixa_salarial: string | null; ordem: number; publicada: boolean;
  trilha_cursos: Array<{
    curso_id: string; ordem: number; obrigatorio: boolean;
    cursos: { slug: string; titulo: string; carga_horaria: number; pontos_pepc: number } | null;
  }>;
  trilha_habilidades: Array<{
    habilidade_id: string; nivel_esperado: number;
    habilidades: { nome: string } | null;
  }>;
};

export async function carregarTrilhasAdmin(): Promise<Resultado<TrilhaAdmin[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO, dado: [] };

  const { data, error } = await sb
    .from("trilhas")
    .select(
      `id, slug, nome, subtitulo, descricao, cargo_alvo, area, nivel_entrada,
       nivel_saida, cor, icone, faixa_salarial, ordem, publicada,
       trilha_cursos ( curso_id, ordem, obrigatorio,
         cursos ( slug, titulo, carga_horaria, pontos_pepc ) ),
       trilha_habilidades ( habilidade_id, nivel_esperado, habilidades ( nome ) )`
    )
    .order("ordem");

  if (error) return { ok: false, erro: msgErro(error), dado: [] };

  const trilhas = ((data ?? []) as unknown as LinhaTrilhaAdmin[]).map((r) => {
    const tc = [...(r.trilha_cursos ?? [])].sort((a, b) => a.ordem - b.ordem);
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
      publicada: r.publicada,
      ordem: r.ordem,
      cursos: tc
        .filter((x) => x.cursos)
        .map((x) => ({
          slug: x.cursos!.slug,
          titulo: x.cursos!.titulo,
          ordem: x.ordem,
          obrigatorio: x.obrigatorio,
          cargaHoraria: x.cursos!.carga_horaria,
        })),
      cursoIds: tc.map((x) => x.curso_id),
      cursosDetalhe: tc.map((x) => ({
        cursoId: x.curso_id, ordem: x.ordem, obrigatorio: x.obrigatorio,
      })),
      habilidades: (r.trilha_habilidades ?? [])
        .filter((h) => h.habilidades)
        .sort((a, b) => b.nivel_esperado - a.nivel_esperado)
        .map((h) => ({ nome: h.habilidades!.nome, nivelEsperado: h.nivel_esperado })),
      habilidadeIds: (r.trilha_habilidades ?? []).map((h) => ({
        habilidadeId: h.habilidade_id, nivelEsperado: h.nivel_esperado,
      })),
      cargaHoraria: tc.reduce((a, x) => a + (x.cursos?.carga_horaria ?? 0), 0),
      pontosPEPC: tc.reduce((a, x) => a + (x.cursos?.pontos_pepc ?? 0), 0),
    } satisfies TrilhaAdmin;
  });

  return { ok: true, dado: trilhas };
}

export interface DadosTrilha {
  id?: string;
  slug: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  cargoAlvo: string;
  area: string;
  nivelEntrada: string;
  nivelSaida: string;
  cor: string;
  faixaSalarial: string;
  publicada: boolean;
}

export async function salvarTrilha(d: DadosTrilha): Promise<Resultado<string>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  const linha = {
    slug: d.slug,
    nome: d.nome,
    subtitulo: d.subtitulo || null,
    descricao: d.descricao || null,
    cargo_alvo: d.cargoAlvo,
    area: d.area,
    nivel_entrada: d.nivelEntrada,
    nivel_saida: d.nivelSaida,
    cor: d.cor,
    faixa_salarial: d.faixaSalarial || null,
    publicada: d.publicada,
  };

  try {
    if (d.id) {
      const { error } = await sb.from("trilhas").update(linha).eq("id", d.id);
      if (error) throw error;
      return { ok: true, dado: d.id };
    }
    const { data: ultimos } = await sb
      .from("trilhas").select("ordem").order("ordem", { ascending: false }).limit(1);
    const ordem = ((ultimos?.[0]?.ordem as number | undefined) ?? 0) + 1;

    const { data, error } = await sb
      .from("trilhas").insert({ ...linha, ordem }).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, erro: "A trilha não foi criada — confira se sua conta é admin." };
    return { ok: true, dado: data.id as string };
  } catch (e) {
    return falha(e);
  }
}

export async function apagarTrilha(id: string): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("trilhas").delete().eq("id", id);
  return error ? falha(error) : { ok: true };
}

export async function publicarTrilha(id: string, publicada: boolean): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("trilhas").update({ publicada }).eq("id", id);
  return error ? falha(error) : { ok: true };
}

/** Substitui a lista de cursos da trilha. A ordem é a da lista recebida. */
export async function definirCursosDaTrilha(
  trilhaId: string,
  cursos: Array<{ cursoId: string; obrigatorio: boolean }>
): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  try {
    const { error: eDel } = await sb.from("trilha_cursos").delete().eq("trilha_id", trilhaId);
    if (eDel) throw eDel;
    if (cursos.length) {
      const { error } = await sb.from("trilha_cursos").insert(
        cursos.map((c, i) => ({
          trilha_id: trilhaId, curso_id: c.cursoId, ordem: i + 1, obrigatorio: c.obrigatorio,
        }))
      );
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function definirHabilidadesDaTrilha(
  trilhaId: string,
  habilidades: Array<{ habilidadeId: string; nivelEsperado: number }>
): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  try {
    const { error: eDel } = await sb.from("trilha_habilidades").delete().eq("trilha_id", trilhaId);
    if (eDel) throw eDel;
    if (habilidades.length) {
      const { error } = await sb.from("trilha_habilidades").insert(
        habilidades.map((h) => ({
          trilha_id: trilhaId, habilidade_id: h.habilidadeId, nivel_esperado: h.nivelEsperado,
        }))
      );
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

/** Catálogo de habilidades para os seletores. */
export async function listarHabilidades(): Promise<Array<{ id: string; nome: string }>> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from("habilidades").select("id, nome").order("nome");
  return (data ?? []) as Array<{ id: string; nome: string }>;
}

/**
 * Reemite os selos de quem já tinha os certificados antes de a trilha existir.
 * O trigger só dispara em certificado novo — sem isto o aluno veterano fica de
 * fora da trilha recém-criada.
 */
export async function recalcularSelos(): Promise<Resultado<number>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { data, error } = await sb.rpc("backfill_selos_trilha");
  if (error) return falha(error);
  return { ok: true, dado: (data as number) ?? 0 };
}

/* ==========================================================================
   HABILIDADES CONCEDIDAS PELO CURSO

   Define o que o aluno ganha no perfil ao concluir. É a ponte entre o
   catálogo e o banco de talentos: sem nenhuma habilidade marcada, o curso
   emite certificado mas não acrescenta nada ao perfil de quem o fez.
   ========================================================================== */

export async function habilidadesDoCurso(cursoId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("curso_habilidades")
    .select("habilidade_id")
    .eq("curso_id", cursoId);
  return ((data ?? []) as Array<{ habilidade_id: string }>).map((h) => h.habilidade_id);
}

/**
 * Substitui a lista do curso.
 *
 * Tirar uma habilidade daqui NÃO tira o selo de quem já concluiu: o selo é do
 * momento em que a pessoa passou, e retroagir seria apagar conquista por uma
 * decisão de catálogo.
 */
export async function definirHabilidadesDoCurso(
  cursoId: string,
  habilidadeIds: string[]
): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  try {
    const { data } = await sb
      .from("curso_habilidades")
      .select("habilidade_id")
      .eq("curso_id", cursoId);

    const atuais = ((data ?? []) as Array<{ habilidade_id: string }>).map(
      (h) => h.habilidade_id
    );
    const remover = atuais.filter((id) => !habilidadeIds.includes(id));
    const adicionar = habilidadeIds.filter((id) => !atuais.includes(id));

    if (remover.length) {
      const { error } = await sb
        .from("curso_habilidades")
        .delete()
        .eq("curso_id", cursoId)
        .in("habilidade_id", remover);
      if (error) throw error;
    }

    if (adicionar.length) {
      const { error } = await sb
        .from("curso_habilidades")
        .insert(adicionar.map((habilidade_id) => ({ curso_id: cursoId, habilidade_id })));
      if (error) throw error;
    }

    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}
