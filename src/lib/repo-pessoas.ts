import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Perfil } from "./types";
import { mapSelos } from "./repo";

/* ==========================================================================
   PESSOAS E COMUNICAÇÃO — lado administrativo

   Ativar/desativar conta, mandar e-mail para uma pessoa e disparar campanha
   para um público filtrado.

   Sobre e-mail: não há SMTP configurado. Em vez de fingir envio, a mensagem
   entra na fila `emails_admin` como 'pendente' E vira notificação no app — que
   é o único canal que realmente chega hoje. A tela diz isso com todas as
   letras.
   ========================================================================== */

const SEM_BANCO =
  "Esta ação grava no banco. Troque a chave no topo para “Supabase” e tente de novo.";

/* ------------------------------------------------------ ativar/desativar -- */
export async function definirStatusPerfil(
  perfilId: string,
  ativo: boolean,
  motivo?: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  const { error } = await sb.rpc("definir_status_perfil", {
    p_perfil: perfilId, p_ativo: ativo, p_motivo: motivo ?? null,
  });
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function definirPlanoDoPerfil(
  perfilId: string,
  plano: string
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("perfis").update({ plano }).eq("id", perfilId);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

/* ----------------------------------------------------------- e-mail ----- */
export async function enviarEmail(
  perfilId: string,
  assunto: string,
  corpo: string
): Promise<{ ok: boolean; erro?: string; destinatario?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  if (!assunto.trim()) return { ok: false, erro: "Escreva um assunto." };
  if (!corpo.trim()) return { ok: false, erro: "Escreva a mensagem." };

  const { data, error } = await sb.rpc("enfileirar_email", {
    p_perfil: perfilId, p_assunto: assunto.trim(), p_corpo: corpo.trim(),
  });
  if (error) return { ok: false, erro: msgErro(error) };

  const d = (data ?? {}) as Record<string, unknown>;
  return { ok: true, destinatario: d.destinatario as string };
}

/* ---------------------------------------------------- detalhe do aluno -- */
export interface DetalheAluno {
  perfil: Perfil & { ativo?: boolean; ultimoAcesso?: string; motivoDesativacao?: string };
  certificados: Array<{ curso: string; emitidoEm: string; codigo: string }>;
  trilhas: Array<{ nome: string; emitidoEm: string }>;
  matriculas: number;
  aulasConcluidas: number;
  candidaturas: number;
  posts: number;
}

export async function carregarDetalheAluno(perfilId: string): Promise<DetalheAluno | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const [rPerfil, rCert, rTrilha, rMat, rProg, rCand, rPosts] = await Promise.all([
    sb.from("perfis")
      .select(
        `id, nome, email, role, cidade, uf, crc, cargo, bio, senioridade, pretensao,
         linkedin, telefone, contato_publico, disponivel, plano, pontos, nivel,
         ofensiva, ativo, ultimo_acesso, motivo_desativacao,
         perfil_habilidades (
           nivel, verificada, origem, selo, obtida_em,
           habilidades ( nome ), cursos ( slug, titulo ), trilhas ( slug, nome )
         )`
      )
      .eq("id", perfilId).maybeSingle(),
    sb.from("certificados")
      .select("codigo, emitido_em, cursos ( titulo )").eq("perfil_id", perfilId),
    sb.from("certificados_trilha")
      .select("emitido_em, trilhas ( nome )").eq("perfil_id", perfilId),
    sb.from("matriculas").select("id", { count: "exact", head: true }).eq("perfil_id", perfilId),
    sb.from("progresso_aulas").select("aula_id", { count: "exact", head: true })
      .eq("perfil_id", perfilId).eq("concluida", true),
    sb.from("candidaturas").select("id", { count: "exact", head: true }).eq("perfil_id", perfilId),
    sb.from("posts").select("id", { count: "exact", head: true }).eq("autor_id", perfilId),
  ]);

  if (rPerfil.error || !rPerfil.data) {
    console.error("[pessoas] detalhe:", msgErro(rPerfil.error));
    return null;
  }

  type LP = {
    id: string; nome: string; email: string; role: string; cidade: string | null;
    uf: string | null; crc: string | null; cargo: string | null; bio: string | null;
    senioridade: string | null; pretensao: string | null; linkedin: string | null;
    telefone: string | null; contato_publico: boolean | null;
    disponivel: boolean; plano: string; pontos: number; nivel: number;
    ofensiva: number | null; ativo: boolean; ultimo_acesso: string | null;
    motivo_desativacao: string | null;
    perfil_habilidades: Parameters<typeof mapSelos>[0];
  };
  const p = rPerfil.data as unknown as LP;

  return {
    perfil: {
      id: p.id, nome: p.nome, email: p.email, role: p.role as Perfil["role"],
      cidade: p.cidade ?? undefined, uf: p.uf ?? undefined, crc: p.crc ?? undefined,
      cargo: p.cargo ?? undefined, bio: p.bio ?? undefined,
      senioridade: (p.senioridade ?? undefined) as Perfil["senioridade"],
      pretensao: p.pretensao ?? undefined, linkedin: p.linkedin ?? undefined,
      telefone: p.telefone ?? undefined,
      contatoPublico: p.contato_publico ?? true,
      disponivel: p.disponivel, plano: p.plano as Perfil["plano"],
      pontos: p.pontos, nivel: p.nivel, ofensiva: p.ofensiva ?? 0,
      selos: mapSelos(p.perfil_habilidades),
      habilidades: mapSelos(p.perfil_habilidades).map((h) => h.nome),
      ativo: p.ativo,
      ultimoAcesso: p.ultimo_acesso ?? undefined,
      motivoDesativacao: p.motivo_desativacao ?? undefined,
    },
    certificados: ((rCert.data ?? []) as unknown as Array<{
      codigo: string; emitido_em: string; cursos: { titulo: string } | null;
    }>).map((c) => ({
      curso: c.cursos?.titulo ?? "Curso", emitidoEm: c.emitido_em, codigo: c.codigo,
    })),
    trilhas: ((rTrilha.data ?? []) as unknown as Array<{
      emitido_em: string; trilhas: { nome: string } | null;
    }>).map((t) => ({ nome: t.trilhas?.nome ?? "Trilha", emitidoEm: t.emitido_em })),
    matriculas: rMat.count ?? 0,
    aulasConcluidas: rProg.count ?? 0,
    candidaturas: rCand.count ?? 0,
    posts: rPosts.count ?? 0,
  };
}

/* -------------------------------------------------------- campanhas ----- */
export interface FiltroCampanha {
  papel?: string;
  planos?: string[];
  inativoDias?: number;
  ativoUltimosDias?: number;
  uf?: string;
  semCertificado?: boolean;
  semMatricula?: boolean;
  comTrilha?: boolean;
  somenteAtivos?: boolean;
}

export interface Destinatario {
  id: string;
  nome: string;
  email: string;
  plano: string;
  ultimoAcesso?: string;
}

/** Monta o objeto que vai para o banco, sem os campos vazios. */
export function limparFiltro(f: FiltroCampanha): Record<string, unknown> {
  const o: Record<string, unknown> = { somenteAtivos: f.somenteAtivos ?? true };
  if (f.papel) o.papel = f.papel;
  if (f.planos?.length) o.planos = f.planos;
  if (f.inativoDias) o.inativoDias = f.inativoDias;
  if (f.ativoUltimosDias) o.ativoUltimosDias = f.ativoUltimosDias;
  if (f.uf) o.uf = f.uf;
  if (f.semCertificado) o.semCertificado = true;
  if (f.semMatricula) o.semMatricula = true;
  if (f.comTrilha) o.comTrilha = true;
  return o;
}

export async function preverPublico(f: FiltroCampanha): Promise<{
  lista: Destinatario[]; erro?: string;
}> {
  const sb = getSupabase();
  if (!sb) return { lista: [], erro: SEM_BANCO };

  const { data, error } = await sb.rpc("publico_da_campanha", { p_filtro: limparFiltro(f) });
  if (error) return { lista: [], erro: msgErro(error) };

  type L = { id: string; nome: string; email: string; plano: string; ultimo_acesso: string | null };
  return {
    lista: ((data ?? []) as L[]).map((d) => ({
      id: d.id, nome: d.nome, email: d.email, plano: d.plano,
      ultimoAcesso: d.ultimo_acesso ?? undefined,
    })),
  };
}

export async function dispararCampanha(opcoes: {
  titulo: string;
  mensagem: string;
  tipo: string;
  link?: string;
  canais: string[];
  filtro: FiltroCampanha;
}): Promise<{ ok: boolean; erro?: string; destinatarios?: number }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  const { data, error } = await sb.rpc("disparar_campanha", {
    p_titulo: opcoes.titulo.trim(),
    p_mensagem: opcoes.mensagem.trim(),
    p_tipo: opcoes.tipo,
    p_link: opcoes.link?.trim() ?? null,
    p_filtro: limparFiltro(opcoes.filtro),
    p_canais: opcoes.canais,
  });
  if (error) return { ok: false, erro: msgErro(error) };

  const d = (data ?? {}) as Record<string, unknown>;
  return { ok: true, destinatarios: Number(d.destinatarios ?? 0) };
}

export interface Campanha {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  canais: string[];
  destinatarios: number;
  criadoEm: string;
}

export async function listarCampanhas(): Promise<Campanha[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("campanhas")
    .select("id, titulo, mensagem, tipo, canais, destinatarios, criado_em")
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[campanhas] listar:", msgErro(error));
    return [];
  }

  type L = {
    id: string; titulo: string; mensagem: string; tipo: string;
    canais: string[]; destinatarios: number; criado_em: string;
  };
  return ((data ?? []) as L[]).map((c) => ({
    id: c.id, titulo: c.titulo, mensagem: c.mensagem, tipo: c.tipo,
    canais: c.canais ?? [], destinatarios: c.destinatarios, criadoEm: c.criado_em,
  }));
}

/* --------------------------------------------------- notificações do eu -- */
export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  link?: string;
  lida: boolean;
  criadoEm: string;
}

export async function minhasNotificacoes(): Promise<Notificacao[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data: sessao } = await sb.auth.getUser();
  const uid = sessao.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from("notificacoes")
    .select("id, titulo, mensagem, tipo, link, lida, criado_em")
    .eq("perfil_id", uid)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) return [];

  type L = {
    id: string; titulo: string; mensagem: string; tipo: string;
    link: string | null; lida: boolean; criado_em: string;
  };
  return ((data ?? []) as L[]).map((r) => ({
    id: r.id, titulo: r.titulo, mensagem: r.mensagem, tipo: r.tipo,
    link: r.link ?? undefined, lida: r.lida, criadoEm: r.criado_em,
  }));
}

export async function marcarNotificacoesLidas(ids: string[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || ids.length === 0) return;
  await sb.from("notificacoes").update({ lida: true }).in("id", ids);
}

/* ==========================================================================
   CONTATO ENTRE PESSOAS

   O botão "Entrar em contato" da ficha do talento passa por aqui. Não dá para
   inserir direto em `notificacoes`: a tabela não tem policy de INSERT, e criar
   uma seria dar a qualquer pessoa o direito de escrever na caixa de qualquer
   outra. A RPC `mensagem_para_talento` faz a checagem de quem pode falar com
   quem, aplica o limite diário e deixa rastro em `conversas`/`mensagens`.
   ========================================================================== */
export async function mensagemParaTalento(
  perfilId: string,
  assunto: string,
  mensagem: string
): Promise<{ ok?: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { erro: SEM_BANCO };

  const { error } = await sb.rpc("mensagem_para_talento", {
    p_perfil: perfilId,
    p_assunto: assunto,
    p_mensagem: mensagem,
  });

  return error ? { erro: msgErro(error) } : { ok: true };
}

/* ==========================================================================
   EDIÇÃO DO PERFIL PELA ADMINISTRAÇÃO

   A policy "perfis: admin atualiza" já existia; faltava a tela. Vale para
   corrigir dado errado de cadastro (cidade, CRC, cargo) sem pedir para a
   pessoa entrar — o caso mais comum no suporte.

   Habilidade não entra aqui de propósito: ela é conquista de curso, não
   campo de cadastro.
   ========================================================================== */
export async function atualizarPerfilComoAdmin(
  perfilId: string,
  campos: {
    nome?: string; cargo?: string; cidade?: string; uf?: string; crc?: string;
    bio?: string; senioridade?: string; pretensao?: string; linkedin?: string;
    telefone?: string; disponivel?: boolean; contatoPublico?: boolean;
  }
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  if (campos.nome !== undefined && !campos.nome.trim()) {
    return { ok: false, erro: "O nome não pode ficar em branco." };
  }

  const linha: Record<string, unknown> = {};
  const texto = (v?: string) => (v === undefined ? undefined : v.trim() || null);

  if (campos.nome !== undefined) linha.nome = campos.nome.trim();
  if (campos.cargo !== undefined) linha.cargo = texto(campos.cargo);
  if (campos.cidade !== undefined) linha.cidade = texto(campos.cidade);
  if (campos.uf !== undefined) linha.uf = campos.uf.trim().toUpperCase() || null;
  if (campos.crc !== undefined) linha.crc = texto(campos.crc);
  if (campos.bio !== undefined) linha.bio = texto(campos.bio);
  if (campos.senioridade !== undefined) linha.senioridade = texto(campos.senioridade);
  if (campos.pretensao !== undefined) linha.pretensao = texto(campos.pretensao);
  if (campos.linkedin !== undefined) linha.linkedin = texto(campos.linkedin);
  if (campos.telefone !== undefined) linha.telefone = texto(campos.telefone);
  if (campos.contatoPublico !== undefined) linha.contato_publico = campos.contatoPublico;

  // Estar visível no banco de talentos e estar disponível andam juntos: o
  // aluno controla os dois com uma caixa só, e o admin não pode desalinhar.
  if (campos.disponivel !== undefined) {
    linha.disponivel = campos.disponivel;
    linha.perfil_publico = campos.disponivel;
  }

  const { error } = await sb.from("perfis").update(linha).eq("id", perfilId);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

/* ==========================================================================
   AUTODECLARAÇÃO DE DIVERSIDADE (opcional)

   Mora em tabela separada (`perfil_diversidade`), e não em `perfis`, por um
   motivo concreto: perfil público é legível por qualquer pessoa logada, e
   demografia por indivíduo é exatamente o que não pode circular. Ali só o
   dono lê a própria linha; a empresa vê contagem, e só a partir de cinco
   declarações na vaga.

   Responder é opcional — a LGPD não admite pergunta pessoal obrigatória em
   processo seletivo — e o dado nunca entra em ordenação de candidato.
   ========================================================================== */

export interface Diversidade {
  pcd?: boolean | null;
  pcdTipo?: string | null;
  genero?: string | null;
  racaCor?: string | null;
}

export const OPCOES_GENERO = [
  "Mulher cisgênero",
  "Homem cisgênero",
  "Mulher transgênero",
  "Homem transgênero",
  "Pessoa não binária",
  "Prefiro não responder",
];

export const OPCOES_RACA_COR = [
  "Branca",
  "Preta",
  "Parda",
  "Amarela",
  "Indígena",
  "Prefiro não responder",
];

export const OPCOES_PCD = [
  "Física",
  "Auditiva",
  "Visual",
  "Intelectual",
  "Psicossocial",
  "Múltipla",
  "Reabilitado(a) pelo INSS",
];

export async function minhaDiversidade(): Promise<Diversidade | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("minha_diversidade");
  if (error) {
    console.error("[diversidade] ler:", msgErro(error));
    return null;
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    pcd: (d.pcd as boolean) ?? null,
    pcdTipo: (d.pcd_tipo as string) ?? null,
    genero: (d.genero as string) ?? null,
    racaCor: (d.raca_cor as string) ?? null,
  };
}

export async function salvarMinhaDiversidade(
  d: Diversidade
): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, erro: "Esta preferência é gravada no banco. Conecte o Supabase." };
  }
  const { error } = await sb.rpc("salvar_minha_diversidade", {
    p_pcd: d.pcd ?? null,
    p_pcd_tipo: d.pcdTipo ?? null,
    p_genero: d.genero ?? null,
    p_raca_cor: d.racaCor ?? null,
  });
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}
