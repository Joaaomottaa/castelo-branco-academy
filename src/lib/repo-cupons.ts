import { getSupabase } from "./supabase";
import { msgErro } from "./modo";

/* ==========================================================================
   CUPONS

   O aluno nunca lê a tabela `cupons` — a lista completa entregaria todo código
   promocional de uma vez. Ele manda o código e a RPC `validar_cupom` devolve
   só duas coisas: vale ou não, e quanto desconta.

   A contratação também é RPC: assinatura, pagamento, registro do uso e a
   troca de plano acontecem numa transação só, no banco. Quando o gateway
   entrar, quem chama passa a ser o webhook em vez do navegador — e nada mais
   muda.
   ========================================================================== */

export interface Cupom {
  id: string;
  codigo: string;
  descricao?: string;
  tipo: "percentual" | "valor";
  valor: number;
  planos: string[];
  ciclos: string[];
  limiteUsos?: number;
  limitePorPessoa: number;
  usos: number;
  iniciaEm: string;
  expiraEm?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface UsoDeCupom {
  id: string;
  cupomId: string;
  codigo: string;
  perfilNome: string;
  plano?: string;
  ciclo?: string;
  valorOriginal: number;
  valorDesconto: number;
  valorFinal: number;
  criadoEm: string;
}

export interface CupomValidado {
  valido: boolean;
  motivo?: string;
  codigo?: string;
  descricao?: string;
  tipo?: "percentual" | "valor";
  valor?: number;
  desconto?: number;
  final?: number;
}

export interface ResultadoContratacao {
  ok: boolean;
  erro?: string;
  plano?: string;
  ciclo?: string;
  metodo?: string;
  valorOriginal?: number;
  desconto?: number;
  valorPago?: number;
  expiraEm?: string;
}

const SEM_BANCO =
  "Esta ação grava no banco. Troque a chave no topo para “Supabase” e tente de novo.";

type Linha = {
  id: string; codigo: string; descricao: string | null; tipo: string; valor: number;
  planos: string[]; ciclos: string[]; limite_usos: number | null;
  limite_por_pessoa: number; usos: number; inicia_em: string;
  expira_em: string | null; ativo: boolean; criado_em: string;
};

function mapear(r: Linha): Cupom {
  return {
    id: r.id,
    codigo: r.codigo,
    descricao: r.descricao ?? undefined,
    tipo: r.tipo as Cupom["tipo"],
    valor: Number(r.valor),
    planos: r.planos ?? [],
    ciclos: r.ciclos ?? [],
    limiteUsos: r.limite_usos ?? undefined,
    limitePorPessoa: r.limite_por_pessoa,
    usos: r.usos,
    iniciaEm: r.inicia_em,
    expiraEm: r.expira_em ?? undefined,
    ativo: r.ativo,
    criadoEm: r.criado_em,
  };
}

/* --------------------------------------------------------------- admin -- */
export async function listarCupons(): Promise<{ cupons: Cupom[]; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { cupons: [], erro: SEM_BANCO };

  const { data, error } = await sb
    .from("cupons").select("*").order("criado_em", { ascending: false });
  if (error) return { cupons: [], erro: msgErro(error) };
  return { cupons: ((data ?? []) as Linha[]).map(mapear) };
}

export interface DadosCupom {
  id?: string;
  codigo: string;
  descricao: string;
  tipo: "percentual" | "valor";
  valor: number;
  planos: string[];
  ciclos: string[];
  limiteUsos: string;
  limitePorPessoa: number;
  expiraEm: string;
  ativo: boolean;
}

export async function salvarCupom(d: DadosCupom): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };

  const codigo = d.codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,24}$/.test(codigo)) {
    return {
      ok: false,
      erro: "O código deve ter de 3 a 24 caracteres, só letras, números e hífen.",
    };
  }
  if (d.valor <= 0) return { ok: false, erro: "O desconto precisa ser maior que zero." };
  if (d.tipo === "percentual" && d.valor > 100) {
    return { ok: false, erro: "Desconto percentual não pode passar de 100%." };
  }

  const linha = {
    codigo,
    descricao: d.descricao.trim() || null,
    tipo: d.tipo,
    valor: d.valor,
    planos: d.planos,
    ciclos: d.ciclos,
    limite_usos: d.limiteUsos.trim() ? Number(d.limiteUsos) : null,
    limite_por_pessoa: Math.max(1, d.limitePorPessoa),
    expira_em: d.expiraEm ? new Date(`${d.expiraEm}T23:59:59`).toISOString() : null,
    ativo: d.ativo,
  };

  const { error } = d.id
    ? await sb.from("cupons").update(linha).eq("id", d.id)
    : await sb.from("cupons").insert(linha);

  if (error) {
    const m = msgErro(error);
    if (m.includes("duplicate") || m.includes("unique")) {
      return { ok: false, erro: `Já existe um cupom com o código ${codigo}.` };
    }
    return { ok: false, erro: m };
  }
  return { ok: true };
}

export async function alternarCupom(id: string, ativo: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("cupons").update({ ativo }).eq("id", id);
}

export async function apagarCupom(id: string): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: SEM_BANCO };
  const { error } = await sb.from("cupons").delete().eq("id", id);
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}

export async function listarUsos(): Promise<UsoDeCupom[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("cupom_usos")
    .select(
      `id, cupom_id, plano, ciclo, valor_original, valor_desconto, valor_final,
       criado_em, cupons ( codigo ), perfis ( nome )`
    )
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[cupons] usos:", msgErro(error));
    return [];
  }

  type L = {
    id: string; cupom_id: string; plano: string | null; ciclo: string | null;
    valor_original: number; valor_desconto: number; valor_final: number;
    criado_em: string; cupons: { codigo: string } | null; perfis: { nome: string } | null;
  };

  return ((data ?? []) as unknown as L[]).map((r) => ({
    id: r.id,
    cupomId: r.cupom_id,
    codigo: r.cupons?.codigo ?? "—",
    perfilNome: r.perfis?.nome ?? "Aluno",
    plano: r.plano ?? undefined,
    ciclo: r.ciclo ?? undefined,
    valorOriginal: Number(r.valor_original),
    valorDesconto: Number(r.valor_desconto),
    valorFinal: Number(r.valor_final),
    criadoEm: r.criado_em,
  }));
}

/* ---------------------------------------------------------------- aluno -- */
export async function validarCupom(
  codigo: string,
  plano: string,
  ciclo: string,
  valor: number
): Promise<CupomValidado> {
  const sb = getSupabase();
  if (!sb) {
    // Demonstração: um código conhecido, para o fluxo poder ser mostrado.
    if (codigo.trim().toUpperCase() === "CASTELO50") {
      return {
        valido: true, codigo: "CASTELO50", descricao: "Metade do preço (demonstração)",
        tipo: "percentual", valor: 50, desconto: valor / 2, final: valor / 2,
      };
    }
    return { valido: false, motivo: "No modo demonstração, só o código CASTELO50 responde." };
  }

  const { data, error } = await sb.rpc("validar_cupom", {
    p_codigo: codigo, p_plano: plano, p_ciclo: ciclo, p_valor: valor,
  });
  if (error) return { valido: false, motivo: msgErro(error) };

  const d = (data ?? {}) as Record<string, unknown>;
  return {
    valido: Boolean(d.valido),
    motivo: (d.motivo as string) ?? undefined,
    codigo: (d.codigo as string) ?? undefined,
    descricao: (d.descricao as string) ?? undefined,
    tipo: (d.tipo as CupomValidado["tipo"]) ?? undefined,
    valor: d.valor !== undefined ? Number(d.valor) : undefined,
    desconto: d.desconto !== undefined ? Number(d.desconto) : undefined,
    final: d.final !== undefined ? Number(d.final) : undefined,
  };
}

export async function contratarPlano(opcoes: {
  plano: string;
  ciclo: "mensal" | "anual";
  metodo: string;
  valor: number;
  cupom?: string;
}): Promise<ResultadoContratacao> {
  const sb = getSupabase();
  if (!sb) {
    // Sem banco, a troca fica só na sessão do navegador — e a tela avisa.
    return {
      ok: true, plano: opcoes.plano, ciclo: opcoes.ciclo, metodo: opcoes.metodo,
      valorOriginal: opcoes.valor, desconto: 0, valorPago: opcoes.valor,
    };
  }

  const { data, error } = await sb.rpc("contratar_plano", {
    p_plano: opcoes.plano,
    p_ciclo: opcoes.ciclo,
    p_metodo: opcoes.metodo,
    p_valor: opcoes.valor,
    p_cupom: opcoes.cupom ?? null,
  });
  if (error) return { ok: false, erro: msgErro(error) };

  const d = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    plano: d.plano as string,
    ciclo: d.ciclo as string,
    metodo: d.metodo as string,
    valorOriginal: Number(d.valor_original ?? 0),
    desconto: Number(d.desconto ?? 0),
    valorPago: Number(d.valor_pago ?? 0),
    expiraEm: d.expira_em as string,
  };
}

export async function cancelarPlano(): Promise<{ ok: boolean; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: true };
  const { error } = await sb.rpc("cancelar_plano");
  return error ? { ok: false, erro: msgErro(error) } : { ok: true };
}
