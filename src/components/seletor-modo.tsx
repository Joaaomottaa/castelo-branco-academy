"use client";

import { useEffect, useState } from "react";
import { Database, FlaskConical, Lock } from "lucide-react";
import { useSession } from "@/lib/session";
import { cn } from "./ui";

/**
 * Chave de troca entre o banco real e o seed local.
 *
 * Só aparece quando o Supabase está configurado — sem credenciais não há o que
 * alternar. Renderiza apenas depois de montado para não divergir da marcação
 * gerada no servidor.
 */
export function SeletorDeModo({ compacto }: { compacto?: boolean }) {
  const { modoDemo, supabaseDisponivel, podeTrocarModo, trocarModo } = useSession();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  if (!montado || !supabaseDisponivel) return null;

  if (!podeTrocarModo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-600">
        <Lock size={11} /> Demo travado
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-navy-100 bg-cream p-0.5",
        compacto ? "text-[10px]" : "text-xs"
      )}
      role="group"
      aria-label="Fonte de dados"
    >
      <Opcao
        ativo={!modoDemo}
        onClick={() => trocarModo("auto")}
        icone={<Database size={compacto ? 11 : 13} />}
        rotulo="Supabase"
        compacto={compacto}
      />
      <Opcao
        ativo={modoDemo}
        onClick={() => trocarModo("demo")}
        icone={<FlaskConical size={compacto ? 11 : 13} />}
        rotulo="Demo"
        compacto={compacto}
      />
    </div>
  );
}

function Opcao({
  ativo, onClick, icone, rotulo, compacto,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  rotulo: string;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={ativo ? undefined : onClick}
      aria-pressed={ativo}
      title={
        rotulo === "Demo"
          ? "Usar o seed local — não toca no banco"
          : "Usar o banco de dados real"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold transition",
        compacto ? "px-2 py-1" : "px-3 py-1.5",
        ativo
          ? "bg-navy-700 text-white shadow-sm"
          : "text-muted hover:text-navy-700"
      )}
    >
      {icone} {rotulo}
    </button>
  );
}
