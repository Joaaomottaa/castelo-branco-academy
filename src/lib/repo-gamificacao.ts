import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Conquista, DiaEstudo, EventoXP, Missao } from "./types";

/* ==========================================================================
   GAMIFICAÇÃO — conquistas, missões, extrato de XP e ofensiva
   ========================================================================== */

export interface PainelGamificacao {
  conquistas: Conquista[];
  missoes: Missao[];
  eventos: EventoXP[];
  estudo: DiaEstudo[];
  origem: "supabase" | "demo";
}

/** Segunda-feira da semana atual, em ISO — é o "ciclo" das missões. */
export function cicloAtual(d = new Date()): string {
  const data = new Date(d);
  const diaSemana = (data.getDay() + 6) % 7; // 0 = segunda
  data.setDate(data.getDate() - diaSemana);
  return data.toISOString().slice(0, 10);
}

export async function carregarGamificacao(perfilId?: string): Promise<PainelGamificacao> {
  const sb = getSupabase();
  if (!sb || !perfilId) return painelDemo();

  try {
    const ciclo = cicloAtual();
    const [rConq, rObtidas, rMiss, rProg, rXP, rEstudo] = await Promise.all([
      sb.from("conquistas").select("*").order("ordem"),
      sb.from("perfil_conquistas").select("conquista_id, obtida_em").eq("perfil_id", perfilId),
      sb.from("missoes").select("*").eq("ativa", true).order("periodo").order("ordem"),
      sb.from("perfil_missoes").select("missao_id, progresso, concluida_em")
        .eq("perfil_id", perfilId).eq("ciclo", ciclo),
      sb.from("eventos_xp").select("id, tipo, xp, descricao, criado_em")
        .eq("perfil_id", perfilId).order("criado_em", { ascending: false }).limit(20),
      sb.from("estudo_diario").select("dia, minutos, aulas")
        .eq("perfil_id", perfilId).order("dia", { ascending: false }).limit(30),
    ]);

    const erro = rConq.error ?? rMiss.error;
    if (erro) throw erro;

    const obtidas = new Map(
      ((rObtidas.data ?? []) as Array<{ conquista_id: string; obtida_em: string }>)
        .map((o) => [o.conquista_id, o.obtida_em])
    );
    const progresso = new Map(
      ((rProg.data ?? []) as Array<{ missao_id: string; progresso: number; concluida_em: string | null }>)
        .map((m) => [m.missao_id, m])
    );

    type LConq = {
      id: string; slug: string; nome: string; descricao: string | null; icone: string;
      xp: number; categoria: string; raridade: string; recompensa: string | null;
      criterio: Conquista["criterio"];
    };
    type LMiss = {
      id: string; slug: string; titulo: string; descricao: string | null; icone: string;
      periodo: string; metrica: string; meta: number; xp: number; recompensa: string | null;
    };

    return {
      conquistas: ((rConq.data ?? []) as unknown as LConq[]).map((c) => ({
        id: c.id, slug: c.slug, nome: c.nome,
        descricao: c.descricao ?? undefined, icone: c.icone, xp: c.xp,
        categoria: c.categoria, raridade: c.raridade as Conquista["raridade"],
        recompensa: c.recompensa ?? undefined, criterio: c.criterio,
        obtida: obtidas.has(c.id), obtidaEm: obtidas.get(c.id),
      })),
      missoes: ((rMiss.data ?? []) as unknown as LMiss[]).map((m) => {
        const p = progresso.get(m.id);
        return {
          id: m.id, slug: m.slug, titulo: m.titulo,
          descricao: m.descricao ?? undefined, icone: m.icone,
          periodo: m.periodo as Missao["periodo"], metrica: m.metrica,
          meta: m.meta, xp: m.xp, recompensa: m.recompensa ?? undefined,
          progresso: p?.progresso ?? 0,
          concluida: Boolean(p?.concluida_em),
        };
      }),
      eventos: ((rXP.data ?? []) as Array<{ id: number; tipo: string; xp: number; descricao: string | null; criado_em: string }>)
        .map((e) => ({ id: e.id, tipo: e.tipo, xp: e.xp, descricao: e.descricao ?? undefined, criadoEm: e.criado_em })),
      estudo: ((rEstudo.data ?? []) as Array<{ dia: string; minutos: number; aulas: number }>)
        .map((d) => ({ dia: d.dia, minutos: d.minutos, aulas: d.aulas })),
      origem: "supabase",
    };
  } catch (e) {
    console.error("[gamificacao] falha:", msgErro(e));
    return painelDemo();
  }
}

/** Registra XP. O trigger no banco soma no perfil e recalcula o nível. */
export async function registrarXP(
  perfilId: string,
  tipo: string,
  xp: number,
  descricao: string
) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("eventos_xp")
    .insert({ perfil_id: perfilId, tipo, xp, descricao });
  if (error) console.error("[xp] falha ao registrar:", msgErro(error));
}

/** Marca estudo no dia — alimenta ofensiva e missões. */
export async function registrarEstudo(
  perfilId: string,
  { minutos = 0, aulas = 0, quizzes = 0 }: { minutos?: number; aulas?: number; quizzes?: number }
) {
  const sb = getSupabase();
  if (!sb) return;

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: atual } = await sb
    .from("estudo_diario")
    .select("minutos, aulas, quizzes")
    .eq("perfil_id", perfilId)
    .eq("dia", hoje)
    .maybeSingle();

  const base = (atual ?? { minutos: 0, aulas: 0, quizzes: 0 }) as {
    minutos: number; aulas: number; quizzes: number;
  };

  await sb.from("estudo_diario").upsert(
    {
      perfil_id: perfilId,
      dia: hoje,
      minutos: base.minutos + minutos,
      aulas: base.aulas + aulas,
      quizzes: base.quizzes + quizzes,
    },
    { onConflict: "perfil_id,dia" }
  );
}

/** Avança uma missão do ciclo atual. Devolve true se acabou de concluir. */
export async function avancarMissao(
  perfilId: string,
  slug: string,
  incremento = 1
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data: missao } = await sb
    .from("missoes")
    .select("id, meta, xp, titulo")
    .eq("slug", slug)
    .maybeSingle();
  if (!missao) return false;

  const m = missao as { id: string; meta: number; xp: number; titulo: string };
  const ciclo = cicloAtual();

  const { data: atual } = await sb
    .from("perfil_missoes")
    .select("progresso, concluida_em")
    .eq("perfil_id", perfilId)
    .eq("missao_id", m.id)
    .eq("ciclo", ciclo)
    .maybeSingle();

  const anterior = (atual as { progresso: number; concluida_em: string | null } | null) ?? {
    progresso: 0,
    concluida_em: null,
  };
  if (anterior.concluida_em) return false;

  const novo = anterior.progresso + incremento;
  const concluiu = novo >= m.meta;

  await sb.from("perfil_missoes").upsert(
    {
      perfil_id: perfilId,
      missao_id: m.id,
      ciclo,
      progresso: novo,
      concluida_em: concluiu ? new Date().toISOString() : null,
    },
    { onConflict: "perfil_id,missao_id,ciclo" }
  );

  if (concluiu) {
    await registrarXP(perfilId, "missao", m.xp, `Missão concluída: ${m.titulo}`);
  }
  return concluiu;
}

/* ------------------------------------------------------------ seed local -- */
function painelDemo(): PainelGamificacao {
  const hoje = new Date();
  const dia = (n: number) =>
    new Date(hoje.getTime() - n * 86400000).toISOString().slice(0, 10);

  return {
    origem: "demo",
    conquistas: [
      { id: "c1", slug: "primeira-aula", nome: "Primeiro lançamento", descricao: "Assistiu à primeira aula da plataforma", icone: "🎬", xp: 50, categoria: "inicio", raridade: "comum", obtida: true, obtidaEm: dia(30) },
      { id: "c2", slug: "ofensiva-7", nome: "Fechamento semanal", descricao: "7 dias seguidos estudando", icone: "🔥", xp: 150, categoria: "ofensiva", raridade: "comum", recompensa: "+1 semana de Pro grátis", criterio: { metrica: "dias", meta: 7 }, obtida: true, obtidaEm: dia(5) },
      { id: "c3", slug: "ofensiva-30", nome: "Competência encerrada", descricao: "30 dias seguidos estudando", icone: "⚡", xp: 600, categoria: "ofensiva", raridade: "raro", recompensa: "1 curso avulso à sua escolha", criterio: { metrica: "dias", meta: 30 }, obtida: false },
      { id: "c4", slug: "maratona-semana", nome: "Hora extra", descricao: "1 hora de aula por dia durante uma semana", icone: "⏱️", xp: 400, categoria: "estudo", raridade: "raro", recompensa: "1 curso avulso à sua escolha", criterio: { metrica: "minutos_por_dia", meta: 60, dias: 7 }, obtida: false },
      { id: "c5", slug: "dez-horas", nome: "Regime de caixa", descricao: "10 horas de conteúdo assistidas", icone: "📚", xp: 250, categoria: "estudo", raridade: "comum", criterio: { metrica: "minutos", meta: 600 }, obtida: true, obtidaEm: dia(9) },
      { id: "c6", slug: "primeiro-cert", nome: "Certidão negativa", descricao: "Emitiu o primeiro certificado", icone: "🏅", xp: 300, categoria: "carreira", raridade: "comum", recompensa: "Perfil destacado por 7 dias", obtida: true, obtidaEm: dia(14) },
      { id: "c7", slug: "trilha-completa", nome: "Balanço fechado", descricao: "Concluiu uma trilha de carreira inteira", icone: "🏆", xp: 1500, categoria: "carreira", raridade: "epico", recompensa: "Selo verificado + topo da busca", criterio: { metrica: "trilhas", meta: 1 }, obtida: false },
      { id: "c8", slug: "nota-maxima", nome: "Sem divergência", descricao: "Gabaritou uma avaliação final", icone: "💯", xp: 250, categoria: "avaliacao", raridade: "raro", obtida: true, obtidaEm: dia(3) },
      { id: "c9", slug: "cem-questoes", nome: "Auditoria completa", descricao: "Respondeu 100 questões no banco", icone: "🔎", xp: 300, categoria: "avaliacao", raridade: "comum", criterio: { metrica: "questoes", meta: 100 }, obtida: false },
      { id: "c10", slug: "primeiro-post", nome: "Nota explicativa", descricao: "Fez a primeira publicação no feed", icone: "📣", xp: 80, categoria: "comunidade", raridade: "comum", obtida: false },
      { id: "c11", slug: "perfil-completo", nome: "Cadastro regular", descricao: "Completou 100% do perfil", icone: "✨", xp: 120, categoria: "carreira", raridade: "comum", obtida: true, obtidaEm: dia(20) },
      { id: "c12", slug: "pepc-40", nome: "Educação continuada", descricao: "Atingiu 40 pontos PEPC no ano", icone: "📋", xp: 800, categoria: "carreira", raridade: "raro", recompensa: "Relatório PEPC pronto para o CRC", obtida: false },
    ],
    missoes: [
      { id: "m1", slug: "diaria-aula", titulo: "Uma aula por dia", descricao: "Assista pelo menos 1 aula hoje", icone: "play", periodo: "diaria", metrica: "aulas", meta: 1, xp: 30, progresso: 1, concluida: true },
      { id: "m2", slug: "diaria-questoes", titulo: "5 questões do dia", descricao: "Responda 5 questões no banco", icone: "check-square", periodo: "diaria", metrica: "questoes", meta: 5, xp: 40, progresso: 3, concluida: false },
      { id: "m3", slug: "semanal-3-aulas", titulo: "Ritmo de estudo", descricao: "Conclua 3 aulas nesta semana", icone: "layers", periodo: "semanal", metrica: "aulas", meta: 3, xp: 120, progresso: 2, concluida: false },
      { id: "m4", slug: "semanal-60min", titulo: "Hora cheia", descricao: "Acumule 60 minutos de aula na semana", icone: "clock", periodo: "semanal", metrica: "minutos", meta: 60, xp: 150, progresso: 45, concluida: false },
      { id: "m5", slug: "semanal-quiz", titulo: "Prova real", descricao: "Faça 1 avaliação nesta semana", icone: "clipboard-check", periodo: "semanal", metrica: "quiz", meta: 1, xp: 180, recompensa: "+50 XP bônus", progresso: 1, concluida: true },
      { id: "m6", slug: "semanal-comunidade", titulo: "Presença na rede", descricao: "Comente ou publique no feed", icone: "message-circle", periodo: "semanal", metrica: "posts", meta: 1, xp: 90, progresso: 0, concluida: false },
      { id: "m7", slug: "mensal-curso", titulo: "Fechar o mês", descricao: "Conclua 1 curso inteiro no mês", icone: "award", periodo: "mensal", metrica: "cursos", meta: 1, xp: 600, recompensa: "1 mês de Pro com 50% off", progresso: 0, concluida: false },
    ],
    eventos: [
      { id: 1, tipo: "curso", xp: 300, descricao: "Certificado: Comércio Exterior e Rotina Aduaneira", criadoEm: dia(0) },
      { id: 2, tipo: "aula", xp: 30, descricao: "Aula concluída: Dossiê aduaneiro modelo", criadoEm: dia(0) },
      { id: 3, tipo: "missao", xp: 180, descricao: "Missão semanal: Prova real", criadoEm: dia(1) },
      { id: 4, tipo: "conquista", xp: 150, descricao: "Conquista: Fechamento semanal", criadoEm: dia(2) },
      { id: 5, tipo: "curso", xp: 300, descricao: "Certificado: Contabilidade para Transporte", criadoEm: dia(5) },
    ],
    estudo: Array.from({ length: 12 }, (_, i) => ({
      dia: dia(i),
      minutos: 25 + ((i * 7) % 45),
      aulas: 1 + (i % 3),
    })),
  };
}
