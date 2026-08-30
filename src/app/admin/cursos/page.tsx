"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ClipboardCheck, Clock, Eye, EyeOff, FileVideo, Pencil,
  Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Users, X,
} from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, cn, inputCls } from "@/components/ui";
import { AvisoErro, ConfirmarExclusao } from "@/components/modal";
import {
  apagarAula, apagarCurso, apagarModulo, carregarCursosAdmin, publicarCurso,
  trocarOrdem, type CursoAdmin,
} from "@/lib/repo-admin";
import { rotuloOrigem } from "@/lib/video";
import { CATEGORIAS, ModalAula, ModalCurso, ModalModulo, NIVEIS } from "./modais";

type Ordem = "recentes" | "alunos" | "titulo" | "aulas" | "carga";

const ORDENS: Array<{ v: Ordem; rotulo: string }> = [
  { v: "recentes", rotulo: "Mais recentes" },
  { v: "alunos", rotulo: "Mais alunos" },
  { v: "aulas", rotulo: "Mais aulas" },
  { v: "carga", rotulo: "Maior carga horária" },
  { v: "titulo", rotulo: "Título (A–Z)" },
];

type Alvo =
  | { tipo: "curso"; curso?: CursoAdmin }
  | { tipo: "modulo"; cursoId: string; modulo?: CursoAdmin["modulos"][number] }
  | {
      tipo: "aula";
      curso: CursoAdmin;
      moduloId: string;
      moduloTitulo: string;
      aula?: CursoAdmin["modulos"][number]["aulas"][number];
    }
  | null;

type Exclusao =
  | { tipo: "curso"; id: string; nome: string }
  | { tipo: "modulo"; id: string; nome: string }
  | { tipo: "aula"; id: string; nome: string }
  | null;

export default function AdminCursosPage() {
  const [cursos, setCursos] = useState<CursoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nivel, setNivel] = useState("");
  const [status, setStatus] = useState<"" | "publicado" | "rascunho">("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [expandido, setExpandido] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Alvo>(null);
  const [excluir, setExcluir] = useState<Exclusao>(null);
  const [excluindo, setExcluindo] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const r = await carregarCursosAdmin();
    setCursos(r.dado ?? []);
    setErro(r.ok ? "" : r.erro ?? "");
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const totalAulas = (c: CursoAdmin) => c.modulos.reduce((a, m) => a + m.aulas.length, 0);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = cursos.filter((c) => {
      if (termo && !`${c.titulo} ${c.subtitulo} ${c.tags.join(" ")}`.toLowerCase().includes(termo))
        return false;
      if (categoria && c.categoria !== categoria) return false;
      if (nivel && c.nivel !== nivel) return false;
      if (status === "publicado" && !c.publicado) return false;
      if (status === "rascunho" && c.publicado) return false;
      return true;
    });

    return [...filtrada].sort((a, b) => {
      switch (ordem) {
        case "alunos": return b.alunos - a.alunos;
        case "aulas": return totalAulas(b) - totalAulas(a);
        case "carga": return b.cargaHoraria - a.cargaHoraria;
        case "titulo": return a.titulo.localeCompare(b.titulo, "pt-BR");
        default: return (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
      }
    });
  }, [cursos, busca, categoria, nivel, status, ordem]);

  const filtrosAtivos = [categoria, nivel, status].filter(Boolean).length;

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    const r =
      excluir.tipo === "curso" ? await apagarCurso(excluir.id)
      : excluir.tipo === "modulo" ? await apagarModulo(excluir.id)
      : await apagarAula(excluir.id);
    setExcluindo(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível excluir.");
    setExcluir(null);
    await recarregar();
  }

  async function alternarPublicacao(c: CursoAdmin) {
    const r = await publicarCurso(c.id, !c.publicado);
    if (!r.ok) return setErro(r.erro ?? "");
    await recarregar();
  }

  async function mover(
    tabela: "aulas" | "modulos",
    itens: Array<{ id: string; ordem: number }>,
    i: number,
    direcao: -1 | 1
  ) {
    const j = i + direcao;
    if (j < 0 || j >= itens.length) return;
    const r = await trocarOrdem(tabela, itens[i], itens[j]);
    if (!r.ok) return setErro(r.erro ?? "");
    await recarregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Cursos</h1>
          <p className="mt-1.5 text-sm text-muted">
            Crie cursos, organize módulos e aulas, envie vídeos e monte a avaliação.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recarregar} disabled={carregando}>
            <RefreshCw size={15} className={cn(carregando && "animate-spin")} /> Atualizar
          </Button>
          <Button variant="gold" onClick={() => setAlvo({ tipo: "curso" })}>
            <Plus size={15} /> Novo curso
          </Button>
        </div>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}

      {/* ------------------------------------------------------- filtros -- */}
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, subtítulo ou tag"
              className={inputCls + " pl-11"}
            />
          </div>

          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className={inputCls + " w-auto min-w-[190px]"}
          >
            {ORDENS.map((o) => (
              <option key={o.v} value={o.v}>{o.rotulo}</option>
            ))}
          </select>

          <button
            onClick={() => setFiltrosAbertos((a) => !a)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
              filtrosAtivos
                ? "border-gold-400 bg-gold-50 text-gold-600"
                : "border-navy-200 text-navy-700 hover:border-gold-400"
            )}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {filtrosAtivos > 0 && (
              <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy-800">
                {filtrosAtivos}
              </span>
            )}
          </button>
        </div>

        {filtrosAbertos && (
          <div className="grid gap-3 border-t border-navy-100 pt-4 sm:grid-cols-3">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputCls}>
              <option value="">Todos os níveis</option>
              {NIVEIS.map((n) => <option key={n}>{n}</option>)}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={inputCls}
            >
              <option value="">Publicados e rascunhos</option>
              <option value="publicado">Só publicados</option>
              <option value="rascunho">Só rascunhos</option>
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            {lista.length} de {cursos.length} curso{cursos.length === 1 ? "" : "s"}
          </span>
          {(busca || filtrosAtivos > 0) && (
            <button
              onClick={() => {
                setBusca(""); setCategoria(""); setNivel(""); setStatus("");
              }}
              className="inline-flex items-center gap-1 font-semibold text-gold-600 transition hover:text-gold-500"
            >
              <X size={12} /> limpar
            </button>
          )}
        </div>
      </Card>

      {/* -------------------------------------------------------- lista -- */}
      {carregando ? (
        <Card><p className="py-8 text-center text-sm text-muted">Carregando cursos…</p></Card>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<FileVideo size={34} />}
          title={cursos.length ? "Nenhum curso com esses filtros" : "Nenhum curso ainda"}
          description={
            cursos.length
              ? "Ajuste a busca ou limpe os filtros."
              : "Crie o primeiro curso, adicione um módulo e comece pelas aulas."
          }
          action={
            !cursos.length ? (
              <Button variant="gold" onClick={() => setAlvo({ tipo: "curso" })}>
                <Plus size={15} /> Novo curso
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {lista.map((c) => {
            const aberto = expandido === c.id;
            const aulas = totalAulas(c);
            const comQuiz = c.modulos.reduce(
              (a, m) => a + m.aulas.filter((x) => x.quizAtivo).length, 0
            );
            const comVideo = c.modulos.reduce(
              (a, m) => a + m.aulas.filter((x) => x.videoOrigem !== "nenhum").length, 0
            );

            return (
              <Card key={c.id} className="!p-0 overflow-hidden">
                <div className="flex w-full items-center gap-4 p-5">
                  <button
                    onClick={() => setExpandido(aberto ? null : c.id)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <span
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ background: c.cor }}
                    >
                      <FileVideo size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-700">{c.titulo}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {c.modulos.length} módulos · {aulas} aulas · {c.cargaHoraria}h ·{" "}
                        {comVideo}/{aulas} com vídeo · {comQuiz} com avaliação
                      </p>
                    </div>
                  </button>

                  <div className="hidden shrink-0 items-center gap-2 lg:flex">
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Users size={12} /> {c.alunos.toLocaleString("pt-BR")}
                    </span>
                    <Badge tone="muted">{c.categoria}</Badge>
                    <Badge tone={c.publicado ? "green" : "gold"}>
                      {c.publicado ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      title={c.publicado ? "Despublicar" : "Publicar"}
                      onClick={() => alternarPublicacao(c)}
                    >
                      {c.publicado ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconBtn>
                    <IconBtn title="Editar curso" onClick={() => setAlvo({ tipo: "curso", curso: c })}>
                      <Pencil size={15} />
                    </IconBtn>
                    <IconBtn
                      title="Excluir curso"
                      danger
                      onClick={() => setExcluir({ tipo: "curso", id: c.id, nome: c.titulo })}
                    >
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>

                {aberto && (
                  <div className="border-t border-navy-100 bg-cream/40 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
                        Estrutura do curso
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost" size="sm"
                          href={`/app/cursos/${c.slug}`}
                        >
                          <Eye size={13} /> Ver como aluno
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setAlvo({ tipo: "modulo", cursoId: c.id })}
                        >
                          <Plus size={13} /> Adicionar módulo
                        </Button>
                      </div>
                    </div>

                    {c.modulos.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-navy-200 py-8 text-center text-sm text-muted">
                        Nenhum módulo ainda. Comece por um — as aulas ficam dentro dele.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {c.modulos.map((m, mi) => (
                          <div key={m.id} className="rounded-xl border border-navy-100 bg-white">
                            <div className="flex items-center gap-2 border-b border-navy-100 px-4 py-3">
                              <Setas
                                aoSubir={() => mover("modulos", c.modulos, mi, -1)}
                                aoDescer={() => mover("modulos", c.modulos, mi, 1)}
                                primeiro={mi === 0}
                                ultimo={mi === c.modulos.length - 1}
                              />
                              <span className="shrink-0 rounded-md bg-navy-700 px-2 py-0.5 text-[10px] font-bold text-white">
                                {String(mi + 1).padStart(2, "0")}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-700">
                                {m.titulo}
                              </span>
                              <span className="shrink-0 text-xs text-muted">
                                {m.aulas.length} aulas
                              </span>
                              <IconBtn
                                title="Editar módulo"
                                onClick={() => setAlvo({ tipo: "modulo", cursoId: c.id, modulo: m })}
                              >
                                <Pencil size={14} />
                              </IconBtn>
                              <IconBtn
                                title="Excluir módulo"
                                danger
                                onClick={() => setExcluir({ tipo: "modulo", id: m.id, nome: m.titulo })}
                              >
                                <Trash2 size={14} />
                              </IconBtn>
                            </div>

                            <ul className="divide-y divide-navy-100">
                              {m.aulas.map((a, ai) => (
                                <li key={a.id} className="flex items-center gap-2 px-4 py-2.5">
                                  <Setas
                                    aoSubir={() => mover("aulas", m.aulas, ai, -1)}
                                    aoDescer={() => mover("aulas", m.aulas, ai, 1)}
                                    primeiro={ai === 0}
                                    ultimo={ai === m.aulas.length - 1}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {a.titulo}
                                  </span>

                                  <Badge tone={a.videoOrigem === "nenhum" ? "muted" : "green"}>
                                    {rotuloOrigem(a.videoOrigem)}
                                  </Badge>

                                  {a.quizAtivo && (
                                    <Badge tone={a.totalQuestoes >= a.quizQtd ? "gold" : "red"}>
                                      <ClipboardCheck size={10} /> {a.totalQuestoes}q
                                    </Badge>
                                  )}

                                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                                    <Clock size={11} className="mr-1 inline" />
                                    {a.duracaoMin}m
                                  </span>

                                  <IconBtn
                                    title="Editar aula"
                                    onClick={() =>
                                      setAlvo({
                                        tipo: "aula", curso: c, moduloId: m.id,
                                        moduloTitulo: m.titulo, aula: a,
                                      })
                                    }
                                  >
                                    <Pencil size={13} />
                                  </IconBtn>
                                  <IconBtn
                                    title="Excluir aula"
                                    danger
                                    onClick={() => setExcluir({ tipo: "aula", id: a.id, nome: a.titulo })}
                                  >
                                    <Trash2 size={13} />
                                  </IconBtn>
                                </li>
                              ))}
                            </ul>

                            <div className="px-4 py-3">
                              <Button
                                variant="ghost" size="sm"
                                onClick={() =>
                                  setAlvo({
                                    tipo: "aula", curso: c, moduloId: m.id, moduloTitulo: m.titulo,
                                  })
                                }
                              >
                                <Plus size={13} /> Adicionar aula
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        As trilhas ficam em{" "}
        <Link href="/admin/trilhas" className="font-semibold text-gold-600 hover:underline">
          Trilhas
        </Link>
        , no menu ao lado.
      </p>

      {/* ------------------------------------------------------- modais -- */}
      {alvo?.tipo === "curso" && (
        <ModalCurso
          curso={alvo.curso}
          aoFechar={() => setAlvo(null)}
          aoSalvar={async () => { setAlvo(null); await recarregar(); }}
        />
      )}

      {alvo?.tipo === "modulo" && (
        <ModalModulo
          cursoId={alvo.cursoId}
          modulo={alvo.modulo}
          aoFechar={() => setAlvo(null)}
          aoSalvar={async () => { setAlvo(null); await recarregar(); }}
        />
      )}

      {alvo?.tipo === "aula" && (
        <ModalAula
          cursoSlug={alvo.curso.slug}
          cursoTitulo={alvo.curso.titulo}
          categoria={alvo.curso.categoria}
          nivel={alvo.curso.nivel}
          moduloId={alvo.moduloId}
          moduloTitulo={alvo.moduloTitulo}
          aula={alvo.aula}
          aoFechar={() => setAlvo(null)}
          aoSalvar={async () => { setAlvo(null); await recarregar(); }}
        />
      )}

      {excluir && (
        <ConfirmarExclusao
          titulo={`Excluir ${excluir.tipo}`}
          descricao={
            excluir.tipo === "curso"
              ? `“${excluir.nome}” será apagado com todos os módulos, aulas, questões e o progresso de quem já assistiu. Não há como desfazer.`
              : excluir.tipo === "modulo"
                ? `O módulo “${excluir.nome}” e todas as aulas dentro dele serão apagados. Não há como desfazer.`
                : `A aula “${excluir.nome}”, suas questões e o progresso dos alunos nela serão apagados. Não há como desfazer.`
          }
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluir(null)}
          ocupado={excluindo}
        />
      )}
    </div>
  );
}

function IconBtn({
  children, title, danger, onClick,
}: {
  children: React.ReactNode; title: string; danger?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
        danger
          ? "text-navy-300 hover:bg-red-50 hover:text-red-600"
          : "text-navy-400 hover:bg-navy-50 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

/** Reordenação por setas: funciona no toque e não depende de biblioteca de drag. */
function Setas({
  aoSubir, aoDescer, primeiro, ultimo,
}: {
  aoSubir: () => void; aoDescer: () => void; primeiro: boolean; ultimo: boolean;
}) {
  return (
    <span className="flex shrink-0 flex-col">
      <button
        onClick={aoSubir}
        disabled={primeiro}
        title="Subir"
        className="text-navy-200 transition hover:text-navy-700 disabled:opacity-25 disabled:hover:text-navy-200"
      >
        <ArrowUp size={12} />
      </button>
      <button
        onClick={aoDescer}
        disabled={ultimo}
        title="Descer"
        className="text-navy-200 transition hover:text-navy-700 disabled:opacity-25 disabled:hover:text-navy-200"
      >
        <ArrowDown size={12} />
      </button>
    </span>
  );
}
