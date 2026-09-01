"use client";

import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "./ui";

/* ==========================================================================
   Modal usado na área administrativa.
   Fecha no Esc e no clique fora — as duas coisas que a pessoa tenta primeiro.
   ========================================================================== */

export function Modal({
  titulo,
  subtitulo,
  aoFechar,
  children,
  rodape,
  largura = "max-w-2xl",
}: {
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aoFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={aoFechar}
    >
      <div
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
          largura
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Todo editor da área administrativa passa por aqui: a folga de
            desktop (24px de cada lado) comia um sexto da largura de um celular,
            e o título dividia a linha com o X de fechar. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-navy-100 px-5 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug text-navy-700 sm:text-lg">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-xs leading-snug text-muted">{subtitulo}</p>}
          </div>
          <button
            onClick={aoFechar}
            className="shrink-0 text-muted transition hover:text-navy-700"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>

        {rodape && (
          <div className="shrink-0 border-t border-navy-100 px-5 py-4 sm:px-6">{rodape}</div>
        )}
      </div>
    </div>
  );
}

/** Caixa de erro padrão dos formulários administrativos. */
export function AvisoErro({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Confirmação para ação destrutiva. Nomeia o que será apagado, de propósito. */
export function ConfirmarExclusao({
  titulo,
  descricao,
  rotuloBotao = "Excluir",
  aoConfirmar,
  aoFechar,
  ocupado,
}: {
  titulo: string;
  descricao: string;
  rotuloBotao?: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} largura="max-w-md">
      <p className="text-sm leading-relaxed text-ink">{descricao}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          onClick={aoFechar}
          className="min-w-[calc(50%-0.25rem)] flex-1 rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 sm:min-w-0 sm:flex-none"
        >
          Cancelar
        </button>
        <button
          onClick={aoConfirmar}
          disabled={ocupado}
          className="min-w-[calc(50%-0.25rem)] flex-1 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 sm:min-w-0 sm:flex-none"
        >
          {ocupado ? "Excluindo…" : rotuloBotao}
        </button>
      </div>
    </Modal>
  );
}
