"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, Briefcase, CheckCircle2, Circle,
  Clock, PlayCircle, Target, Wallet,
} from "lucide-react";
import { Badge, Button, Card, Carregando, Progress, cn } from "@/components/ui";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";

export default function TrilhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { getTrilha, getCurso, minhasTrilhas, meusCertificados, vagas, carregando, totalAulas } =
    useDados();
  const { progressoDoCurso } = useSession();

  if (carregando) return <Carregando />;
  const trilha = getTrilha(slug);
  if (!trilha) notFound();

  const feitos = new Set(meusCertificados.map((c) => c.cursoSlug));
  const certTrilha = minhasTrilhas.find((c) => c.trilhaSlug === slug);

  const etapas = trilha.cursos.map((tc) => {
    const curso = getCurso(tc.slug);
    const p = progressoDoCurso(tc.slug);
    const total = curso ? totalAulas(curso) : 0;
    const feitas = p?.aulasConcluidas.length ?? 0;
    const concluido = feitos.has(tc.slug);
    return {
      ...tc,
      curso,
      pct: concluido ? 100 : total ? Math.round((feitas / total) * 100) : 0,
      feitas,
      total,
      concluido,
    };
  });

  const obrigatorios = etapas.filter((e) => e.obrigatorio);
  const concluidos = obrigatorios.filter((e) => e.concluido).length;
  const pctGeral = obrigatorios.length
    ? Math.round(
        (obrigatorios.reduce((a, e) => a + e.pct, 0) / (obrigatorios.length * 100)) * 100
      )
    : 0;

  const proxima = etapas.find((e) => !e.concluido);
  const vagasCompativeis = vagas.filter((v) => (v.trilhasDesejadas ?? []).includes(slug));

  return (
    <div className="space-y-7">
      <Link
        href="/app/trilhas"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Todas as trilhas
      </Link>

      {/* Capa */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 lg:p-10"
        style={{ background: `linear-gradient(125deg, ${trilha.cor} 0%, #001838 100%)` }}
      >
        <div className="grid-lines absolute inset-0" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{trilha.area}</Badge>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {trilha.nivelEntrada} → {trilha.nivelSaida}
            </span>
            {certTrilha && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                <BadgeCheck size={11} /> Selo conquistado
              </span>
            )}
          </div>

          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight text-white lg:text-4xl">
            {trilha.nome}
          </h1>
          <p className="mt-3 text-base text-navy-100/75">{trilha.subtitulo}</p>
          {trilha.descricao && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-100/60">
              {trilha.descricao}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-navy-100/70">
            <span className="inline-flex items-center gap-1.5"><Briefcase size={14} className="text-gold-400" /> {trilha.cargoAlvo}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-gold-400" /> {trilha.cargaHoraria}h</span>
            <span className="inline-flex items-center gap-1.5"><Award size={14} className="text-gold-400" /> {trilha.pontosPEPC} pts PEPC</span>
            {trilha.faixaSalarial && (
              <span className="inline-flex items-center gap-1.5"><Wallet size={14} className="text-gold-400" /> {trilha.faixaSalarial}</span>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {proxima?.curso ? (
              <Button href={`/app/cursos/${proxima.slug}`} variant="gold" size="lg">
                <PlayCircle size={17} />
                {pctGeral > 0 ? "Continuar de onde parou" : "Começar a trilha"}
              </Button>
            ) : (
              <Button href="/app/certificados" variant="gold" size="lg">
                <Award size={17} /> Ver meu selo
              </Button>
            )}
            {pctGeral > 0 && (
              <span className="text-sm font-semibold text-gold-300">{pctGeral}% concluído</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Etapas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-700">Caminho da trilha</h2>
            <span className="text-sm text-muted">
              {concluidos} de {obrigatorios.length} obrigatórios
            </span>
          </div>

          <div className="relative space-y-3 border-l-2 border-navy-100 pl-0">
            {etapas.map((e, i) => (
              <div key={e.slug} className="relative pl-8">
                <span
                  className={cn(
                    "absolute -left-[9px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-cream",
                    e.concluido ? "bg-emerald-500" : e.pct > 0 ? "gold-gradient" : "bg-navy-200"
                  )}
                />
                <Card hover className={cn(e.concluido && "!bg-emerald-50/40")}>
                  <div className="flex flex-wrap items-start gap-4">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ background: e.curso?.cor ?? trilha.cor }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-navy-700">{e.titulo}</h3>
                        {e.concluido && <Badge tone="green"><CheckCircle2 size={10} /> Concluído</Badge>}
                        {!e.obrigatorio && <Badge tone="muted">Opcional</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {e.curso?.subtitulo ?? `${e.cargaHoraria} horas`}
                      </p>

                      {e.total > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 flex justify-between text-[11px] text-muted">
                            <span>{e.feitas}/{e.total} aulas</span>
                            <span className="font-semibold text-navy-700">{e.pct}%</span>
                          </div>
                          <Progress value={e.pct} tone={e.concluido ? "green" : "gold"} />
                        </div>
                      )}
                    </div>

                    <Button
                      href={`/app/cursos/${e.slug}`}
                      variant={e.concluido ? "outline" : "primary"}
                      size="sm"
                    >
                      {e.concluido ? "Revisar" : e.pct > 0 ? "Continuar" : "Começar"}
                    </Button>
                  </div>
                </Card>
              </div>
            ))}

            {/* Selo final */}
            <div className="relative pl-8">
              <span
                className={cn(
                  "absolute -left-[9px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-cream",
                  certTrilha ? "gold-gradient" : "bg-navy-200"
                )}
              />
              <Card className={cn(certTrilha ? "!border-gold-300 !bg-gold-50" : "!border-dashed")}>
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      certTrilha ? "gold-gradient text-navy-800" : "bg-navy-50 text-navy-300"
                    )}
                  >
                    <BadgeCheck size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy-700">
                      Selo {trilha.cargoAlvo}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {certTrilha
                        ? `Emitido em ${new Date(certTrilha.emitidoEm).toLocaleDateString("pt-BR")} · código ${certTrilha.codigo}`
                        : `Conclua os ${obrigatorios.length} cursos obrigatórios para liberar o selo`}
                    </p>
                  </div>
                  {certTrilha && <Badge tone="gold">Válido</Badge>}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-bold text-navy-700">Seu progresso</h3>
            <p className="mt-3 text-3xl font-bold text-navy-700">{pctGeral}%</p>
            <Progress value={pctGeral} className="mt-3" />
            <p className="mt-2 text-xs text-muted">
              {concluidos} de {obrigatorios.length} cursos obrigatórios concluídos
            </p>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">Habilidades desenvolvidas</h3>
            <p className="mt-1 text-xs text-muted">
              Nível esperado ao concluir a trilha.
            </p>
            <div className="mt-4 space-y-3">
              {trilha.habilidades.map((h) => (
                <div key={h.nome}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{h.nome}</span>
                    <span className="text-xs font-semibold text-muted">{h.nivelEsperado}%</span>
                  </div>
                  <Progress value={h.nivelEsperado} />
                </div>
              ))}
            </div>
          </Card>

          {vagasCompativeis.length > 0 && (
            <Card>
              <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                <Target size={15} className="text-gold-500" /> Vagas que pedem esta trilha
              </h3>
              <div className="mt-4 space-y-3">
                {vagasCompativeis.map((v) => (
                  <Link key={v.id} href="/app/vagas" className="block">
                    <div className="rounded-xl border border-navy-100 p-3.5 transition hover:border-gold-300">
                      <p className="truncate text-sm font-semibold text-navy-700">{v.titulo}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {v.empresa} · {v.cidade}/{v.uf}
                      </p>
                      <p className="mt-1.5 text-xs font-semibold text-gold-600">{v.faixa}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <Button href="/app/vagas" variant="outline" size="sm" full className="mt-4">
                Ver todas as vagas <ArrowRight size={13} />
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
