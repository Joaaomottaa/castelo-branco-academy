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
  requisitos: string[];
  cursosDesejados: string[];
  trilhasDesejadas: string[];
  ativa: boolean;
  publicadaEm: string;
  candidatos: number;
}

export interface Candidato {
  candidaturaId: string;
  status: string;
  criadaEm: string;
  mensagem?: string;
  perfil: Perfil;
  certificados: Certificado[];
  trilhas: CertificadoTrilha[];
}

/* --------------------------------------------------------------- vagas -- */
type LinhaVaga = {
  id: string; empresa_id: string; titulo: string; descricao: string | null;
  cidade: string | null; uf: string | null; modelo: string; contrato: string;
  faixa: string | null; senioridade: string | null; requisitos: string[] | null;
  cursos_desejados: string[] | null; trilhas_desejadas: string[] | null;
  ativa: boolean; publicada_em: string;
  empresas: { nome: string; cor: string | null } | null;
  candidaturas: Array<{ count: number }>;
};

export async function carregarVagasAdmin(): Promise<{ vagas: VagaAdmin[]; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { vagas: [], erro: SEM_BANCO };

  const { data, error } = await sb
    .from("vagas")
    .select(
      `id, empresa_id, titulo, descricao, cidade, uf, modelo, contrato, faixa,
       senioridade, requisitos, cursos_desejados, trilhas_desejadas, ativa,
       publicada_em, empresas ( nome, cor ), candidaturas ( count )`
    )
    .order("publicada_em", { ascending: false });

  if (error) return { vagas: [], erro: msgErro(error) };

  return {
    vagas: ((data ?? []) as unknown as LinhaVaga[]).map((v) => ({
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
      requisitos: v.requisitos ?? [],
      cursosDesejados: v.cursos_desejados ?? [],
      trilhasDesejadas: v.trilhas_desejadas ?? [],
      ativa: v.ativa,
      publicadaEm: v.publicada_em,
      candidatos: v.candidaturas?.[0]?.count ?? 0,
    })),
  };
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
  requisitos: string[];
  cursosDesejados: string[];
  trilhasDesejadas: string[];
  ativa: boolean;
}

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
    // Arrays vazios são válidos: vaga sem certificação exigida é o caso comum.
    requisitos: d.requisitos,
    cursos_desejados: d.cursosDesejados,
    trilhas_desejadas: d.trilhasDesejadas,
    ativa: d.ativa,
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
