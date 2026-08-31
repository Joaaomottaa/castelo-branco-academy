"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Award, CheckCircle2, Circle, Clock, Download, FileText,
  PlayCircle, Radio, Star, Target, Users,
} from "lucide-react";
import { Badge, Button, Card, Progress, cn } from "@/components/ui";
import { useDados } from "@/lib/dados";
import { Carregando } from "@/components/ui";
import { useSession } from "@/lib/session";
import { ConclusaoCurso } from "@/components/conclusao-curso";

const iconePorTipo = {
  video: PlayCircle,
  quiz: FileText,
  material: Download,
  "ao-vivo": Radio,
} as const;

export default function CursoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { getCurso, totalAulas, carregando } = useDados();
  const { progressoDoCurso } = useSession();
  const [conclusaoAberta, setConclusaoAberta] = useState(false);
  const curso = getCurso(slug);

  if (carregando) return <Carregando />;
  if (!curso) notFound();

  const p = progressoDoCurso(slug);
  const concluidas = new Set(p?.aulasConcluidas ?? []);
  const total = totalAulas(curso);
  const pct = Math.round((concluidas.size / total) * 100);
  const primeiraAula = curso.modulos[0].aulas[0].id;
  const aulaAlvo = p?.ultimaAulaId ?? primeiraAula;

  return (
    <div className="space-y-7">
      <Link
        href="/app/cursos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Voltar ao catálogo
      </Link>

      {/* Capa */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 sm:p-8 lg:p-10"
        style={{ background: `linear-gradient(120deg, ${curso.cor} 0%, #001838 100%)` }}
      >
        <div className="grid-lines absolute inset-0" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{curso.categoria}</Badge>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {curso.nivel}
            </span>
            {curso.novo && <Badge tone="gold">Novo</Badge>}
          </div>

          <h1 className="mt-4 text-balance text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
            {curso.titulo}
          </h1>
          <p className="mt-3 text-[15px] text-navy-100/75 sm:text-base">{curso.subtitulo}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-100/60">
            {curso.descricao}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-navy-100/70 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-gold-400" /> {curso.cargaHoraria}h de conteúdo</span>
            <span className="inline-flex items-center gap-1.5"><Target size={14} className="text-gold-400" /> {curso.pontosPEPC} pontos PEPC</span>
            <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-gold-400" /> {curso.alunos.toLocaleString("pt-BR")} alunos</span>
            <span className="inline-flex items-center gap-1.5"><Star size={14} className="fill-gold-400 text-gold-400" /> {curso.nota.toFixed(1)}</span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              href={`/app/cursos/${curso.slug}/aula/${aulaAlvo}`}
              variant="gold"
              size="lg"
              className="w-full sm:w-auto"
            >
              <PlayCircle size={17} /> {pct > 0 ? "Continuar curso" : "Começar agora"}
            </Button>
            {pct > 0 && (
              <span className="text-sm font-semibold text-gold-300">{pct}% concluído</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Conteúdo programático */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-700">Conteúdo do curso</h2>
            <span className="text-sm text-muted">
              {curso.modulos.length} módulos · {total} aulas
            </span>
          </div>

          {curso.modulos.map((m, mi) => {
            const aulasConcluidasNoModulo = m.aulas.filter((a) => concluidas.has(a.id)).length;
            return (
              <Card key={m.id} className="!p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-navy-100 bg-cream/60 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
                      Módulo {String(mi + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-navy-700">{m.titulo}</p>
                    {m.resumo && <p className="line-clamp-2 text-xs leading-snug text-muted">{m.resumo}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    {aulasConcluidasNoModulo}/{m.aulas.length}
                  </span>
                </div>

                <ul className="divide-y divide-navy-100">
                  {m.aulas.map((a) => {
                    const Icone = iconePorTipo[a.tipo];
                    const feita = concluidas.has(a.id);
                    return (
                      <li key={a.id}>
                        {/* Quatro peças na mesma linha deixavam ~120px para o nome
                            da aula no celular, e "Split payment: o crédito
                            condicionado ao pagamento" não caberia em linha nenhuma.
                            A duração e o selo descem para baixo do nome, alinhados
                            com ele; do `sm` para cima é a mesma linha de antes. */}
                        <Link
                          href={`/app/cursos/${curso.slug}/aula/${a.id}`}
                          className="flex flex-col gap-1.5 px-4 py-3 transition hover:bg-cream/60 sm:flex-row sm:items-center sm:gap-3.5 sm:px-5 sm:py-3.5"
                        >
                          <span className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3.5">
                            {feita ? (
                              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500 sm:mt-0" />
                            ) : (
                              <Circle size={18} className="mt-0.5 shrink-0 text-navy-200 sm:mt-0" />
                            )}
                            <Icone size={16} className="mt-1 shrink-0 text-gold-500 sm:mt-0" />
                            <span
                              className={cn(
                                "min-w-0 flex-1 text-sm leading-snug",
                                feita ? "text-muted" : "font-medium text-ink"
                              )}
                            >
                              {a.titulo}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 pl-[46px] sm:pl-0">
                            {a.gratuita && <Badge tone="green">Grátis</Badge>}
                            <span className="text-xs text-muted">{a.duracaoMin} min</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-bold text-navy-700">Seu progresso</h3>
            <p className="mt-3 text-2xl font-bold text-navy-700 sm:text-3xl">{pct}%</p>
            <Progress value={pct} className="mt-3" />
            <p className="mt-2 text-xs text-muted">
              {concluidas.size} de {total} aulas concluídas
            </p>
            <div className="mt-5 rounded-xl border border-navy-100 bg-cream/60 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-700">
                <Award size={14} className="text-gold-500" /> Certificado
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {pct === 100
                  ? "Parabéns! Seu certificado já está disponível."
                  : `Conclua 100% das aulas e a avaliação final para emitir o certificado de ${curso.cargaHoraria}h.`}
              </p>
              {pct === 100 && (
                <Button
                  variant="gold"
                  size="sm"
                  full
                  className="mt-3"
                  onClick={() => setConclusaoAberta(true)}
                >
                  Ver certificado e selos
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">Instrutor</h3>
            <div className="mt-4 flex items-center gap-3">
              <span className="gold-gradient inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-navy-800">
                {curso.instrutor.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy-700">{curso.instrutor}</p>
                <p className="line-clamp-2 text-xs leading-snug text-muted">{curso.instrutorCargo}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">O que você vai dominar</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {curso.tags.map((t) => (
                <Badge key={t} tone="navy">{t}</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    
      {conclusaoAberta && curso.id && (
        <ConclusaoCurso
          cursoId={curso.id}
          cursoTitulo={curso.titulo}
          aoFechar={() => setConclusaoAberta(false)}
        />
      )}
    </div>
  );
}
