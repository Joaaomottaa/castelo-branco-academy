import { getSupabase } from "./supabase";
import { msgErro } from "./modo";

/* ==========================================================================
   A EMPRESA

   Um escritório contábil não compra doze assinaturas: compra um contrato com
   doze assentos, distribui, cobra e presta contas ao CRC no fim do ano. Este
   módulo é a tradução disso.

   Tudo passa por RPC `security definer`. Não é preguiça de escrever policy: o
   gestor precisa ler o progresso de outra pessoa, e a policy de
   `progresso_aulas` — corretamente — só devolve o do próprio dono. A permissão
   volta explícita dentro da função, checada contra `empresa_membros`.

   Em modo demonstração não há empresa. As telas mostram o aviso em vez de
   inventar um time que não existe: número falso em painel de gestão é pior do
   que tela vazia.
   ========================================================================== */

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  logoUrl?: string;
  cor?: string;
  site?: string;
  telefone?: string;
  descricao?: string;
  segmento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  numero?: string;
  complemento?: string;
  descontoPadrao: number;
  /** Papel de quem está olhando, dentro da empresa. */
  papel: "membro" | "gestor" | "admin";
  gestor: boolean;
  licencas: { contratadas: number; usadas: number; livres: number };
  membros: number;
  convitesPendentes: number;
}

export interface MembroEquipe {
  perfilId: string;
  nome: string;
  email: string;
  avatar?: string;
  cargo?: string;
  papel: "membro" | "gestor" | "admin";
  status: string;
  licenca: boolean;
  descontoPct: number;
  plano: string;
  entrouEm: string;
  ultimoAcesso?: string;
  ultimoEstudo?: string;
  ofensiva: number;
  pontos: number;
  nivel: number;
  horasAno: number;
  certificados: number;
  pontosPepcAno: number;
  trilhas: number;
  formacoesPendentes: number;
  formacoesAtrasadas: number;
}

export interface ResumoEmpresa {
  ano: number;
  membros: number;
  ativos7d: number;
  inativos30d: number;
  horasAno: number;
  certificadosAno: number;
  pontosPepcAno: number;
  metaPepc: number;
  emDia: number;
}

export interface Convite {
  id: string;
  codigo: string;
  email?: string;
  cargo?: string;
  papel: "membro" | "gestor";
  tipo: "licenca" | "desconto";
  descontoPct: number;
  status: "pendente" | "aceito" | "cancelado";
  criadoEm: string;
  expiraEm: string;
  aceitoEm?: string;
}

export interface PessoaNaFormacao {
  perfilId: string;
  nome: string;
  cargo?: string;
  pct: number;
  concluido: boolean;
  atrasado: boolean;
}

export interface Formacao {
  id: string;
  tipo: "curso" | "trilha";
  alvoId: string;
  titulo: string;
  slug: string;
  cor: string;
  cargaHoraria: number;
  prazo?: string;
  obrigatoria: boolean;
  observacao?: string;
  criadoEm: string;
  paraTime: boolean;
  pessoas: PessoaNaFormacao[];
}

/** A mesma atribuição, vista por quem tem de cumprir. */
export interface MinhaFormacao {
  id: string;
  tipo: "curso" | "trilha";
  titulo: string;
  slug: string;
  cor: string;
  prazo?: string;
  obrigatoria: boolean;
  observacao?: string;
  pct: number;
  concluido: boolean;
  diasRestantes?: number | null;
}

export interface ConvitePublico {
  valido: boolean;
  motivo?: "nao-encontrado" | "ja-usado" | "cancelado" | "expirado";
  codigo?: string;
  empresa?: string;
  empresaCor?: string;
  cidade?: string;
  uf?: string;
  tipo?: "licenca" | "desconto";
  papel?: "membro" | "gestor";
  cargo?: string;
  descontoPct?: number;
  email?: string;
  expiraEm?: string;
}

export interface ItemPEPC {
  tipo: "curso" | "trilha";
  titulo: string;
  codigo: string;
  cargaHoraria: number;
  pontos: number;
  emitidoEm: string;
}

export interface LinhaRelatorio {
  perfilId: string;
  nome: string;
  email: string;
  crc?: string;
  cargo?: string;
  pontos: number;
  horas: number;
  itens: ItemPEPC[];
}

export interface RelatorioPEPC {
  ano: number;
  empresa: string;
  membros: LinhaRelatorio[];
}

/* ------------------------------------------------------------- leitura -- */

export async function carregarEmpresa(): Promise<Empresa | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.rpc("empresa_do_usuario");
  return (data as Empresa) ?? null;
}

export async function carregarResumoEmpresa(): Promise<ResumoEmpresa | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.rpc("empresa_resumo");
  return (data as ResumoEmpresa) ?? null;
}

export async function carregarEquipe(): Promise<MembroEquipe[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.rpc("empresa_equipe");
  return (data as MembroEquipe[]) ?? [];
}

export async function carregarFormacoes(): Promise<Formacao[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.rpc("empresa_formacoes");
  return (data as Formacao[]) ?? [];
}

export async function carregarMinhasFormacoes(): Promise<MinhaFormacao[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.rpc("minhas_formacoes");
  return (data as MinhaFormacao[]) ?? [];
}

export async function carregarConvites(): Promise<Convite[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("empresa_convites")
    .select("id, codigo, email, cargo, papel, tipo, desconto_pct, status, criado_em, expira_em, aceito_em")
    .order("criado_em", { ascending: false });
  if (error || !data) return [];
  return data.map((c) => ({
    id: c.id as string,
    codigo: c.codigo as string,
    email: (c.email as string) ?? undefined,
    cargo: (c.cargo as string) ?? undefined,
    papel: c.papel as Convite["papel"],
    tipo: c.tipo as Convite["tipo"],
    descontoPct: c.desconto_pct as number,
    status: c.status as Convite["status"],
    criadoEm: c.criado_em as string,
    expiraEm: c.expira_em as string,
    aceitoEm: (c.aceito_em as string) ?? undefined,
  }));
}

export async function carregarRelatorioPEPC(ano?: number): Promise<RelatorioPEPC | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.rpc("empresa_relatorio_pepc", { p_ano: ano ?? null });
  return (data as RelatorioPEPC) ?? null;
}

/* --------------------------------------------------------------- ações -- */

type Ok = { ok: boolean; erro?: string };

/** Todo RPC de escrita devolve `{ok}` ou `{erro}`; isto normaliza os dois. */
async function chamar(fn: string, args: Record<string, unknown> = {}): Promise<Ok> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: "Disponível apenas com o banco conectado." };
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return { ok: false, erro: msgErro(error) };
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (r.erro) return { ok: false, erro: r.erro };
    return { ok: Boolean(r.ok) };
  } catch (e) {
    return { ok: false, erro: msgErro(e) };
  }
}

export async function criarConvites(p: {
  qtd?: number;
  tipo: "licenca" | "desconto";
  papel: "membro" | "gestor";
  emails?: string[];
  descontoPct?: number;
  cargo?: string;
}): Promise<{ ok: boolean; erro?: string; convites?: Array<{ codigo: string; email?: string }> }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: "Disponível apenas com o banco conectado." };
  const { data, error } = await sb.rpc("empresa_criar_convites", {
    p_qtd: p.qtd ?? 1,
    p_tipo: p.tipo,
    p_papel: p.papel,
    p_emails: p.emails ?? [],
    p_desconto: p.descontoPct ?? 0,
    p_cargo: p.cargo ?? null,
  });
  if (error) return { ok: false, erro: msgErro(error) };
  const r = (data ?? {}) as { ok?: boolean; erro?: string; convites?: Array<{ codigo: string; email?: string }> };
  if (r.erro) return { ok: false, erro: r.erro };
  return { ok: true, convites: r.convites ?? [] };
}

export const cancelarConvite = (id: string) => chamar("empresa_cancelar_convite", { p_id: id });

export const removerMembro = (perfilId: string) =>
  chamar("empresa_remover_membro", { p_perfil: perfilId });

export const definirPapel = (perfilId: string, papel: "membro" | "gestor") =>
  chamar("empresa_definir_papel", { p_perfil: perfilId, p_papel: papel });

export const definirLicenca = (perfilId: string, ativa: boolean) =>
  chamar("empresa_definir_licenca", { p_perfil: perfilId, p_ativa: ativa });

export const sairDaEmpresa = () => chamar("empresa_sair");

export const removerFormacao = (id: string) =>
  chamar("empresa_remover_atribuicao", { p_id: id });

export function atribuirFormacao(p: {
  cursoId?: string;
  trilhaId?: string;
  perfilId?: string;
  prazo?: string;
  obrigatoria: boolean;
  observacao?: string;
}) {
  return chamar("empresa_atribuir", {
    p_curso: p.cursoId ?? null,
    p_trilha: p.trilhaId ?? null,
    p_perfil: p.perfilId ?? null,
    p_prazo: p.prazo || null,
    p_obrigatoria: p.obrigatoria,
    p_observacao: p.observacao || null,
  });
}

/* -------------------------------------------------------------- convite -- */

/** Lida pela tela pública do convite — funciona sem sessão. */
export async function lerConvite(codigo: string): Promise<ConvitePublico> {
  const sb = getSupabase();
  if (!sb) return { valido: false, motivo: "nao-encontrado" };
  const { data, error } = await sb.rpc("convite_publico", { p_codigo: codigo });
  if (error || !data) return { valido: false, motivo: "nao-encontrado" };
  return data as ConvitePublico;
}

export async function aceitarConvite(codigo: string): Promise<{
  ok: boolean;
  erro?: string;
  empresa?: string;
  tipo?: "licenca" | "desconto";
  descontoPct?: number;
}> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: "Disponível apenas com o banco conectado." };
  const { data, error } = await sb.rpc("aceitar_convite", { p_codigo: codigo });
  if (error) return { ok: false, erro: msgErro(error) };
  const r = (data ?? {}) as {
    ok?: boolean; erro?: string; empresa?: string;
    tipo?: "licenca" | "desconto"; descontoPct?: number;
  };
  if (r.erro) return { ok: false, erro: r.erro };
  return { ok: true, empresa: r.empresa, tipo: r.tipo, descontoPct: r.descontoPct };
}

/* -------------------------------------------------------------- cadastro -- */

export interface DadosEmpresaEdicao {
  nome: string;
  cnpj?: string;
  segmento?: string;
  site?: string;
  telefone?: string;
  descricao?: string;
  cor?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
}

/**
 * Grava o cadastro. Vai por `update` direto porque a policy
 * "empresas: gestor edita a própria" já resolve o acesso — e os assentos
 * contratados ficam protegidos pelo gatilho, não pela boa vontade da tela.
 */
export async function salvarCadastroEmpresa(
  id: string,
  d: DadosEmpresaEdicao
): Promise<Ok> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: "Disponível apenas com o banco conectado." };
  const { error } = await sb
    .from("empresas")
    .update({
      nome: d.nome,
      cnpj: d.cnpj || null,
      segmento: d.segmento || null,
      site: d.site || null,
      telefone: d.telefone || null,
      descricao: d.descricao || null,
      cor: d.cor || "#00204D",
      cep: d.cep || null,
      logradouro: d.logradouro || null,
      bairro: d.bairro || null,
      numero: d.numero || null,
      complemento: d.complemento || null,
      cidade: d.cidade || null,
      uf: d.uf || null,
    })
    .eq("id", id);
  if (error) return { ok: false, erro: msgErro(error) };
  return { ok: true };
}

/* ------------------------------------------------------------- utilidade -- */

/** "CB-4K7P-92XD" -> link completo, para copiar e mandar no WhatsApp. */
export function linkDoConvite(codigo: string): string {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/convite/${codigo}`;
}

/* ------------------------------------------------------------- desconto -- */

export interface DescontoDaEmpresa {
  empresa: string;
  pct: number;
}

/**
 * O desconto que a empresa da pessoa oferece no plano Pro.
 *
 * Lê direto de `empresa_membros` — a policy já devolve a própria linha para
 * qualquer membro, então não precisa de RPC. Devolve null quando não há
 * empresa ou quando o vínculo é por licença (aí o Pro já vem incluído e não
 * existe checkout).
 */
export async function meuDescontoDaEmpresa(): Promise<DescontoDaEmpresa | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("empresa_membros")
    .select("desconto_pct, licenca, status, empresas ( nome )")
    .eq("status", "ativo")
    .limit(1);

  const linha = (data ?? [])[0] as
    | { desconto_pct: number; licenca: boolean; empresas: { nome: string } | null }
    | undefined;

  if (!linha || linha.licenca || !linha.desconto_pct) return null;
  return { empresa: linha.empresas?.nome ?? "sua empresa", pct: linha.desconto_pct };
}
