"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Card, cn } from "@/components/ui";
import { useSession } from "@/lib/session";
import { totalParaRevisar } from "@/lib/repo-questoes";

/* ==========================================================================
   O CHAMADO DA REVISÃO

   Duas formas do mesmo aviso: um cartão para o painel e uma faixa estreita
   para o topo do banco de questões. Os dois consultam só o número — a fila
   inteira só é carregada quando a pessoa entra em /app/questoes/revisar.

   Com a fila vazia o cartão não some: "está em dia" é informação, e sumir
   faria a pessoa procurar o que não existe. Já a faixa some, porque ali ela
   competiria com o filtro que a pessoa veio usar.
   ========================================================================== */

function useTotalRevisao() {
  const { user, modoDemo } = useSession();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!user?.id || modoDemo) { setTotal(0); return; }
    totalParaRevisar().then((n) => { if (ativo) setTotal(n); });
    return () => { ativo = false; };
  }, [user?.id, modoDemo]);

  return total;
}

/** Cartão do painel. */
export function CartaoRevisao({ className }: { className?: string }) {
  const total = useTotalRevisao();
  if (total === null) return null;

  const vazio = total === 0;

  return (
    <Link href="/app/questoes/revisar" className={cn("block", className)}>
      <Card hover className="flex items-center gap-3 !py-4 sm:gap-4">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
            vazio ? "bg-emerald-50 text-emerald-600" : "bg-gold-50 text-gold-500"
          )}
        >
          {vazio ? <CheckCircle2 size={19} /> : <RotateCcw size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-navy-700">
            {vazio ? "Revisão em dia" : `Revisar hoje · ${total} ${total === 1 ? "questão" : "questões"}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {vazio
              ? "Nada vencendo agora. O que você errar volta amanhã."
              : "Questões que você errou, no intervalo certo para fixar."}
          </p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-muted" />
      </Card>
    </Link>
  );
}

/** Faixa do topo do banco de questões. Só aparece quando há o que revisar. */
export function FaixaRevisao() {
  const total = useTotalRevisao();
  if (!total) return null;

  return (
    /* No celular o "Revisar" da direita não aparece e a faixa vira um bloco de
       três linhas de texto: com o ícone centralizado ele ficava solto no meio
       delas, longe da frase que anuncia. */
    <Link
      href="/app/questoes/revisar"
      className="flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-3 transition hover:border-gold-400 sm:items-center sm:gap-3 sm:px-4"
    >
      <RotateCcw size={17} className="mt-0.5 shrink-0 text-gold-500 sm:mt-0" />
      <p className="min-w-0 flex-1 text-sm text-gold-700">
        <strong className="font-bold">
          {total} {total === 1 ? "questão espera" : "questões esperam"} revisão hoje.
        </strong>{" "}
        <span className="text-gold-600/80">
          São as que você errou, de volta no intervalo certo.
        </span>
      </p>
      <span className="hidden shrink-0 items-center gap-1 text-xs font-bold text-gold-700 sm:inline-flex">
        Revisar <ArrowRight size={13} />
      </span>
    </Link>
  );
}
