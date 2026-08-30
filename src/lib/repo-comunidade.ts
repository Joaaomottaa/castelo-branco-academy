import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Comentario, Conexao, Post } from "./types";

/* ==========================================================================
   COMUNIDADE — feed, curtidas, comentários e conexões
   ========================================================================== */

type LPerfil = { id: string; nome: string; cargo: string | null; nivel: number } | null;

type LPost = {
  id: string; autor_id: string; tipo: string; conteudo: string;
  link_url: string | null; criado_em: string;
  autor_nome: string | null; autor_cargo: string | null; autor_nivel: number | null;
  perfis: LPerfil;
  empresas: { nome: string; cor: string | null } | null;
  post_curtidas: Array<{ perfil_id: string }>;
  post_comentarios: Array<{
    id: string; perfil_id: string; conteudo: string; criado_em: string;
    autor_nome: string | null; autor_cargo: string | null;
    perfis: LPerfil;
  }>;
};

// autor_nome/cargo/nivel são desnormalizados no insert por trigger: o RLS de
// `perfis` não deixa ler o perfil de quem não é público, e o feed precisa
// exibir o nome de quem publicou.
const SELECT_POST = `
  id, autor_id, tipo, conteudo, link_url, criado_em,
  autor_nome, autor_cargo, autor_nivel,
  empresas ( nome, cor ),
  post_curtidas ( perfil_id ),
  post_comentarios ( id, perfil_id, conteudo, criado_em, autor_nome, autor_cargo )
`;

function mapPost(r: LPost, meuId?: string): Post {
  return {
    id: r.id,
    autorId: r.autor_id,
    autorNome: r.autor_nome ?? r.perfis?.nome ?? "Usuário",
    autorCargo: r.autor_cargo ?? r.perfis?.cargo ?? undefined,
    autorNivel: r.autor_nivel ?? r.perfis?.nivel ?? undefined,
    empresaNome: r.empresas?.nome ?? undefined,
    empresaCor: r.empresas?.cor ?? undefined,
    tipo: r.tipo as Post["tipo"],
    conteudo: r.conteudo,
    linkUrl: r.link_url ?? undefined,
    criadoEm: r.criado_em,
    curtidas: (r.post_curtidas ?? []).length,
    curtiu: (r.post_curtidas ?? []).some((c) => c.perfil_id === meuId),
    comentarios: (r.post_comentarios ?? [])
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map<Comentario>((c) => ({
        id: c.id,
        perfilId: c.perfil_id,
        autorNome: c.autor_nome ?? c.perfis?.nome ?? "Usuário",
        autorCargo: c.autor_cargo ?? c.perfis?.cargo ?? undefined,
        conteudo: c.conteudo,
        criadoEm: c.criado_em,
      })),
  };
}

export async function carregarFeed(meuId?: string): Promise<Post[]> {
  const sb = getSupabase();
  if (!sb) return postsDemo(meuId);

  const { data, error } = await sb
    .from("posts")
    .select(SELECT_POST)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[feed] falha:", msgErro(error));
    return postsDemo(meuId);
  }
  return ((data ?? []) as unknown as LPost[]).map((p) => mapPost(p, meuId));
}

export async function publicarPost(
  autorId: string,
  conteudo: string,
  tipo: Post["tipo"] = "texto"
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("posts")
    .insert({ autor_id: autorId, conteudo, tipo })
    .select("id")
    .single();

  if (error) {
    console.error("[feed] publicar:", msgErro(error));
    return null;
  }
  return (data as { id: string }).id;
}

export async function alternarCurtida(postId: string, perfilId: string, curtir: boolean) {
  const sb = getSupabase();
  if (!sb) return;

  if (curtir) {
    await sb.from("post_curtidas").insert({ post_id: postId, perfil_id: perfilId });
  } else {
    await sb
      .from("post_curtidas")
      .delete()
      .eq("post_id", postId)
      .eq("perfil_id", perfilId);
  }
}

export async function comentar(postId: string, perfilId: string, conteudo: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("post_comentarios")
    .insert({ post_id: postId, perfil_id: perfilId, conteudo });
  if (error) console.error("[feed] comentar:", msgErro(error));
}

/* ------------------------------------------------------------- conexões -- */
export async function carregarConexoes(meuId: string): Promise<Conexao[]> {
  const sb = getSupabase();
  if (!sb) return conexoesDemo;

  const { data, error } = await sb
    .from("conexoes")
    .select(`
      id, status, solicitante_id, destinatario_id,
      solicitante:solicitante_id ( id, nome, cargo, cidade, uf ),
      destinatario:destinatario_id ( id, nome, cargo, cidade, uf )
    `)
    .or(`solicitante_id.eq.${meuId},destinatario_id.eq.${meuId}`);

  if (error) {
    console.error("[conexoes] falha:", msgErro(error));
    return [];
  }

  type L = {
    id: string; status: string; solicitante_id: string; destinatario_id: string;
    solicitante: { id: string; nome: string; cargo: string | null; cidade: string | null; uf: string | null } | null;
    destinatario: { id: string; nome: string; cargo: string | null; cidade: string | null; uf: string | null } | null;
  };

  return ((data ?? []) as unknown as L[]).map((c) => {
    const souSolicitante = c.solicitante_id === meuId;
    const outro = souSolicitante ? c.destinatario : c.solicitante;
    return {
      id: c.id,
      perfilId: outro?.id ?? "",
      nome: outro?.nome ?? "Usuário",
      cargo: outro?.cargo ?? undefined,
      cidade: outro?.cidade ?? undefined,
      uf: outro?.uf ?? undefined,
      status: c.status as Conexao["status"],
      souSolicitante,
    };
  });
}

export async function conectar(meuId: string, destinatarioId: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("conexoes")
    .insert({ solicitante_id: meuId, destinatario_id: destinatarioId });
  if (error && !/duplicate/i.test(error.message)) {
    console.error("[conexoes] conectar:", msgErro(error));
  }
}

export async function responderConexao(id: string, aceitar: boolean) {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("conexoes")
    .update({
      status: aceitar ? "aceita" : "recusada",
      respondido_em: new Date().toISOString(),
    })
    .eq("id", id);
}

/* ------------------------------------------------------------ seed local -- */
function postsDemo(meuId?: string): Post[] {
  const h = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();
  return [
    {
      id: "p1", autorId: "u-admin", autorNome: "Equipe Castelo Branco",
      autorCargo: "Administração", empresaNome: "Castelo Branco Contabilidade",
      empresaCor: "#C89F50", tipo: "anuncio",
      conteudo:
        "Publicamos hoje a atualização do módulo de Split Payment do curso de Reforma Tributária. Quem já concluiu recebeu o aviso — a aula 6 mudou por causa da regulamentação de dezembro. Vale reassistir antes de aplicar no cliente.",
      criadoEm: h(2), curtidas: 24, curtiu: false, comentarios: [],
    },
    {
      id: "p2", autorId: "u-empresa", autorNome: "TransLog Brasil",
      autorCargo: "Recrutamento", empresaNome: "TransLog Brasil", empresaCor: "#00204D",
      tipo: "vaga",
      conteudo:
        "Estamos com vaga aberta para Analista Fiscal Pleno em Feira de Santana, modelo híbrido. Damos preferência a quem concluiu a trilha de Analista Fiscal aqui na Academy — já sabemos o que a pessoa estudou.",
      criadoEm: h(5), curtidas: 18, curtiu: false, comentarios: [],
    },
    {
      id: "p3", autorId: "t2", autorNome: "Rafael Nogueira",
      autorCargo: "Consultor Tributário", autorNivel: 11, tipo: "texto",
      conteudo:
        "Terminei a trilha de Especialista Tributário e queria registrar uma coisa: o módulo de recuperação de créditos mudou a forma como eu monto o dossiê. Saí do \"acho que dá\" para \"aqui está a sustentação documental\".",
      criadoEm: h(12), curtidas: 31, curtiu: meuId === "u-aluno",
      comentarios: [
        { id: "c1", perfilId: "t5", autorNome: "Beatriz Santana", autorCargo: "Auxiliar Contábil", conteudo: "Isso é exatamente o que me falta hoje. Obrigada por compartilhar!", criadoEm: h(10) },
      ],
    },
    {
      id: "p4", autorId: "t6", autorNome: "Diego Farias",
      autorCargo: "Coordenador Fiscal", autorNivel: 8, tipo: "texto",
      conteudo:
        "Dica para quem faz fechamento de vários CNPJs: o módulo de Power Query do curso de Excel resolveu meu maior gargalo. Reduzi de 9 para 3 dias o ciclo de fechamento.",
      criadoEm: h(20), curtidas: 42, curtiu: false,
      comentarios: [
        { id: "c2", perfilId: "t3", autorNome: "Camila Duarte", autorCargo: "Analista de Comex", conteudo: "De 9 para 3 dias é impressionante. Você usa o Power Query direto no arquivo do SPED?", criadoEm: h(18) },
      ],
    },
    {
      id: "p5", autorId: "t3", autorNome: "Camila Duarte",
      autorCargo: "Analista de Comex", autorNivel: 4, tipo: "texto",
      conteudo:
        "Alguém aqui já pegou autuação por erro de NCM? Estou revisando a classificação de uma carteira de importação e queria trocar experiência sobre como vocês documentam a justificativa técnica.",
      criadoEm: h(26), curtidas: 9, curtiu: false,
      comentarios: [
        { id: "c3", perfilId: "t6", autorNome: "Diego Farias", autorCargo: "Coordenador Fiscal", conteudo: "Já. O que me salvou foi manter um parecer de classificação anexo ao processo, com catálogo do fabricante e a regra de interpretação usada.", criadoEm: h(24) },
      ],
    },
  ];
}

const conexoesDemo: Conexao[] = [
  { id: "x1", perfilId: "t2", nome: "Rafael Nogueira", cargo: "Consultor Tributário", cidade: "Salvador", uf: "BA", status: "aceita", souSolicitante: true },
  { id: "x2", perfilId: "t6", nome: "Diego Farias", cargo: "Coordenador Fiscal", cidade: "Curitiba", uf: "PR", status: "aceita", souSolicitante: true },
  { id: "x3", perfilId: "t3", nome: "Camila Duarte", cargo: "Analista de Comex", cidade: "São Paulo", uf: "SP", status: "pendente", souSolicitante: false },
];
