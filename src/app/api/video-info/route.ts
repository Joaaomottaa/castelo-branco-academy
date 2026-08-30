import { NextResponse } from "next/server";

/**
 * DADOS DO VÍDEO A PARTIR DO LINK
 *
 * O YouTube e o Vimeo publicam oEmbed: um endpoint aberto que devolve título,
 * canal e miniatura de qualquer vídeo público ou não listado, sem chave de API
 * e sem consumir cota.
 *
 * A chamada é feita aqui, no servidor, e não no navegador, porque nenhum dos
 * dois manda cabeçalho de CORS — do lado do cliente a requisição morre antes
 * de sair.
 *
 * Isto NÃO envia vídeo para o YouTube. Enviar exige OAuth do dono do canal e
 * uma auditoria de conformidade do projeto — está descrito em
 * docs/PENDENCIAS.md, item 7.1.
 */

export const runtime = "edge";

/** Só estes dois hosts. A rota não pode virar um buscador de URL arbitrária. */
function endpointOEmbed(bruto: string): string | null {
  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com"
      || host === "youtube-nocookie.com") {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(bruto)}`;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(bruto)}`;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const endpoint = endpointOEmbed(url.trim());
  if (!endpoint) {
    return NextResponse.json(
      { erro: "Só consigo ler dados de links do YouTube e do Vimeo." },
      { status: 400 }
    );
  }

  try {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), 8000);
    const r = await fetch(endpoint, { signal: controlador.signal });
    clearTimeout(timer);

    // 401/403 no oEmbed do YouTube quer dizer vídeo privado — que é diferente
    // de link errado, e a diferença muda o que o admin precisa fazer.
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json(
        { erro: "O vídeo existe, mas está privado. Mude para “não listado” para a aula conseguir tocá-lo." },
        { status: 200 }
      );
    }
    if (!r.ok) {
      return NextResponse.json(
        { erro: "Não encontrei esse vídeo. Confira se o link está completo." },
        { status: 200 }
      );
    }

    const d = (await r.json()) as {
      title?: string; author_name?: string; thumbnail_url?: string;
      width?: number; height?: number;
    };

    return NextResponse.json({
      titulo: d.title ?? "",
      canal: d.author_name ?? "",
      thumb: d.thumbnail_url ?? "",
    });
  } catch {
    return NextResponse.json(
      { erro: "Não consegui consultar o vídeo agora. Tente de novo em instantes." },
      { status: 200 }
    );
  }
}
