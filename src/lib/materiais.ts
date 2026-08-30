import { getSupabase } from "./supabase";
import { msgErro } from "./modo";

/* ==========================================================================
   MATERIAIS DE APOIO DA AULA

   Slide, planilha modelo, checklist, a norma em PDF. É o que a pessoa leva
   para o trabalho no dia seguinte — e, numa escola técnica, costuma ser o que
   ela mais usa depois de assistir.

   Duas origens, como no vídeo:

   · arquivo — sobe para o bucket privado `materiais`. O download acontece por
               URL assinada, válida por poucas horas: o link colado num grupo
               de WhatsApp expira sozinho.
   · link    — endereço externo (planilha no Drive, norma no site da Receita).
               Não faz sentido copiar para dentro o que já é público e muda de
               tempos em tempos na origem.
   ========================================================================== */

export const BUCKET_MATERIAIS = "materiais";

/** Teto do bucket, definido em 04_storage.sql. */
export const LIMITE_MATERIAL_BYTES = 50 * 1024 * 1024;

export type TipoMaterial =
  | "pdf" | "planilha" | "imagem" | "slide" | "documento" | "link" | "outro";

export interface Material {
  id: string;
  aulaId: string;
  titulo: string;
  descricao?: string;
  tipo: TipoMaterial;
  path?: string;
  url?: string;
  nomeArquivo?: string;
  bytes?: number;
  ordem: number;
  criadoEm?: string;
}

export const ROTULO_TIPO: Record<TipoMaterial, string> = {
  pdf: "PDF",
  planilha: "Planilha",
  imagem: "Imagem",
  slide: "Apresentação",
  documento: "Documento",
  link: "Link",
  outro: "Arquivo",
};

/** Adivinha o tipo pela extensão — o admin não deve ter de classificar nada. */
export function tipoPeloNome(nome: string): TipoMaterial {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "planilha";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "imagem";
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return "slide";
  if (["doc", "docx", "odt", "txt", "rtf"].includes(ext)) return "documento";
  return "outro";
}

export function tamanhoLegivel(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Linha = {
  id: string; aula_id: string; titulo: string; descricao: string | null;
  tipo: string; path: string | null; url: string | null;
  nome_arquivo: string | null; bytes: number | null; ordem: number;
  criado_em: string;
};

function mapear(r: Linha): Material {
  return {
    id: r.id,
    aulaId: r.aula_id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    tipo: (r.tipo as TipoMaterial) ?? "outro",
    path: r.path ?? undefined,
    url: r.url ?? undefined,
    nomeArquivo: r.nome_arquivo ?? undefined,
    bytes: r.bytes ?? undefined,
    ordem: r.ordem,
    criadoEm: r.criado_em,
  };
}

export async function materiaisDaAula(aulaId: string): Promise<Material[]> {
  const sb = getSupabase();
  if (!sb || !aulaId) return [];

  const { data, error } = await sb
    .from("aula_materiais")
    .select("*")
    .eq("aula_id", aulaId)
    .order("ordem")
    .order("criado_em");

  if (error) {
    console.error("[materiais] listar:", msgErro(error));
    return [];
  }
  return (data as Linha[]).map(mapear);
}

/** Quantos materiais cada aula tem — para o admin ver na listagem sem abrir. */
export async function contarMateriais(aulaIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const sb = getSupabase();
  if (!sb || aulaIds.length === 0) return mapa;

  const { data, error } = await sb
    .from("aula_materiais")
    .select("aula_id")
    .in("aula_id", aulaIds);

  if (error) return mapa;
  for (const r of (data ?? []) as Array<{ aula_id: string }>) {
    mapa.set(r.aula_id, (mapa.get(r.aula_id) ?? 0) + 1);
  }
  return mapa;
}

export interface ResultadoEnvio {
  path?: string;
  nome?: string;
  bytes?: number;
  erro?: string;
}

/**
 * Sobe o arquivo para `materiais/<cursoSlug>/<aulaId>/<arquivo>`.
 *
 * O caminho carrega curso e aula para o painel do Supabase ficar navegável:
 * quem precisar limpar os arquivos de um curso inteiro consegue, sem cruzar
 * com a tabela.
 */
export async function enviarMaterial(
  arquivo: File,
  cursoSlug: string,
  aulaId: string
): Promise<ResultadoEnvio> {
  const sb = getSupabase();
  if (!sb) {
    return { erro: "O envio de materiais exige o Supabase conectado." };
  }
  if (arquivo.size > LIMITE_MATERIAL_BYTES) {
    return {
      erro: `O arquivo tem ${tamanhoLegivel(arquivo.size)}. O limite por material é ${
        LIMITE_MATERIAL_BYTES / 1024 / 1024
      } MB — para algo maior, use um link externo.`,
    };
  }

  const limpo = arquivo.name
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
  // O carimbo evita que dois envios do mesmo nome se sobrescrevam em silêncio.
  const path = `${cursoSlug}/${aulaId}/${Date.now()}-${limpo}`;

  const { error } = await sb.storage
    .from(BUCKET_MATERIAIS)
    .upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });

  if (error) return { erro: msgErro(error) };
  return { path, nome: arquivo.name, bytes: arquivo.size };
}

export async function salvarMaterial(
  m: Omit<Material, "id" | "criadoEm"> & { id?: string }
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, erro: "Supabase não conectado." };

  const linha = {
    aula_id: m.aulaId,
    titulo: m.titulo.trim(),
    descricao: m.descricao?.trim() || null,
    tipo: m.tipo,
    path: m.path ?? null,
    url: m.url?.trim() || null,
    nome_arquivo: m.nomeArquivo ?? null,
    bytes: m.bytes ?? null,
    ordem: m.ordem,
  };

  const q = m.id
    ? sb.from("aula_materiais").update(linha).eq("id", m.id).select("id").single()
    : sb.from("aula_materiais").insert(linha).select("id").single();

  const { data, error } = await q;
  if (error) return { ok: false, erro: msgErro(error) };
  return { ok: true, id: (data as { id: string }).id };
}

export async function apagarMaterial(m: Material): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "Supabase não conectado.";

  // O arquivo sai junto: linha apagada com o objeto no bucket vira 50 MB
  // ocupados que ninguém mais consegue encontrar.
  if (m.path) {
    await sb.storage.from(BUCKET_MATERIAIS).remove([m.path]);
  }
  const { error } = await sb.from("aula_materiais").delete().eq("id", m.id);
  return error ? msgErro(error) : null;
}

/**
 * Endereço para baixar. Link externo sai como está; arquivo nosso sai assinado.
 * `download` faz o navegador salvar em vez de abrir o PDF numa aba.
 */
export async function urlDoMaterial(m: Material): Promise<string | null> {
  if (m.url) return m.url;
  if (!m.path) return null;

  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.storage
    .from(BUCKET_MATERIAIS)
    .createSignedUrl(m.path, 3600, { download: m.nomeArquivo ?? true });

  if (error) {
    console.error("[materiais] URL assinada:", msgErro(error));
    return null;
  }
  return data?.signedUrl ?? null;
}
