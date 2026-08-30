"use client";

import { createContext, useContext } from "react";
import type { Empresa } from "@/lib/repo-empresa";

/* ==========================================================================
   O contexto da área da empresa.

   Vive fora do `layout.tsx` porque um arquivo de rota do App Router só pode
   exportar `default` e um punhado de opções reservadas — qualquer outro
   export quebra a checagem de tipos do build. O layout continua sendo quem
   busca a empresa e monta o provedor; aqui ficam só o contexto e o hook.
   ========================================================================== */

export interface EmpresaCtx {
  empresa: Empresa;
  /** Rebusca a empresa — quase toda ação daqui muda a contagem de assentos. */
  recarregar: () => Promise<void>;
}

export const EmpresaContext = createContext<EmpresaCtx | null>(null);

export function useEmpresa() {
  const c = useContext(EmpresaContext);
  if (!c) throw new Error("useEmpresa fora da área da empresa");
  return c;
}
