import { getSupabase } from "./supabase";
import { msgErro } from "./modo";
import type { Aula, OrigemVideo } from "./types";

/* ==========================================================================
   VÍDEO DA AULA

   Duas origens, escolhidas para o MVP não custar nada:

   1. upload  → arquivo no bucket `videos` do próprio Supabase.
                Grátis no plano free, mas 50 MB por arquivo e 1 GB no total.
                Serve MP4 progressivo: sem qualidade adaptativa, sem proteção
                além da URL assinada. É o suficiente para demonstrar.

   2. youtube → vídeo "não listado" no YouTube. Grátis, sem limite de tamanho,
                já entrega transcodificação, CDN e player adaptativo.
                A pessoa precisa do link, mas o vídeo não aparece em buscas.

   Para produção a decisão continua sendo Bunny ou Cloudflare Stream — só que
   agora o campo `video_origem` já existe e vira mais um caso aqui.
   ========================================================================== */

export const BUCKET_VIDEOS = "videos";

/** Teto por arquivo no plano free do Supabase. */
export const LIMITE_UPLOAD_BYTES = 50 * 1024 * 1024;

export const TIPOS_ACEITOS = ["video/mp4", "video/webm", "video/quicktime"];

/* ------------------------------------------------------------- YouTube -- */
/** Extrai o id de qualquer formato de link do YouTube. */
export function idDoYoutube(url: string): string | null {
  const padroes = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const p of padroes) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

export function idDoVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : /^\d{6,}$/.test(url.trim()) ? url.trim() : null;
}

/** Descobre a origem a partir do link colado, sem obrigar o admin a escolher. */
export function detectarOrigem(url: string): OrigemVideo {
  if (!url.trim()) return "nenhum";
  if (idDoYoutube(url)) return "youtube";
  if (idDoVimeo(url)) return "vimeo";
  return "externo";
}

export function urlDeEmbed(aula: Pick<Aula, "videoOrigem" | "videoUrl">): string | null {
  const url = aula.videoUrl ?? "";
  if (aula.videoOrigem === "youtube") {
    const id = idDoYoutube(url);
    // rel=0 evita sugerir vídeo de concorrente no fim; modestbranding reduz a marca.
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
  }
  if (aula.videoOrigem === "vimeo") {
    const id = idDoVimeo(url);
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

/* -------------------------------------------------------------- upload -- */
export interface ResultadoUpload {
  path?: string;
  nome?: string;
  bytes?: number;
  erro?: string;
}

/**
 * Envia o arquivo para o bucket `videos`.
 * O caminho é `<cursoSlug>/<aulaId>-<arquivo>` para ficar legível no painel do
 * Supabase — quem precisar apagar em massa consegue.
 */
export async function enviarVideo(
  arquivo: File,
  cursoSlug: string,
  aulaId: string,
  aoProgredir?: (pct: number) => void
): Promise<ResultadoUpload> {
  const sb = getSupabase();
  if (!sb) {
    return { erro: "Upload de vídeo exige o Supabase conectado. Troque o modo para Supabase." };
  }
  if (arquivo.size > LIMITE_UPLOAD_BYTES) {
    return {
      erro: `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(0)} MB. O limite do plano free do Supabase é 50 MB — use o link do YouTube para vídeos maiores.`,
    };
  }

  const limpo = arquivo.name
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")  // NFD solta o acento; some com ele
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
  const path = `${cursoSlug}/${aulaId}-${limpo}`;

  // O SDK não expõe progresso real de upload; o indicador serve para a pessoa
  // saber que algo está acontecendo num arquivo de dezenas de MB.
  aoProgredir?.(10);
  const { error } = await sb.storage
    .from(BUCKET_VIDEOS)
    .upload(path, arquivo, { upsert: true, contentType: arquivo.type });
  aoProgredir?.(100);

  if (error) return { erro: msgErro(error) };
  return { path, nome: arquivo.name, bytes: arquivo.size };
}

/** URL temporária para tocar o vídeo. O bucket é privado de propósito. */
export async function urlAssinada(path: string, segundos = 7200): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.storage
    .from(BUCKET_VIDEOS)
    .createSignedUrl(path, segundos);
  if (error) {
    console.error("[video] URL assinada:", msgErro(error));
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function apagarVideo(path: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.storage.from(BUCKET_VIDEOS).remove([path]);
}

/** Rótulo curto para badge na listagem. */
export function rotuloOrigem(o: OrigemVideo | undefined): string {
  return (
    { nenhum: "Sem vídeo", upload: "Arquivo", youtube: "YouTube", vimeo: "Vimeo", externo: "Link" } as Record<
      string,
      string
    >
  )[o ?? "nenhum"] ?? "Sem vídeo";
}
