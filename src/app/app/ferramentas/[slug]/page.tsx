"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { FerramentaForm, IconeFerramenta } from "@/components/ferramenta-form";
import { FERRAMENTAS, getFerramenta } from "@/lib/ferramentas/catalogo";

export default function FerramentaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const ferramenta = getFerramenta(slug);
  if (!ferramenta) notFound();

  const relacionadas = FERRAMENTAS.filter(
    (f) => f.categoria === ferramenta.categoria && f.slug !== ferramenta.slug
  ).slice(0, 4);

  return (
    <div className="space-y-6">
      <Link
        href="/app/ferramentas"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Ferramentas
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <span className="gold-gradient inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-navy-800">
          <IconeFerramenta nome={ferramenta.icone} size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">{ferramenta.categoria}</Badge>
            {ferramenta.destaque && <Badge tone="gold">Mais usada</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
            {ferramenta.nome}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {ferramenta.descricao}
          </p>
        </div>
      </div>

      <FerramentaForm ferramenta={ferramenta} />

      {relacionadas.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
            Também em {ferramenta.categoria}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {relacionadas.map((f) => (
              <Link key={f.slug} href={`/app/ferramentas/${f.slug}`} className="group">
                <Card hover className="flex h-full items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                    <IconeFerramenta nome={f.icone} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-700">
                    {f.nome}
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-navy-200 transition group-hover:text-gold-500" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
