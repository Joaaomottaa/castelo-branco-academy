import { getSupabase } from "./supabase";
import { msgErro } from "./modo";

/* ==========================================================================
   DÚVIDAS DA AULA — duas vias

   'ia'    → pergunta particular, respondida na hora com o contexto da aula.
             Ninguém mais vê. É onde a pessoa pergunta o que teria vergonha de
             perguntar na frente da turma — e essa é justamente a pergunta que
             trava o estudo.

   'forum' → pergunta aberta, respondida por colega ou instrutor. Fica no
             histórico da aula e serve para quem vier depois.

   A separação é feita pelo RLS, não pela interface: a policy de `duvidas` só
   devolve pergunta de IA para o próprio autor.
   ========================================================================== */

export interface Resposta {
  id: string;
  perfilId: string;
  autorNome: string;
  autorCargo?: string;
  autorRole?: string;
  conteudo: string;
  melhor: boolean;
  votos: number;
  votei: boolean;
  criadoEm: string;
}

export interface Duvida {
  id: string;
  aulaId: string;
  perfilId: string;
  autorNome: string;
  autorCargo?: string;
  autorRole?: string;
  tipo: "ia" | "forum";
  pergunta: string;
  respostaIA?: string;
  fonteIA?: string;
  resolvida: boolean;
  criadoEm: string;
  respostas: Resposta[];
  minha: boolean;
}

interface Ctx {
  aulaTitulo: string;
  aulaDescricao?: string;
  cursoTitulo: string;
  moduloTitulo: string;
  nivel?: string;
  categoria?: string;
}

/* ------------------------------------------------------------- demo ------ */
const CHAVE_DEMO = "cba.duvidas";

function lerDemo(): Duvida[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_DEMO) ?? "[]") as Duvida[];
  } catch {
    return [];
  }
}

function gravarDemo(lista: Duvida[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_DEMO, JSON.stringify(lista));
  } catch {
    /* storage indisponível */
  }
}

/** Thread de exemplo para a aula não abrir vazia na apresentação. */
function seedDemo(aulaId: string): Duvida[] {
  return [
    {
      id: `demo-${aulaId}-1`,
      aulaId,
      perfilId: "demo-rafael",
      autorNome: "Rafael Nogueira",
      autorCargo: "Analista Fiscal",
      autorRole: "aluno",
      tipo: "forum",
      pergunta:
        "Na prática, o crédito fica retido até a liquidação financeira do fornecedor? Como fica a conciliação no fechamento se o fornecedor atrasa o recolhimento?",
      resolvida: true,
      criadoEm: new Date(Date.now() - 86400000 * 2).toISOString(),
      minha: false,
      respostas: [
        {
          id: "r1",
          perfilId: "demo-instrutor",
          autorNome: "Márcia Castelo Branco",
          autorCargo: "Sócia-diretora",
          autorRole: "admin",
          conteudo:
            "Fica. No desenho do split payment o crédito nasce condicionado ao recolhimento na etapa anterior — não basta a nota. Na conciliação do fechamento, separe uma conta de “crédito em trânsito” para o que ainda não foi homologado e só transfira para crédito efetivo quando confirmar. Sem essa conta, o mês fecha com um número que o fisco não reconhece.",
          melhor: true,
          votos: 7,
          votei: false,
          criadoEm: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(),
        },
        {
          id: "r2",
          perfilId: "demo-camila",
          autorNome: "Camila Dourado",
          autorCargo: "Coordenadora Contábil",
          autorRole: "aluno",
          conteudo:
            "Complementando: a gente passou a puxar relatório de fornecedor por CNPJ todo dia 5. Dois fornecedores atrasavam sempre, e ver isso em número foi o que convenceu a diretoria a trocar.",
          melhor: false,
          votos: 3,
          votei: false,
          criadoEm: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    },
    {
      id: `demo-${aulaId}-2`,
      aulaId,
      perfilId: "demo-camila",
      autorNome: "Camila Dourado",
      autorCargo: "Coordenadora Contábil",
      autorRole: "aluno",
      tipo: "forum",
      pergunta:
        "Existe transição para contratos assinados antes de 2026? Estamos revisando contratos de frete de longo prazo e não sei se preciso incluir cláusula de revisão.",
      resolvida: false,
      criadoEm: new Date(Date.now() - 3600000 * 5).toISOString(),
      minha: false,
      respostas: [],
    },
  ];
}

/* ------------------------------------------------------------ leitura ---- */
type LinhaResposta = {
  id: string; perfil_id: string; autor_nome: string | null; autor_cargo: string | null;
  autor_role: string | null; conteudo: string; melhor: boolean; criado_em: string;
  duvida_votos: Array<{ perfil_id: string }>;
};

type LinhaDuvida = {
  id: string; aula_id: string; perfil_id: string;
  autor_nome: string | null; autor_cargo: string | null; autor_role: string | null;
  tipo: string; pergunta: string; resposta_ia: string | null; fonte_ia: string | null;
  resolvida: boolean; criado_em: string;
  duvida_respostas: LinhaResposta[];
};

export async function carregarDuvidas(aulaId: string): Promise<Duvida[]> {
  const sb = getSupabase();
  if (!sb) {
    const salvas = lerDemo().filter((d) => d.aulaId === aulaId);
    return [...salvas, ...seedDemo(aulaId)];
  }

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id ?? "";

  const { data, error } = await sb
    .from("duvidas")
    .select(
      `id, aula_id, perfil_id, autor_nome, autor_cargo, autor_role, tipo, pergunta,
       resposta_ia, fonte_ia, resolvida, criado_em,
       duvida_respostas ( id, perfil_id, autor_nome, autor_cargo, autor_role,
                          conteudo, melhor, criado_em,
                          duvida_votos ( perfil_id ) )`
    )
    .eq("aula_id", aulaId)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[duvidas] carregar:", msgErro(error));
    return [];
  }

  return ((data ?? []) as unknown as LinhaDuvida[]).map((d) => ({
    id: d.id,
    aulaId: d.aula_id,
    perfilId: d.perfil_id,
    autorNome: d.autor_nome ?? "Aluno",
    autorCargo: d.autor_cargo ?? undefined,
    autorRole: d.autor_role ?? undefined,
    tipo: d.tipo as "ia" | "forum",
    pergunta: d.pergunta,
    respostaIA: d.resposta_ia ?? undefined,
    fonteIA: d.fonte_ia ?? undefined,
    resolvida: d.resolvida,
    criadoEm: d.criado_em,
    minha: d.perfil_id === uid,
    respostas: [...(d.duvida_respostas ?? [])]
      .sort((a, b) => {
        if (a.melhor !== b.melhor) return a.melhor ? -1 : 1;
        return a.criado_em.localeCompare(b.criado_em);
      })
      .map((r) => ({
        id: r.id,
        perfilId: r.perfil_id,
        autorNome: r.autor_nome ?? "Aluno",
        autorCargo: r.autor_cargo ?? undefined,
        autorRole: r.autor_role ?? undefined,
        conteudo: r.conteudo,
        melhor: r.melhor,
        votos: r.duvida_votos?.length ?? 0,
        votei: (r.duvida_votos ?? []).some((v) => v.perfil_id === uid),
        criadoEm: r.criado_em,
      })),
  }));
}

/* ---------------------------------------------------------- pergunta IA -- */
export async function perguntarParaIA(
  aulaId: string,
  pergunta: string,
  contexto: Ctx
): Promise<{ resposta?: string; fonte?: string; erro?: string }> {
  let resposta = "";
  let fonte = "local";

  try {
    const r = await fetch("/api/duvida-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta, ...contexto }),
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados?.erro ?? "Falha ao consultar o assistente.");
    resposta = dados.resposta ?? "";
    fonte = dados.fonte ?? "local";
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "O assistente não respondeu." };
  }

  if (!resposta) return { erro: "O assistente não devolveu resposta." };

  const sb = getSupabase();
  if (!sb) {
    const lista = lerDemo();
    lista.unshift({
      id: `local-${Date.now()}`,
      aulaId,
      perfilId: "demo",
      autorNome: "Você",
      tipo: "ia",
      pergunta,
      respostaIA: resposta,
      fonteIA: fonte,
      resolvida: false,
      criadoEm: new Date().toISOString(),
      respostas: [],
      minha: true,
    });
    gravarDemo(lista);
    return { resposta, fonte };
  }

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { resposta, fonte };

  const { error } = await sb.from("duvidas").insert({
    aula_id: aulaId,
    perfil_id: uid,
    tipo: "ia",
    pergunta,
    resposta_ia: resposta,
    fonte_ia: fonte,
    respondida_em: new Date().toISOString(),
  });
  if (error) console.error("[duvidas] gravar IA:", msgErro(error));

  return { resposta, fonte };
}

/* ------------------------------------------------------------- fórum ----- */
export async function publicarDuvida(
  aulaId: string,
  pergunta: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) {
    const lista = lerDemo();
    lista.unshift({
      id: `local-${Date.now()}`,
      aulaId,
      perfilId: "demo",
      autorNome: "Você",
      tipo: "forum",
      pergunta,
      resolvida: false,
      criadoEm: new Date().toISOString(),
      respostas: [],
      minha: true,
    });
    gravarDemo(lista);
    return { ok: true };
  }

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { ok: false, erro: "Entre para publicar." };

  const { error } = await sb
    .from("duvidas")
    .insert({ aula_id: aulaId, perfil_id: uid, tipo: "forum", pergunta });
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function responderDuvida(
  duvidaId: string,
  conteudo: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) {
    const lista = lerDemo();
    const d = lista.find((x) => x.id === duvidaId);
    if (d) {
      d.respostas.push({
        id: `r-${Date.now()}`,
        perfilId: "demo",
        autorNome: "Você",
        conteudo,
        melhor: false,
        votos: 0,
        votei: false,
        criadoEm: new Date().toISOString(),
      });
      gravarDemo(lista);
    }
    return { ok: true };
  }

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { ok: false, erro: "Entre para responder." };

  const { error } = await sb
    .from("duvida_respostas")
    .insert({ duvida_id: duvidaId, perfil_id: uid, conteudo });
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function alternarVoto(respostaId: string, votar: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return;

  if (votar) {
    await sb.from("duvida_votos").insert({ resposta_id: respostaId, perfil_id: uid });
  } else {
    await sb.from("duvida_votos").delete()
      .eq("resposta_id", respostaId).eq("perfil_id", uid);
  }
}

/** O autor da pergunta marca a resposta que resolveu. */
export async function marcarMelhorResposta(
  duvidaId: string,
  respostaId: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("duvida_respostas").update({ melhor: false }).eq("duvida_id", duvidaId);
  await sb.from("duvida_respostas").update({ melhor: true }).eq("id", respostaId);
  await sb.from("duvidas").update({ resolvida: true }).eq("id", duvidaId);
}

export async function apagarDuvida(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    gravarDemo(lerDemo().filter((d) => d.id !== id));
    return;
  }
  await sb.from("duvidas").delete().eq("id", id);
}

/* ==========================================================================
   DÚVIDA SOBRE UMA QUESTÃO DO BANCO

   Mesma tabela `duvidas`, com `questao_id` no lugar de `aula_id`. A policy que
   já existia ("fórum é público, IA é privada") continua valendo sem mudança:
   a conversa sobre a questão é só da pessoa que perguntou.
   ========================================================================== */

export interface StatusDuvidaIA {
  usadasHoje: number;
  /** `null` = ilimitado (planos pagos). */
  limite: number | null;
  pode: boolean;
}

export async function statusDuvidaIAQuestao(): Promise<StatusDuvidaIA> {
  const sb = getSupabase();
  if (!sb) return { usadasHoje: 0, limite: 0, pode: false };

  const { data, error } = await sb.rpc("status_duvida_ia_questao");
  if (error) {
    console.error("[duvidas] status:", msgErro(error));
    return { usadasHoje: 0, limite: 0, pode: false };
  }
  return data as StatusDuvidaIA;
}

export interface DuvidaDaQuestao {
  id: string;
  pergunta: string;
  resposta: string;
  criadoEm: string;
}

export async function duvidasDaQuestao(questaoId: string): Promise<DuvidaDaQuestao[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("duvidas")
    .select("id, pergunta, resposta_ia, criado_em")
    .eq("questao_id", questaoId)
    .eq("tipo", "ia")
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[duvidas] da questão:", msgErro(error));
    return [];
  }

  return ((data ?? []) as Array<{
    id: string; pergunta: string; resposta_ia: string | null; criado_em: string;
  }>).map((r) => ({
    id: r.id,
    pergunta: r.pergunta,
    resposta: r.resposta_ia ?? "",
    criadoEm: r.criado_em,
  }));
}

export interface ContextoQuestao {
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  marcada?: string;
  explicacao?: string;
  area?: string;
  assunto?: string;
  nivel?: string;
  banca?: string;
  nome?: string;
}

export async function perguntarSobreQuestao(
  questaoId: string,
  pergunta: string,
  contexto: ContextoQuestao
): Promise<{ resposta?: string; fonte?: string; erro?: string }> {
  // A cota é reconferida aqui, e não só na interface: esconder o botão é
  // cortesia; o que impede o gasto é esta chamada e a função no banco.
  const status = await statusDuvidaIAQuestao();
  if (!status.pode) {
    return { erro: "limite" };
  }

  let resposta = "";
  let fonte = "local";
  try {
    const r = await fetch("/api/duvida-questao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta, ...contexto }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.erro ?? "Falha ao consultar o Tino.");
    resposta = d.resposta ?? "";
    fonte = d.fonte ?? "local";
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "O Tino não respondeu." };
  }

  if (!resposta) return { erro: "O Tino não devolveu resposta." };

  const sb = getSupabase();
  if (!sb) return { resposta, fonte };

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return { resposta, fonte };

  const { error } = await sb.from("duvidas").insert({
    questao_id: questaoId,
    perfil_id: uid,
    tipo: "ia",
    pergunta,
    resposta_ia: resposta,
    fonte_ia: fonte,
    respondida_em: new Date().toISOString(),
  });
  if (error) console.error("[duvidas] gravar questão:", msgErro(error));

  return { resposta, fonte };
}
