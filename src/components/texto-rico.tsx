import { cn } from "./ui";

/* ==========================================================================
   Markdown mínimo — negrito, itálico, link nomeado, link solto e lista.
   Suficiente para o que o modelo devolve, sem trazer uma biblioteca inteira
   (e sem o risco de HTML arbitrário: nada aqui usa dangerouslySetInnerHTML).
   ========================================================================== */

const PADRAO = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\)|https?:\/\/\S+)/g;

function Inline({ texto, escuro }: { texto: string; escuro?: boolean }) {
  return (
    <>
      {texto.split(PADRAO).map((p, j) => {
        if (!p) return null;

        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={j} className={escuro ? "text-white" : "text-navy-700"}>
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
          return <em key={j} className="opacity-75">{p.slice(1, -1)}</em>;
        }

        const nomeado = p.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
        if (nomeado) {
          return (
            <a
              key={j}
              href={nomeado[2]}
              target={nomeado[2].startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className={cn(
                "font-semibold underline underline-offset-2",
                escuro ? "text-gold-300" : "text-gold-600"
              )}
            >
              {nomeado[1]}
            </a>
          );
        }

        if (/^https?:\/\//.test(p)) {
          const rotulo = p.includes("whatsapp") ? "falar no WhatsApp" : p;
          return (
            <a
              key={j}
              href={p}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "font-semibold underline underline-offset-2",
                escuro ? "text-gold-300" : "text-gold-600"
              )}
            >
              {rotulo}
            </a>
          );
        }

        return <span key={j}>{p}</span>;
      })}
    </>
  );
}

export function TextoRico({
  texto,
  escuro,
  className,
}: {
  texto: string;
  escuro?: boolean;
  className?: string;
}) {
  const linhas = texto.split("\n");

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {linhas.map((linha, i) => {
        const t = linha.trim();
        if (!t) return <div key={i} className="h-2.5" />;

        const lista = t.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
        if (lista) {
          return (
            <div key={i} className="mt-1 flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full",
                  escuro ? "bg-gold-300" : "bg-gold-400"
                )}
              />
              <span className="min-w-0 flex-1">
                <Inline texto={lista[1]} escuro={escuro} />
              </span>
            </div>
          );
        }

        return (
          <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
            <Inline texto={t} escuro={escuro} />
          </p>
        );
      })}
    </div>
  );
}
