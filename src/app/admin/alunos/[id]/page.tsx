"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PerfilTalento } from "@/components/perfil-talento";

/* ==========================================================================
   FICHA DO ALUNO — dentro da área administrativa

   Antes, "Perfil no banco de talentos" jogava o administrador em /app: ele
   perdia o menu do admin e, quando a pessoa não tinha publicado o perfil,
   ainda caía num "não encontrado". A ficha agora abre aqui, no mesmo shell,
   e o link para a versão pública fica explícito ao lado.
   ========================================================================== */
export default function AlunoAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/alunos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
        >
          <ArrowLeft size={15} /> Voltar para Alunos
        </Link>

        <Link
          href={`/app/talentos/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-gold-600"
          title="Abre a versão que a empresa enxerga, fora da área administrativa"
        >
          Ver como a empresa vê <ExternalLink size={13} />
        </Link>
      </div>

      <PerfilTalento id={id} modoAdmin />
    </div>
  );
}
