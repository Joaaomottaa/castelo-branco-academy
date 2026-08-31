"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Award, Bot, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, ClipboardCheck, Download, ListChecks, MessageSquare, Play,
  Radio, Trophy,
} from "lucide-react";
import { Badge, Button, Card, Progress, abaCls, abasCls, cn } from "@/components/ui";
import { useDados } from "@/lib/dados";
import { Carregando } from "@/components/ui";
import { useSession } from "@/lib/session";
import { PlayerAula } from "@/components/player-aula";
import { ModalQuiz } from "@/components/quiz-aula";
import { ConclusaoCurso } from "@/components/conclusao-curso";
import { Duvidas } from "@/components/duvidas";
import { ListaMateriais } from "@/components/materiais-aula";

export default function AulaPage({
  params,
}: {
  params: Promise<{ slug: string; aulaId: string }>;
}) {
  const { slug, aulaId } = use(params);
  const router = useRouter();
  const { getCurso, todasAulas, totalAulas, carregando, recarregar } = useDados();
  const { progressoDoCurso, marcarAula, modoDemo } = useSession();
  const [aba, setAba] = useState<"resumo" | "material" | "duvidas">("resumo");
  const [quizAberto, setQuizAberto] = useState(false);
  const [conclusaoAberta, setConclusaoAberta] = useState(false);
  const curso = getCurso(slug);

  if (carregando) return <Carregando />;
  if (!curso) notFound();

  const lista = todasAulas(curso);
  const idx = lista.findIndex((a) => a.id === aulaId);
  if (idx === -1) notFound();

  const aula = lista[idx];
  const anterior = idx > 0 ? lista[idx - 1] : null;
  const proxima = idx < lista.length - 1 ? lista[idx + 1] : null;

  const p = progressoDoCurso(slug);
  const concluidas = new Set(p?.aulasConcluidas ?? []);
  const feita = concluidas.has(aula.id);
  const total = totalAulas(curso);
  const pct = Math.round((concluidas.size / total) * 100);

  // Com avaliação ativa, a aula só fecha pela nota. Marcar no braço
  // esvaziaria o sentido de ter prova.
  //
  // No modo demonstração não há coluna quiz_ativo para consultar: o seed local
  // trata toda vídeo-aula como avaliada, que é o comportamento que se quer
  // mostrar numa apresentação.
  const temAvaliacao = modoDemo ? aula.tipo === "video" : Boolean(aula.quizAtivo);

  // Quantas aulas ficam concluídas se esta fechar agora. É o gatilho da tela
  // de parabéns: sem contar aqui, a comemoração só apareceria no reload
  // seguinte, quando o progresso já tivesse voltado do banco.
  const fechaOCurso = !feita && concluidas.size + 1 >= total;
  const cursoCompleto = concluidas.size >= total;

  function irParaProxima() {
    if (proxima) router.push(`/app/cursos/${slug}/aula/${proxima.id}`);
  }

  async function abrirConclusao() {
    // O certificado é emitido por trigger no banco. Recarregar antes de abrir
    // garante que a tela leia o certificado recém-criado, e não o vazio que
    // estava em memória desde que a página abriu.
    await recarregar();
    setConclusaoAberta(true);
  }

  /** Botão principal: conclui a aula do jeito que a aula exige e segue. */
  function acaoPrincipal() {
    if (temAvaliacao && !feita) {
      setQuizAberto(true);
      return;
    }
    if (!feita) marcarAula(slug, aula.id, true);

    if (proxima) irParaProxima();
    else void abrirConclusao();
  }

  /** Chamado quando a avaliação é aprovada dentro do modal. */
  function aoAprovarQuiz() {
    marcarAula(slug, aula.id, true);
  }

  /** Fechou o modal da prova: se o curso terminou, comemora; senão, segue. */
  function aoFecharQuiz(aprovadaAgora: boolean) {
    setQuizAberto(false);
    if (!aprovadaAgora) return;
    if (fechaOCurso || cursoCompleto) void abrirConclusao();
    else irParaProxima();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Link
          href={`/app/cursos/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
        >
          <ArrowLeft size={15} /> {curso.titulo}
        </Link>

        {/* Player */}
        <PlayerAula
          aula={aula}
          cor={curso.cor}
          aoTerminar={() => {
            if (!temAvaliacao) marcarAula(slug, aula.id, true);
          }}
        />

        {/* Cabeçalho da aula */}
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
              {aula.moduloTitulo}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-navy-700 sm:text-2xl">{aula.titulo}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge tone="muted">{aula.duracaoMin} min</Badge>
              <Badge tone="navy">{rotuloTipo(aula.tipo)}</Badge>
              {aula.gratuita && <Badge tone="green">Aula gratuita</Badge>}
            </div>
          </div>

          {/* Três ações numa linha rígida: no celular a última ("Próxima aula")
              saía pela borda direita da tela. Agora a linha quebra e cada ação
              ocupa metade da largura; no desktop volta a ser uma linha só. */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {feita && (
              <span className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 sm:min-w-0 sm:flex-none">
                <CheckCircle2 size={16} /> Concluída
              </span>
            )}

            {temAvaliacao && feita && (
              <button
                onClick={() => setQuizAberto(true)}
                className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-2 rounded-full border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-700 transition hover:border-gold-400 sm:min-w-0 sm:flex-none"
              >
                <ClipboardCheck size={16} /> Refazer teste
              </button>
            )}

            <Button
              variant="gold"
              onClick={acaoPrincipal}
              className="min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none"
            >
              {temAvaliacao && !feita ? (
                <>
                  <ClipboardCheck size={15} /> Finalizar aula
                </>
              ) : proxima ? (
                <>
                  Próxima aula <ArrowRight size={15} />
                </>
              ) : (
                <>
                  <Trophy size={15} /> Finalizar curso
                </>
              )}
            </Button>
          </div>
        </div>


        {/* Abas */}
        <Card className="!p-0">
          {/* Três abas com ícone não cabem em 360px: espremidas, "Resumo com IA"
              quebrava no meio e a terceira ficava fora. A barra rola de lado. */}
          <div className={abasCls}>
            {([
              ["resumo", "Resumo com IA", ListChecks],
              ["material", "Materiais", Download],
              ["duvidas", "Dúvidas e IA", MessageSquare],
            ] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setAba(k)}
                className={cn(
                  abaCls,
                  aba === k
                    ? "border-b-2 border-gold-400 text-navy-700"
                    : "text-muted hover:text-navy-700"
                )}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {aba === "resumo" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-600">
                  <Bot size={14} /> Resumo gerado automaticamente a partir da transcrição
                </div>
                <p className="text-sm leading-relaxed text-ink">
                  {aula.descricao ??
                    "Nesta aula, o instrutor destrincha o tema com um caso real atendido pela Castelo Branco, apontando onde o erro costuma aparecer na operação e qual documento sustenta a decisão."}
                </p>
                <ul className="space-y-2.5">
                  {[
                    "Contexto normativo e o que efetivamente mudou na prática.",
                    "Os três pontos de controle que evitam autuação.",
                    "Como registrar a decisão no dossiê para auditoria futura.",
                    "Erro clássico: confundir a obrigação acessória com a principal.",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-ink">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Era uma lista de exemplo com três arquivos que não existiam.
                Agora vem do que o instrutor anexou de verdade em
                /admin/cursos — e o download é por URL assinada. */}
            {aba === "material" && <ListaMateriais aulaId={aula.id} />}

            {aba === "duvidas" && (
              <Duvidas
                aulaId={aula.id}
                contexto={{
                  aulaTitulo: aula.titulo,
                  aulaDescricao: aula.descricao,
                  cursoTitulo: curso.titulo,
                  moduloTitulo: aula.moduloTitulo,
                  nivel: curso.nivel,
                  categoria: curso.categoria,
                }}
              />
            )}
          </div>
        </Card>

        {/* Navegação
            Lado a lado no celular sobravam ~140px para cada título de aula, e os
            dois nomes apareciam cortados — quem lê "Teste víd…" não sabe para
            onde está indo. Empilhados, cada um tem a largura inteira. */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {anterior ? (
            <Link
              href={`/app/cursos/${slug}/aula/${anterior.id}`}
              className="flex min-w-0 items-center gap-2 text-sm text-muted transition hover:text-navy-700"
            >
              <ChevronLeft size={16} className="shrink-0" />
              <span className="leading-snug sm:truncate">{anterior.titulo}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {proxima && (
            <Link
              href={`/app/cursos/${slug}/aula/${proxima.id}`}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-navy-700 transition hover:text-gold-600"
            >
              <span className="leading-snug sm:truncate">{proxima.titulo}</span>
              <ChevronRight size={16} className="shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Playlist lateral */}
      <aside className="space-y-4">
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-navy-100 p-4 sm:p-5">
            <p className="text-sm font-bold text-navy-700">Conteúdo do curso</p>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={pct} className="flex-1" />
              <span className="text-xs font-bold text-navy-700">{pct}%</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {concluidas.size} de {total} aulas
            </p>
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {curso.modulos.map((m, mi) => (
              <div key={m.id}>
                <p className="sticky top-0 bg-cream px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-navy-600 sm:px-5">
                  {String(mi + 1).padStart(2, "0")} · {m.titulo}
                </p>
                <ul>
                  {m.aulas.map((a) => {
                    const ativa = a.id === aula.id;
                    const ok = concluidas.has(a.id);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/app/cursos/${slug}/aula/${a.id}`}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 text-sm transition sm:px-5",
                            ativa ? "bg-gold-50 font-semibold text-navy-700" : "hover:bg-cream/70"
                          )}
                        >
                          {ok ? (
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                          ) : ativa ? (
                            <Play size={16} className="mt-0.5 shrink-0 text-gold-500" />
                          ) : a.tipo === "ao-vivo" ? (
                            <Radio size={16} className="mt-0.5 shrink-0 text-navy-200" />
                          ) : (
                            <Circle size={16} className="mt-0.5 shrink-0 text-navy-200" />
                          )}
                          {/* O nome da aula usa quantas linhas precisar: a lista
                              rola na vertical, não há altura a economizar. */}
                          <span className={cn("min-w-0 flex-1 leading-snug", !ativa && !ok && "text-ink")}>
                            {a.titulo}
                          </span>
                          <span className="mt-0.5 shrink-0 text-[11px] text-muted">{a.duracaoMin}m</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card className="!border-navy-200 !bg-navy-700">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-300">
            <Award size={13} /> Certificado
          </p>
          {cursoCompleto ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-navy-100/70">
                Curso concluído. O certificado de {curso.cargaHoraria}h com{" "}
                {curso.pontosPEPC} pontos PEPC já está disponível.
              </p>
              <Button
                variant="gold"
                size="sm"
                full
                className="mt-3"
                onClick={abrirConclusao}
              >
                Ver certificado
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-navy-100/70">
              {total - concluidas.size === 1 ? (
                <>
                  Falta <strong className="text-white">1 aula</strong>
                </>
              ) : (
                <>
                  Faltam{" "}
                  <strong className="text-white">{total - concluidas.size} aulas</strong>
                </>
              )}{" "}
              para liberar o certificado de {curso.cargaHoraria}h com {curso.pontosPEPC}{" "}
              pontos de educação continuada.
            </p>
          )}
        </Card>
      </aside>

      {quizAberto && (
        <ModalQuiz
          aulaId={aula.id}
          aulaTitulo={aula.titulo}
          cursoTitulo={curso.titulo}
          aoAprovar={aoAprovarQuiz}
          aoFechar={() => aoFecharQuiz(concluidas.has(aula.id) || feita)}
        />
      )}

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

function rotuloTipo(t: string) {
  return (
    { video: "Vídeo-aula", quiz: "Avaliação", material: "Material", "ao-vivo": "Ao vivo" } as Record<
      string,
      string
    >
  )[t] ?? t;
}
