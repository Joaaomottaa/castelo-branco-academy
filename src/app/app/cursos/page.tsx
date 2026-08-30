"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award, CheckCircle2, ChevronDown, Clock, GraduationCap, PlayCircle, Route,
  Search, SlidersHorizontal, Sparkles, Star, Users, X,
} from "lucide-react";
import { Badge, Card, EmptyState, Progress, cn, inputCls } from "@/components/ui";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";
import type { Curso } from "@/lib/types";

/* ==========================================================================
   CATÁLOGO DE CURSOS

   O filtro que mais falta num catálogo de aluno não é por assunto — é por
   situação: "onde eu parei" e "o que já terminei". Esses ficam sempre à
   vista.

   O resto entra atrás de "+ filtros". Um painel de dez chips abertos numa
   base de onze cursos polui mais do que ajuda; a mesma lista escondida atrás
   de um botão continua servindo a quem procura algo específico.
   ========================================================================== */

const NIVEIS = ["Iniciante", "Intermediário", "Avançado"] as const;

const SITUACOES = [
  ["todos", "Todos"],
  ["andamento", "Em andamento"],
  ["concluidos", "Concluídos"],
  ["nao-iniciados", "Não iniciados"],
] as const;

type Situacao = (typeof SITUACOES)[number][0];

const CARGAS = [
  ["curto", "Até 15h"],
  ["medio", "16h a 25h"],
  ["longo", "Mais de 25h"],
] as const;

type Carga = (typeof CARGAS)[number][0];

const EXTRAS = [
  ["pepc", "Vale pontos PEPC", Award],
  ["trilha", "Faz parte de uma trilha", Route],
  ["gratuita", "Tem aula gratuita", PlayCircle],
  ["novo", "Lançamentos", Sparkles],
  ["nota", "Bem avaliados (4,8+)", Star],
] as const;

type Extra = (typeof EXTRAS)[number][0];

export default function CatalogoPage() {
  const { progressoDoCurso } = useSession();
  const { cursos, categorias, totalAulas, trilhas } = useDados();

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");
  const [cats, setCats] = useState<string[]>([]);
  const [niveis, setNiveis] = useState<string[]>([]);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [painelAberto, setPainelAberto] = useState(false);

  /** Slugs que aparecem em alguma trilha — base do filtro "faz parte de uma trilha". */
  const emTrilha = useMemo(
    () => new Set(trilhas.flatMap((t) => t.cursos.map((c) => c.slug))),
    [trilhas]
  );

  function progressoDe(c: Curso) {
    const p = progressoDoCurso(c.slug);
    const total = totalAulas(c);
    const feitas = p?.aulasConcluidas.length ?? 0;
    return { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 };
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return cursos.filter((c) => {
      if (
        q &&
        !c.titulo.toLowerCase().includes(q) &&
        !c.subtitulo.toLowerCase().includes(q) &&
        !c.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }

      const { pct } = progressoDe(c);
      if (situacao === "andamento" && !(pct > 0 && pct < 100)) return false;
      if (situacao === "concluidos" && pct < 100) return false;
      if (situacao === "nao-iniciados" && pct > 0) return false;

      // Dentro de um mesmo grupo, marcar dois é "ou". Entre grupos, é "e" —
      // é como a pessoa lê a própria seleção.
      if (cats.length && !cats.includes(c.categoria)) return false;
      if (niveis.length && !niveis.includes(c.nivel)) return false;

      if (cargas.length) {
        const faixa: Carga =
          c.cargaHoraria <= 15 ? "curto" : c.cargaHoraria <= 25 ? "medio" : "longo";
        if (!cargas.includes(faixa)) return false;
      }

      if (extras.includes("pepc") && c.pontosPEPC <= 0) return false;
      if (extras.includes("trilha") && !emTrilha.has(c.slug)) return false;
      if (extras.includes("novo") && !c.novo) return false;
      if (extras.includes("nota") && c.nota < 4.8) return false;
      if (
        extras.includes("gratuita") &&
        !c.modulos.some((m) => m.aulas.some((a) => a.gratuita))
      ) {
        return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursos, busca, situacao, cats, niveis, cargas, extras, emTrilha, trilhas]);

  const avancados = cargas.length + extras.length;
  const algumFiltro =
    Boolean(busca) || situacao !== "todos" || cats.length > 0 || niveis.length > 0 || avancados > 0;

  function limpar() {
    setBusca("");
    setSituacao("todos");
    setCats([]);
    setNiveis([]);
    setCargas([]);
    setExtras([]);
  }

  function alternar<T>(lista: T[], set: (v: T[]) => void, valor: T) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  // Contadores da barra de situação: número solto não diz nada; ao lado do
  // rótulo, ele já responde "quantos eu terminei".
  const contagem = useMemo(() => {
    let andamento = 0;
    let concluidos = 0;
    let novos = 0;
    for (const c of cursos) {
      const { pct } = progressoDe(c);
      if (pct >= 100) concluidos += 1;
      else if (pct > 0) andamento += 1;
      else novos += 1;
    }
    return { todos: cursos.length, andamento, concluidos, "nao-iniciados": novos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursos]);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy-700">Catálogo de cursos</h1>
        <p className="mt-1.5 text-sm text-muted">
          {cursos.length} cursos · {cursos.reduce((a, c) => a + c.cargaHoraria, 0)}h de conteúdo ·
          certificação com pontuação para educação continuada
        </p>
      </div>

      {/* Filtros */}
      <Card className="space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, tema ou tag (ex.: CT-e, split payment, drawback)"
            className={inputCls + " pl-11"}
          />
        </div>

        {/* Situação — o filtro que o aluno mais usa fica sempre à vista */}
        <div className="flex flex-wrap items-center gap-2">
          {SITUACOES.map(([k, label]) => (
            <Chip key={k} ativo={situacao === k} onClick={() => setSituacao(k)}>
              {label}
              <span className={cn("ml-1.5 tabular-nums", situacao === k ? "opacity-80" : "opacity-60")}>
                {contagem[k]}
              </span>
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-navy-100 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <SlidersHorizontal size={13} /> Área
          </span>
          {categorias.map((c) => (
            <Chip key={c} ativo={cats.includes(c)} onClick={() => alternar(cats, setCats, c)}>
              {c}
            </Chip>
          ))}

        </div>

        {/* Abaixo da área e à esquerda: o botão puxava o olho para o canto
            direito, longe dos chips que ele complementa. */}
        <div>
          <button
            onClick={() => setPainelAberto((a) => !a)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              avancados > 0 || painelAberto
                ? "border-gold-400 bg-gold-50 text-gold-600"
                : "border-navy-100 bg-white text-muted hover:border-navy-200 hover:text-navy-700"
            )}
          >
            + Filtros
            {avancados > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-navy-800">
                {avancados}
              </span>
            )}
            <ChevronDown size={13} className={cn("transition", painelAberto && "rotate-180")} />
          </button>
        </div>

        {painelAberto && (
          <div className="space-y-4 rounded-xl border border-navy-100 bg-cream/50 p-4">
            <Grupo titulo="Nível">
              {NIVEIS.map((n) => (
                <Chip key={n} ativo={niveis.includes(n)} onClick={() => alternar(niveis, setNiveis, n)}>
                  {n}
                </Chip>
              ))}
            </Grupo>

            <Grupo titulo="Carga horária">
              {CARGAS.map(([k, label]) => (
                <Chip key={k} ativo={cargas.includes(k)} onClick={() => alternar(cargas, setCargas, k)}>
                  {label}
                </Chip>
              ))}
            </Grupo>

            <Grupo titulo="Outros">
              {EXTRAS.map(([k, label, Icone]) => (
                <Chip key={k} ativo={extras.includes(k)} onClick={() => alternar(extras, setExtras, k)}>
                  <Icone size={12} /> {label}
                </Chip>
              ))}
            </Grupo>
          </div>
        )}

        {algumFiltro && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-4">
            <p className="text-sm text-muted">
              <strong className="text-navy-700">{lista.length}</strong>{" "}
              {lista.length === 1 ? "curso" : "cursos"} com esses filtros
            </p>
            <button
              onClick={limpar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-600 hover:underline"
            >
              <X size={12} /> Limpar filtros
            </button>
          </div>
        )}
      </Card>

      {lista.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={34} />}
          title="Nenhum curso encontrado"
          description={
            situacao === "concluidos"
              ? "Você ainda não concluiu nenhum curso com esses filtros. O certificado sai quando a última aula fecha."
              : "Ajuste a busca ou remova os filtros para ver todo o catálogo."
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const { feitas, total, pct } = progressoDe(c);
            return (
              <Link key={c.slug} href={`/app/cursos/${c.slug}`}>
                <Card hover className="flex h-full flex-col !p-0 overflow-hidden">
                  <div
                    className="relative flex h-36 items-end justify-between p-4"
                    style={{ background: `linear-gradient(135deg, ${c.cor} 0%, #001838 100%)` }}
                  >
                    <GraduationCap size={26} className="text-gold-300" />
                    <div className="flex gap-1.5">
                      {pct >= 100 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-bold text-white">
                          <CheckCircle2 size={11} /> Concluído
                        </span>
                      )}
                      {c.novo && pct < 100 && <Badge tone="gold">Novo</Badge>}
                      <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {c.nivel}
                      </span>
                    </div>
                    {pct > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                        <div
                          className={cn("h-full", pct >= 100 ? "bg-emerald-400" : "gold-gradient")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
                      {c.categoria}
                    </p>
                    <h3 className="mt-1.5 text-base font-bold leading-snug text-navy-700">{c.titulo}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.subtitulo}</p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 3).map((t) => (
                        <Badge key={t} tone="muted">{t}</Badge>
                      ))}
                    </div>

                    {pct > 0 && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-muted">
                          <span>{feitas}/{total} aulas</span>
                          <span className={pct >= 100 ? "text-emerald-600" : "text-navy-700"}>{pct}%</span>
                        </div>
                        <Progress value={pct} tone={pct >= 100 ? "green" : "gold"} />
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-4 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} /> {c.cargaHoraria}h
                      </span>
                      {c.pontosPEPC > 0 && (
                        <span className="inline-flex items-center gap-1.5" title="Pontos de educação continuada">
                          <Award size={13} /> {c.pontosPEPC} PEPC
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} /> {c.alunos.toLocaleString("pt-BR")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-700">
                        <Star size={13} className="fill-gold-400 text-gold-400" /> {c.nota.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- peças --- */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-600"
          : "border-navy-100 bg-white text-muted hover:border-navy-200 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}
