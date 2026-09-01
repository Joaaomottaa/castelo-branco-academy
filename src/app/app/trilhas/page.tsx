"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Award, BadgeCheck, Briefcase, CheckCircle2, Circle, Clock,
  MoveHorizontal, Route, Target, Wallet,
} from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Progress, SectionTitle, cn, fileiraCls, fileiraItemCls,
} from "@/components/ui";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";
import type { Trilha } from "@/lib/types";

export default function TrilhasPage() {
  const { trilhas, minhasTrilhas, meusCertificados, cursos } = useDados();
  const { progressoDoCurso } = useSession();
  const [area, setArea] = useState<string | null>(null);

  const areas = useMemo(() => [...new Set(trilhas.map((t) => t.area))], [trilhas]);
  const lista = useMemo(
    () => (area ? trilhas.filter((t) => t.area === area) : trilhas),
    [trilhas, area]
  );

  const feitos = new Set(meusCertificados.map((c) => c.cursoSlug));
  const trilhasFeitas = new Set(minhasTrilhas.map((c) => c.trilhaSlug));

  /** Progresso da trilha: cursos com certificado + parcial do curso em andamento. */
  function progressoDaTrilha(t: Trilha) {
    if (t.cursos.length === 0) return { pct: 0, concluidos: 0 };
    const concluidos = t.cursos.filter((c) => feitos.has(c.slug)).length;

    const parcial = t.cursos.reduce((acc, tc) => {
      if (feitos.has(tc.slug)) return acc;
      const curso = cursos.find((c) => c.slug === tc.slug);
      const p = progressoDoCurso(tc.slug);
      if (!curso || !p) return acc;
      const total = curso.modulos.reduce((a, m) => a + m.aulas.length, 0);
      return acc + (total ? p.aulasConcluidas.length / total : 0);
    }, 0);

    return {
      pct: Math.round(((concluidos + parcial) / t.cursos.length) * 100),
      concluidos,
    };
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-gold-500">Trilhas de carreira</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
          Escolha o cargo. A gente monta o caminho.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Uma trilha não é uma lista de cursos — é a sequência que forma o profissional
          para uma vaga específica. Concluir a trilha inteira gera um selo próprio, e é
          esse selo que as empresas pedem no banco de talentos.
        </p>
      </div>

      {/* Filtro por área */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={!area} onClick={() => setArea(null)}>Todas as áreas</Chip>
        {areas.map((a) => (
          <Chip key={a} ativo={area === a} onClick={() => setArea(area === a ? null : a)}>
            {a}
          </Chip>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<Route size={34} />}
          title="Nenhuma trilha nesta área"
          description="Escolha outra área ou volte ao catálogo de cursos."
          action={<Button href="/app/cursos" variant="outline">Ver cursos</Button>}
        />
      ) : (
        <div>
          {/* Empilhadas, duas trilhas nunca apareciam juntas na tela do celular
              — e escolher trilha é comparar cargo, carga e sequência. Deitadas
              na fileira o vizinho fica à vista; do `sm` para cima é a mesma
              grade de antes. */}
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted sm:hidden">
            <MoveHorizontal size={13} className="text-gold-500" />
            Arraste para o lado para comparar as trilhas
          </p>
          <div className={cn(fileiraCls, "sm:gap-6 lg:grid-cols-2")}>
          {lista.map((t) => {
            const { pct, concluidos } = progressoDaTrilha(t);
            const completa = trilhasFeitas.has(t.slug);

            return (
              <Card key={t.slug} hover className={cn(fileiraItemCls, "!p-0 overflow-hidden")}>
                {/* Cabeçalho */}
                <div
                  className="relative p-5 sm:p-6"
                  style={{ background: `linear-gradient(125deg, ${t.cor} 0%, #001838 100%)` }}
                >
                  <div className="grid-lines absolute inset-0" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{t.area}</Badge>
                      <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {t.nivelEntrada} → {t.nivelSaida}
                      </span>
                      {completa && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          <BadgeCheck size={11} /> Selo conquistado
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3.5 text-lg font-bold leading-snug text-white sm:text-xl">
                      {t.nome}
                    </h2>
                    <p className="mt-1.5 text-sm text-navy-100/70">{t.subtitulo}</p>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-100/65">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={13} className="text-gold-400" /> {t.cargoAlvo}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} className="text-gold-400" /> {t.cargaHoraria}h
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Award size={13} className="text-gold-400" /> {t.pontosPEPC} pts PEPC
                      </span>
                      {t.faixaSalarial && (
                        <span className="inline-flex items-center gap-1.5">
                          <Wallet size={13} className="text-gold-400" /> {t.faixaSalarial}
                        </span>
                      )}
                    </div>

                    {pct > 0 && (
                      <div className="mt-5">
                        <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-navy-100/70">
                          <span>{concluidos} de {t.cursos.length} cursos concluídos</span>
                          <span className="text-gold-300">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                          <div className="gold-gradient h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sequência de cursos */}
                <div className="p-5 sm:p-6">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Sequência
                  </p>
                  <ol className="mt-3 space-y-2.5">
                    {t.cursos.map((c) => {
                      const ok = feitos.has(c.slug);
                      // Carga e selo disputavam a linha com o nome do curso e
                      // sobravam ~60px para ele: descem para baixo do nome,
                      // alinhados com ele, e voltam à linha no `sm`.
                      return (
                        <li key={c.slug} className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-start sm:gap-2.5">
                          <span className="flex min-w-0 flex-1 items-start gap-2.5">
                            {ok ? (
                              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle size={16} className="mt-0.5 shrink-0 text-navy-200" />
                            )}
                            <span className={cn("min-w-0 flex-1 leading-snug", ok ? "text-muted line-through" : "text-ink")}>
                              {c.titulo}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2.5 pl-[26px] sm:pl-0">
                            <span className="text-xs text-muted">{c.cargaHoraria}h</span>
                            {!c.obrigatorio && <Badge tone="muted">opcional</Badge>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {t.habilidades.slice(0, 5).map((h) => (
                      <span
                        key={h.nome}
                        className="rounded-md bg-cream px-2 py-0.5 text-[11px] font-medium text-navy-600"
                      >
                        {h.nome}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5">
                    <Button href={`/app/trilhas/${t.slug}`} variant="primary" full>
                      {pct > 0 ? "Continuar trilha" : "Ver trilha completa"}{" "}
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
        </div>
      )}

      {/* Explicação do valor */}
      <Card className="!border-gold-200 !bg-gold-50">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-start">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-gold-500">
            <Target size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <SectionTitle
              title="Por que a trilha vale mais que o curso avulso"
              description="Empresas do banco de talentos podem exigir a trilha completa na vaga. Quem tem o selo aparece primeiro na busca e ganha peso extra no cálculo de compatibilidade — a trilha responde por 60% do critério de formação quando a vaga a exige."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Chip({
  children, ativo, onClick,
}: {
  children: React.ReactNode; ativo?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-600"
          : "border-navy-100 bg-white text-muted hover:border-navy-200 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}
