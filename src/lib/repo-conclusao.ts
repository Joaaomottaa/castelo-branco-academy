import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { ResumoConclusao } from "./types";

/* ==========================================================================
   CONCLUSÃO DE CURSO

   O certificado nunca foi emitido pelo navegador: quem emite é o trigger
   `checar_conclusao_curso`, quando a última aula é marcada. Isso é
   proposital — certificado emitido pelo cliente é certificado que se emite
   pelo console.

   O que faltava era o outro lado: a pessoa terminava, o certificado nascia
   no banco e a tela não contava. Estas funções trazem o resultado de volta.
   ========================================================================== */

export async function resumoConclusao(
  cursoId: string
): Promise<{ resumo?: ResumoConclusao; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { resumo: resumoDemo() };

  const { data, error } = await sb.rpc("resumo_conclusao_curso", { p_curso: cursoId });
  if (error) return { erro: msgErro(error) };
  return { resumo: data as ResumoConclusao };
}

/* ---------------------------------------------------------- avaliações -- */
/**
 * A avaliação é pedida uma única vez, quando o curso inteiro fecha — nunca
 * aula a aula. Pedir nota a cada vídeo transforma a pergunta em ruído e a
 * resposta em clique automático.
 *
 * Nota e comentário são opcionais dos dois lados: quem só quer o certificado
 * fecha a caixa e segue.
 */
export async function avaliarCurso(
  cursoId: string,
  nota: number | null,
  comentario: string
): Promise<{ erro?: string }> {
  const sb = getSupabase();
  if (!sb) return {};

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { erro: "Sessão expirada." };

  const { error } = await sb.from("avaliacoes_curso").upsert(
    {
      perfil_id: uid,
      curso_id: cursoId,
      nota,
      comentario: comentario.trim() || null,
    },
    { onConflict: "perfil_id,curso_id" }
  );

  return error ? { erro: msgErro(error) } : {};
}

export async function avaliarTrilha(
  trilhaId: string,
  nota: number | null,
  comentario: string
): Promise<{ erro?: string }> {
  const sb = getSupabase();
  if (!sb) return {};

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { erro: "Sessão expirada." };

  const { error } = await sb.from("avaliacoes_trilha").upsert(
    { perfil_id: uid, trilha_id: trilhaId, nota, comentario: comentario.trim() || null },
    { onConflict: "perfil_id,trilha_id" }
  );

  return error ? { erro: msgErro(error) } : {};
}

/** Id da trilha pelo slug — a avaliação grava por id, a tela conhece o slug. */
export async function idDaTrilha(slug: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("trilhas").select("id").eq("slug", slug).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/* --------------------------------------------------------- modo demo ----- */
function resumoDemo(): ResumoConclusao {
  return {
    totalAulas: 6,
    aulasFeitas: 6,
    concluido: true,
    certificado: {
      codigo: "CBA-2026-DEMO-01",
      cargaHoraria: 18,
      pontosPEPC: 18,
      emitidoEm: new Date().toISOString(),
    },
    habilidades: [
      { nome: "Reforma Tributária", selo: "ouro" },
      { nome: "Planejamento tributário", selo: "ouro" },
      { nome: "Lucro Real", selo: "ouro" },
    ],
    trilhas: [],
    avaliado: false,
  };
}
