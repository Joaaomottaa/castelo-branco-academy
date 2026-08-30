"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PerfilTalento } from "@/components/perfil-talento";

export default function PerfilTalentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <Link
        href="/app/talentos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Voltar ao banco de talentos
      </Link>

      <PerfilTalento id={id} />
    </div>
  );
}
