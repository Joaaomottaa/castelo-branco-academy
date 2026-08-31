"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Film, Play } from "lucide-react";
import { urlAssinada, urlDeEmbed } from "@/lib/video";
import type { Aula } from "@/lib/types";

/* ==========================================================================
   PLAYER DA AULA

   Três estados, na ordem em que aparecem na vida real:

   upload  → <video> nativo com a URL assinada do bucket privado. Range
             request funciona, então dá para arrastar a barra.
   youtube → iframe no domínio -nocookie. O YouTube não avisa o fim do vídeo
             sem carregar a IFrame API; em vez de puxar script de terceiro
             (que a CSP e o custo de manutenção não pedem), a avaliação libera
             por botão.
   nenhum  → cartão de demonstração, que é o estado do catálogo importado.
   ========================================================================== */

export function PlayerAula({
  aula,
  cor,
  aoTerminar,
}: {
  aula: Aula;
  cor: string;
  /** Chamado quando o vídeo nativo chega ao fim. */
  aoTerminar?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const ref = useRef<HTMLVideoElement | null>(null);

  const origem = aula.videoOrigem ?? "nenhum";

  useEffect(() => {
    let ativo = true;
    setUrl(null);
    setErro(null);

    if (origem !== "upload" || !aula.videoPath) return;

    setCarregando(true);
    urlAssinada(aula.videoPath)
      .then((u) => {
        if (!ativo) return;
        if (!u) setErro("Não foi possível liberar o vídeo. Recarregue a página.");
        setUrl(u);
      })
      .finally(() => ativo && setCarregando(false));

    return () => {
      ativo = false;
    };
  }, [origem, aula.videoPath]);

  /* ------------------------------------------------------ arquivo próprio */
  if (origem === "upload") {
    return (
      <Moldura cor={cor}>
        {carregando && <Aviso icone={<Film size={22} />} texto="Liberando o vídeo…" />}
        {erro && <Aviso icone={<AlertTriangle size={22} />} texto={erro} />}
        {url && (
          <video
            ref={ref}
            src={url}
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={aoTerminar}
            className="h-full w-full bg-black"
            playsInline
          />
        )}
      </Moldura>
    );
  }

  /* ------------------------------------------------------------- embed -- */
  const embed = urlDeEmbed(aula);
  if (embed) {
    return (
      <Moldura cor={cor}>
        <iframe
          src={embed}
          title={aula.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </Moldura>
    );
  }

  /* ------------------------------------------------ link nao reconhecido -- */
  if (origem === "externo" && aula.videoUrl) {
    return (
      <Moldura cor={cor}>
        <a
          href={aula.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-white/80 transition hover:text-white sm:px-6"
        >
          <Play size={34} />
          <span className="text-sm font-semibold">Abrir o vídeo em nova aba</span>
          <span className="max-w-full truncate text-xs text-white/50">{aula.videoUrl}</span>
        </a>
      </Moldura>
    );
  }

  /* --------------------------------------------------------- sem vídeo -- */
  return (
    <Moldura cor={cor}>
      {/* A moldura é 16:9: em 360px de tela ela tem 157px de altura, e o texto
          de demonstração ficava mais alto do que isso — o fim da frase era
          cortado pela borda. No celular o círculo e a fonte encolhem para o
          recado caber inteiro dentro do quadro. */}
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center sm:gap-3 sm:px-6">
        <span className="gold-gradient flex h-11 w-11 items-center justify-center rounded-full text-navy-800 sm:h-16 sm:w-16">
          <Play size={26} className="ml-1" />
        </span>
        <p className="text-[13px] font-semibold text-white/85 sm:text-sm">Aula ainda sem vídeo publicado</p>
        <p className="max-w-sm text-[11px] leading-snug text-white/50 sm:text-xs sm:leading-relaxed">
          O conteúdo desta aula está descrito abaixo. O vídeo entra pela área
          administrativa, em Cursos › editar aula.
        </p>
      </div>
      <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
        Demonstração
      </span>
    </Moldura>
  );
}

function Moldura({ children, cor }: { children: React.ReactNode; cor: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-navy-900">
      <div
        className="relative aspect-video"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, #001028 100%)` }}
      >
        {children}
      </div>
    </div>
  );
}

function Aviso({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 px-4 text-center text-white/70 sm:px-6">
      {icone}
      <p className="text-sm">{texto}</p>
    </div>
  );
}
