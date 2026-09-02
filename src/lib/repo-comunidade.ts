import { getSupabase } from "./supabase";
import { colunaAusente, msgErro } from "./modo";
import type {
  Colega, Comentario, Conexao, Conversa, Mensagem, MidiaDoPost, Post,
} from "./types";

/* ==========================================================================
   COMUNIDADE — feed, curtidas, comentários e conexões
   ========================================================================== */

type LPerfil = { id: string; nome: string; cargo: string | null; nivel: number } | null;

type LPost = {
  id: string; autor_id: string; tipo: string; conteudo: string;
  link_url: string | null; criado_em: string; midias: MidiaDoPost[] | null;
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
const POST_SEM_MIDIAS = `
  id, autor_id, tipo, conteudo, link_url, criado_em,
  autor_nome, autor_cargo, autor_nivel,
  empresas ( nome, cor ),
  post_curtidas ( perfil_id ),
  post_comentarios ( id, perfil_id, conteudo, criado_em, autor_nome, autor_cargo )
`;

// `midias` nasce na migração 20 e fica separada de propósito: o código sobe
// pelo deploy e o SQL roda à mão no painel, e nesse intervalo o feed tem de
// continuar de pé sem o anexo em vez de responder erro de coluna.
const POST_COM_MIDIAS = `midias, ${POST_SEM_MIDIAS}`;

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
    midias: r.midias ?? [],
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

  const buscar = (colunas: string) =>
    sb
      .from("posts")
      .select(colunas)
      .order("criado_em", { ascending: false })
      .limit(50);

  let r = await buscar(POST_COM_MIDIAS);
  if (colunaAusente(r.error)) {
    console.warn("[feed] coluna `midias` ainda não existe; rode supabase/20_*.sql.");
    r = await buscar(POST_SEM_MIDIAS);
  }

  // Banco respondendo e recusando: o feed volta VAZIO, não volta a semente de
  // demonstração. Publicação inventada com nome de gente que existe, curtida
  // que ninguém deu e comentário que ninguém escreveu é pior que feed vazio —
  // e o caso real (coluna nova faltando) o retry acima já resolveu.
  if (r.error) {
    console.error("[feed] falha:", msgErro(r.error));
    return [];
  }
  return ((r.data ?? []) as unknown as LPost[]).map((p) => mapPost(p, meuId));
}

export const BUCKET_COMUNIDADE = "comunidade";
export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;

/**
 * Sobe um anexo da publicação.
 *
 * O caminho começa pelo id de quem envia (`<uid>/arquivo`) porque é isso que a
 * policy do bucket exige: cada pessoa escreve só na própria pasta. Foto de
 * cliente ou de documento fiscal não pode terminar na pasta de outro.
 */
export async function enviarAnexo(
  arquivo: File,
  perfilId: string
): Promise<{ midia?: MidiaDoPost; erro?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { erro: "Anexar arquivo exige o Supabase conectado." };
  }
  if (arquivo.size > LIMITE_ANEXO_BYTES) {
    return {
      erro: `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é ${
        LIMITE_ANEXO_BYTES / 1024 / 1024
      } MB.`,
    };
  }

  const limpo = arquivo.name
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
  const path = `${perfilId}/${Date.now()}-${limpo}`;

  const { error } = await sb.storage
    .from(BUCKET_COMUNIDADE)
    .upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });
  if (error) return { erro: msgErro(error) };

  const { data } = sb.storage.from(BUCKET_COMUNIDADE).getPublicUrl(path);
  return {
    midia: {
      tipo: arquivo.type.startsWith("image/") ? "imagem" : "arquivo",
      url: data.publicUrl,
      nome: arquivo.name,
      bytes: arquivo.size,
    },
  };
}

export async function publicarPost(
  autorId: string,
  conteudo: string,
  tipo: Post["tipo"] = "texto",
  midias: MidiaDoPost[] = []
): Promise<{ id?: string; erro?: string }> {
  const sb = getSupabase();
  // No modo demonstração a publicação vale para a sessão: a tela já a insere
  // na lista, e dizer que gravou seria mentira.
  if (!sb) return {};

  // `midias` só entra na linha quando existe anexo: publicar texto continua
  // funcionando antes de a migração 20 rodar. Com anexo e sem a coluna, a
  // publicação vai sem os arquivos — melhor que não publicar nada.
  const linha = { autor_id: autorId, conteudo, tipo };
  const inserir = (l: Record<string, unknown>) =>
    sb.from("posts").insert(l).select("id").single();

  let r = midias.length ? await inserir({ ...linha, midias }) : await inserir(linha);
  if (colunaAusente(r.error) && midias.length) {
    console.warn("[feed] coluna `midias` ainda não existe; publicando sem os anexos.");
    r = await inserir(linha);
  }

  if (r.error) {
    console.error("[feed] publicar:", msgErro(r.error));
    return { erro: msgErro(r.error) };
  }
  return { id: (r.data as { id: string }).id };
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

export async function conectar(
  meuId: string,
  destinatarioId: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  // Sem banco o pedido vale para a sessão: a tela já mostra "aguardando".
  if (!sb) return { ok: true };

  const { error } = await sb
    .from("conexoes")
    .insert({ solicitante_id: meuId, destinatario_id: destinatarioId });

  if (error) {
    // Pedido repetido não é erro para quem clicou: já está pedido.
    if (/duplicate|unique/i.test(error.message)) return { ok: true };
    console.error("[conexoes] conectar:", msgErro(error));
    return { ok: false, erro: msgErro(error) };
  }
  return { ok: true };
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

/* ============================================================== colegas ===
   A BUSCA QUE FALTAVA

   O feed mostrava quatro sugestões fixas e nenhum campo de busca: em produção
   não havia como achar um colega pelo nome. A busca acontece no banco (função
   `buscar_colegas`), e não filtrando uma lista já carregada, por dois motivos:
   a lista do catálogo traz só quem está no banco de talentos, e o estado da
   conexão precisa vir junto — sem ele a tela não sabe se o botão é "conectar",
   "aguardando" ou "conversar".
   ======================================================================== */

export async function buscarColegas(termo = "", limite = 24): Promise<Colega[]> {
  const sb = getSupabase();
  if (!sb) return colegasDemo(termo);

  const { data, error } = await sb.rpc("buscar_colegas", {
    p_termo: termo,
    p_limite: limite,
  });
  if (error) {
    console.error("[colegas] buscar:", msgErro(error));
    return [];
  }
  type L = Omit<Colega, "habilidades"> & { habilidades: string[] | null };
  return ((data ?? []) as L[]).map((c) => ({ ...c, habilidades: c.habilidades ?? [] }));
}

/* ============================================================ conversas ===
   O chat é deliberadamente simples: uma conversa por par de pessoas, mensagem
   em texto, sem grupo e sem anexo. É o que um MVP precisa para tirar a
   conversa do WhatsApp sem prometer o que não vai sustentar.

   Só conversa quem está conectado — a função `abrir_conversa` recusa o resto.
   ======================================================================== */

export async function abrirConversa(outroId: string): Promise<{ id?: string; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { id: `demo-${outroId}` };

  const { data, error } = await sb.rpc("abrir_conversa", { p_outro: outroId });
  if (error) return { erro: msgErro(error) };
  return { id: data as string };
}

export async function minhasConversas(): Promise<Conversa[]> {
  const sb = getSupabase();
  if (!sb) return conversasDemo();

  const { data, error } = await sb.rpc("minhas_conversas");
  if (error) {
    console.error("[conversas] listar:", msgErro(error));
    return [];
  }
  return (data ?? []) as Conversa[];
}

export async function mensagensDaConversa(conversaId: string): Promise<Mensagem[]> {
  const sb = getSupabase();
  if (!sb) return mensagensDemo(conversaId);

  const { data, error } = await sb
    .from("mensagens")
    .select("id, conversa_id, remetente_id, conteudo, lida, criado_em")
    .eq("conversa_id", conversaId)
    .order("criado_em");

  if (error) {
    console.error("[mensagens] listar:", msgErro(error));
    return [];
  }
  type L = {
    id: string; conversa_id: string; remetente_id: string;
    conteudo: string; lida: boolean; criado_em: string;
  };
  return ((data ?? []) as L[]).map((m) => ({
    id: m.id,
    conversaId: m.conversa_id,
    remetenteId: m.remetente_id,
    conteudo: m.conteudo,
    criadoEm: m.criado_em,
    lida: m.lida,
  }));
}

export async function enviarMensagem(
  conversaId: string,
  remetenteId: string,
  conteudo: string
): Promise<{ ok: boolean; erro?: string }> {
  const texto = conteudo.trim();
  if (!texto) return { ok: false, erro: "Escreva a mensagem." };

  const sb = getSupabase();
  if (!sb) {
    guardarMensagemDemo(conversaId, remetenteId, texto);
    return { ok: true };
  }

  const { error } = await sb
    .from("mensagens")
    .insert({ conversa_id: conversaId, remetente_id: remetenteId, conteudo: texto });
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

/** Marca como lidas as mensagens que o outro mandou. */
export async function marcarConversaLida(conversaId: string, meuId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("mensagens")
    .update({ lida: true })
    .eq("conversa_id", conversaId)
    .neq("remetente_id", meuId)
    .eq("lida", false);
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

/* ---------------------------------------------- colegas e chat na demo --- */
/*
  No modo demonstração não há banco, e uma tela de colegas vazia não mostra
  nada do que a área faz. Estes dados são os mesmos nomes do seed do catálogo,
  para a apresentação ser coerente com o resto.
*/
const COLEGAS_DEMO: Colega[] = [
  {
    id: "t2", nome: "Rafael Nogueira", cargo: "Consultor Tributário",
    cidade: "Salvador", uf: "BA", senioridade: "Sênior", nivel: 11,
    crc: "BA-098765/O-3",
    habilidades: ["Reforma Tributária", "PER/DCOMP", "Lucro Real"],
    conexao: { id: "x1", status: "aceita", souSolicitante: true },
  },
  {
    id: "t6", nome: "Diego Farias", cargo: "Coordenador Fiscal",
    cidade: "Curitiba", uf: "PR", senioridade: "Sênior", nivel: 8,
    habilidades: ["SPED Fiscal", "Power BI", "Fechamento"],
    conexao: { id: "x2", status: "aceita", souSolicitante: true },
  },
  {
    id: "t3", nome: "Camila Duarte", cargo: "Analista de Comex",
    cidade: "São Paulo", uf: "SP", senioridade: "Pleno", nivel: 4,
    habilidades: ["NCM", "Drawback", "Siscomex"],
    conexao: { id: "x3", status: "pendente", souSolicitante: false },
  },
  {
    id: "t5", nome: "Beatriz Santana", cargo: "Auxiliar Contábil",
    cidade: "Feira de Santana", uf: "BA", senioridade: "Júnior", nivel: 2,
    habilidades: ["Conciliação", "Excel"],
    conexao: null,
  },
  {
    id: "t4", nome: "João Pedro Lima", cargo: "Contador",
    cidade: "Recife", uf: "PE", senioridade: "Pleno", nivel: 6,
    habilidades: ["Simples Nacional", "Departamento Pessoal"],
    conexao: null,
  },
];

function colegasDemo(termo: string): Colega[] {
  const q = termo.trim().toLowerCase();
  if (!q) return COLEGAS_DEMO;
  return COLEGAS_DEMO.filter(
    (c) =>
      c.nome.toLowerCase().includes(q) ||
      (c.cargo ?? "").toLowerCase().includes(q) ||
      (c.cidade ?? "").toLowerCase().includes(q) ||
      c.habilidades.some((h) => h.toLowerCase().includes(q))
  );
}

/** As conversas da demonstração vivem na memória da aba, e é só isso. */
const CHAT_DEMO = new Map<string, Mensagem[]>([
  [
    "demo-t2",
    [
      {
        id: "m1", conversaId: "demo-t2", remetenteId: "t2",
        conteudo: "Vi que você concluiu a trilha tributária. Como foi o módulo de split payment?",
        criadoEm: new Date(Date.now() - 3600_000 * 5).toISOString(), lida: true,
      },
    ],
  ],
  [
    "demo-t6",
    [
      {
        id: "m2", conversaId: "demo-t6", remetenteId: "t6",
        conteudo: "Consegui aplicar o Power Query no fechamento. Reduzi de 9 para 3 dias.",
        criadoEm: new Date(Date.now() - 3600_000 * 30).toISOString(), lida: true,
      },
    ],
  ],
]);

function guardarMensagemDemo(conversaId: string, remetenteId: string, conteudo: string) {
  const atual = CHAT_DEMO.get(conversaId) ?? [];
  CHAT_DEMO.set(conversaId, [
    ...atual,
    {
      id: `local-${atual.length + 1}-${conversaId}`,
      conversaId,
      remetenteId,
      conteudo,
      criadoEm: new Date().toISOString(),
      lida: true,
    },
  ]);
}

function mensagensDemo(conversaId: string): Mensagem[] {
  return CHAT_DEMO.get(conversaId) ?? [];
}

function conversasDemo(): Conversa[] {
  return ["t2", "t6"].map((id) => {
    const colega = COLEGAS_DEMO.find((c) => c.id === id)!;
    const msgs = CHAT_DEMO.get(`demo-${id}`) ?? [];
    const ultima = msgs[msgs.length - 1];
    return {
      id: `demo-${id}`,
      atualizadoEm: ultima?.criadoEm ?? new Date().toISOString(),
      outro: { id: colega.id, nome: colega.nome, cargo: colega.cargo },
      ultima: ultima
        ? { conteudo: ultima.conteudo, criadoEm: ultima.criadoEm, minha: false }
        : undefined,
      naoLidas: 0,
    };
  });
}
