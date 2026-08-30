"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./ui";

/* ==========================================================================
   PAGINAÇÃO

   Sempre mostra a primeira e a última página, mais as vizinhas da atual. Uma
   régua com cinquenta números é tão inútil quanto rolar quinhentas questões.

   O espaço embaixo existe porque o botão flutuante do Tino fica no canto
   inferior direito: sem folga, ele cobre justamente a seta de "próxima".
   ========================================================================== */

export function Paginacao({
  pagina, total, primeiro, ultimo, itens, rotulo = "itens", aoIr,
}: {
  pagina: number;
  total: number;
  primeiro: number;
  ultimo: number;
  itens: number;
  /** Plural do que está sendo paginado: "questões", "vagas"… */
  rotulo?: string;
  aoIr: (p: number) => void;
}) {
  if (itens === 0) return null;

  const numeros: Array<number | "..."> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - pagina) <= 1) numeros.push(i);
    else if (numeros[numeros.length - 1] !== "...") numeros.push("...");
  }

  function ir(p: number) {
    aoIr(p);
    // Trocar de página sem voltar ao topo deixa a pessoa no meio da lista nova,
    // lendo a questão 4 achando que é a 1.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-20 pt-2 sm:pb-2">
      <p className="text-xs text-muted">
        {primeiro}–{ultimo} de {itens} {rotulo}
      </p>

      {total > 1 && (
        <div className="flex items-center gap-1 rounded-full bg-white/90 p-1 backdrop-blur">
          <button
            onClick={() => ir(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className="rounded-lg p-2 text-muted transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={16} />
          </button>

          {numeros.map((n, i) =>
            n === "..." ? (
              <span key={`e${i}`} className="px-1.5 text-xs text-muted">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => ir(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={cn(
                  "min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                  n === pagina
                    ? "bg-navy-700 text-white"
                    : "text-muted hover:bg-navy-50 hover:text-navy-700"
                )}
              >
                {n}
              </button>
            )
          )}

          <button
            onClick={() => ir(pagina + 1)}
            disabled={pagina >= total}
            aria-label="Próxima página"
            className="rounded-lg p-2 text-muted transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
