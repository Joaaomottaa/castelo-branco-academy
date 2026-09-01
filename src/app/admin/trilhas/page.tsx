"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Award, BadgeCheck, Clock, Eye, EyeOff, GraduationCap,
  Pencil, Plus, RefreshCw, Route, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro, ConfirmarExclusao, Modal } from "@/components/modal";
import {
  apagarTrilha, carregarCursosAdmin, carregarTrilhasAdmin, definirCursosDaTrilha,
  definirHabilidadesDaTrilha, gerarSlug, listarHabilidades, publicarTrilha,
  recalcularSelos, salvarTrilha, type CursoAdmin, type DadosTrilha, type TrilhaAdmin,
} from "@/lib/repo-admin";
import { NIVEIS } from "../cursos/modais";

// Mesmas áreas já usadas pelas trilhas do banco — filtro com lista divergente
// esconde trilha que existe.
const AREAS = ["Fiscal", "Tributário", "Comex", "Pessoal", "Gestão", "Contábil"];
const CORES = ["#00204D", "#B88A45", "#2F6E75", "#1F4A7A", "#7A3E2F", "#3D5A3C"];

/* ==========================================================================
   ADMINISTRAÇÃO DAS TRILHAS

   A trilha é o que liga o catálogo ao banco de talentos: ela agrupa cursos por
   cargo, declara as habilidades que o egresso passa a ter e vira requisito de
   vaga. Por isso o formulário insiste em três coisas que costumam ser
   esquecidas e que quebram o encaixe:

   · cargo-alvo — sem ele a trilha não casa com vaga nenhuma;
   · quais cursos são obrigatórios — só eles contam para emitir o selo;
   · habilidades com nível esperado — é o que alimenta o cálculo de match.
   ========================================================================== */

export default function AdminTrilhasPage() {
  const [trilhas, setTrilhas] = useState<TrilhaAdmin[]>([]);
  const [cursos, setCursos] = useState<CursoAdmin[]>([]);
  const [habilidades, setHabilidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [editando, setEditando] = useState<TrilhaAdmin | "nova" | null>(null);
  const [excluir, setExcluir] = useState<TrilhaAdmin | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [rt, rc, rh] = await Promise.all([
      carregarTrilhasAdmin(),
      carregarCursosAdmin(),
      listarHabilidades(),
    ]);
    setTrilhas(rt.dado ?? []);
    setCursos(rc.dado ?? []);
    setHabilidades(rh);
    setErro(rt.ok ? "" : rt.erro ?? "");
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return trilhas.filter((t) => {
      if (termo && !`${t.nome} ${t.cargoAlvo} ${t.area}`.toLowerCase().includes(termo)) return false;
      if (area && t.area !== area) return false;
      return true;
    });
  }, [trilhas, busca, area]);

  async function alternarPublicacao(t: TrilhaAdmin) {
    const r = await publicarTrilha(t.id, !t.publicada);
    if (!r.ok) return setErro(r.erro ?? "");
    await recarregar();
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    const r = await apagarTrilha(excluir.id);
    setExcluindo(false);
    if (!r.ok) return setErro(r.erro ?? "");
    setExcluir(null);
    await recarregar();
  }

  async function rodarBackfill() {
    setRecalculando(true);
    setAviso("");
    const r = await recalcularSelos();
    setRecalculando(false);
    if (!r.ok) return setErro(r.erro ?? "");
    setAviso(
      r.dado
        ? `${r.dado} selo${r.dado > 1 ? "s" : ""} emitido${r.dado > 1 ? "s" : ""} para quem já tinha os certificados.`
        : "Nenhum selo pendente — todo mundo que completou já tinha recebido."
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Trilhas de carreira</h1>
          <p className="mt-1.5 text-sm text-muted">
            Agrupe cursos por cargo. A trilha concluída vira selo no perfil e requisito de vaga.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={rodarBackfill} disabled={recalculando}>
            <Sparkles size={15} className={cn(recalculando && "animate-pulse")} /> Recalcular selos
          </Button>
          <Button variant="gold" onClick={() => setEditando("nova")}>
            <Plus size={15} /> Nova trilha
          </Button>
        </div>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}
      {aviso && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <BadgeCheck size={16} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cargo ou área"
              className={inputCls + " pl-11"}
            />
          </div>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls + " w-auto min-w-[180px]"}>
            <option value="">Todas as áreas</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <Button variant="outline" onClick={recarregar} disabled={carregando}>
            <RefreshCw size={15} className={cn(carregando && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {carregando ? (
        <Card><p className="py-8 text-center text-sm text-muted">Carregando trilhas…</p></Card>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<Route size={34} />}
          title={trilhas.length ? "Nenhuma trilha com esses filtros" : "Nenhuma trilha ainda"}
          description="Uma trilha reúne os cursos que levam a um cargo. Comece pelo cargo que a Castelo Branco mais contrata."
          action={
            <Button variant="gold" onClick={() => setEditando("nova")}>
              <Plus size={15} /> Nova trilha
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((t) => {
            const obrigatorios = t.cursos.filter((c) => c.obrigatorio).length;
            return (
              <Card key={t.id} className="!p-0 overflow-hidden">
                <div className="flex items-start gap-4 p-5">
                  <span
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: t.cor }}
                  >
                    <Route size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy-700">{t.nome}</p>
                    <p className="mt-0.5 text-xs text-muted leading-snug">
                      {t.cargoAlvo} · {t.area}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={t.publicada ? "green" : "gold"}>
                        {t.publicada ? "Publicada" : "Rascunho"}
                      </Badge>
                      <Badge tone="muted">
                        <GraduationCap size={10} /> {t.cursos.length} cursos
                      </Badge>
                      <Badge tone="muted">
                        <Clock size={10} /> {t.cargaHoraria}h
                      </Badge>
                      <Badge tone="navy">
                        <Award size={10} /> {t.pontosPEPC} PEPC
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <IconBtn
                      title={t.publicada ? "Despublicar" : "Publicar"}
                      onClick={() => alternarPublicacao(t)}
                    >
                      {t.publicada ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconBtn>
                    <IconBtn title="Editar" onClick={() => setEditando(t)}>
                      <Pencil size={15} />
                    </IconBtn>
                    <IconBtn title="Excluir" danger onClick={() => setExcluir(t)}>
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>

                <div className="border-t border-navy-100 bg-cream/40 px-5 py-3">
                  {obrigatorios === 0 ? (
                    <p className="text-xs font-semibold text-amber-700">
                      Nenhum curso obrigatório — sem isso o selo nunca é emitido.
                    </p>
                  ) : (
                    <p className="text-xs text-muted leading-snug">
                      Selo emitido ao concluir {obrigatorios} curso
                      {obrigatorios > 1 ? "s" : ""} obrigatório{obrigatorios > 1 ? "s" : ""} ·{" "}
                      {t.habilidades.length} habilidade{t.habilidades.length === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editando && (
        <ModalTrilha
          trilha={editando === "nova" ? undefined : editando}
          cursos={cursos}
          habilidades={habilidades}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => { setEditando(null); await recarregar(); }}
        />
      )}

      {excluir && (
        <ConfirmarExclusao
          titulo="Excluir trilha"
          descricao={`“${excluir.nome}” será apagada, junto com os selos já emitidos por ela. Os certificados dos cursos individuais permanecem. Não há como desfazer.`}
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluir(null)}
          ocupado={excluindo}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Formulário
   ========================================================================== */
function ModalTrilha({
  trilha, cursos, habilidades, aoFechar, aoSalvar,
}: {
  trilha?: TrilhaAdmin;
  cursos: CursoAdmin[];
  habilidades: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const editando = Boolean(trilha);
  const [aba, setAba] = useState<"dados" | "cursos" | "habilidades">("dados");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [f, setF] = useState<DadosTrilha>({
    id: trilha?.id,
    slug: trilha?.slug ?? "",
    nome: trilha?.nome ?? "",
    subtitulo: trilha?.subtitulo ?? "",
    descricao: trilha?.descricao ?? "",
    cargoAlvo: trilha?.cargoAlvo ?? "",
    area: trilha?.area ?? AREAS[0],
    nivelEntrada: trilha?.nivelEntrada ?? NIVEIS[0],
    nivelSaida: trilha?.nivelSaida ?? NIVEIS[2],
    cor: trilha?.cor ?? CORES[0],
    faixaSalarial: trilha?.faixaSalarial ?? "",
    publicada: trilha?.publicada ?? false,
  });

  const [selecionados, setSelecionados] = useState<Array<{ cursoId: string; obrigatorio: boolean }>>(
    trilha?.cursosDetalhe.map((c) => ({ cursoId: c.cursoId, obrigatorio: c.obrigatorio })) ?? []
  );
  const [habs, setHabs] = useState<Array<{ habilidadeId: string; nivelEsperado: number }>>(
    trilha?.habilidadeIds ?? []
  );

  const porId = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos]);
  const cargaTotal = selecionados.reduce((a, s) => a + (porId.get(s.cursoId)?.cargaHoraria ?? 0), 0);
  const pepcTotal = selecionados.reduce((a, s) => a + (porId.get(s.cursoId)?.pontosPEPC ?? 0), 0);
  const obrigatorios = selecionados.filter((s) => s.obrigatorio).length;

  function alternarCurso(cursoId: string) {
    setSelecionados((s) =>
      s.some((x) => x.cursoId === cursoId)
        ? s.filter((x) => x.cursoId !== cursoId)
        : [...s, { cursoId, obrigatorio: true }]
    );
  }

  function moverCurso(i: number, direcao: -1 | 1) {
    const j = i + direcao;
    if (j < 0 || j >= selecionados.length) return;
    setSelecionados((s) => {
      const novo = [...s];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  }

  async function submeter() {
    if (!f.nome.trim()) { setAba("dados"); return setErro("A trilha precisa de um nome."); }
    if (!f.cargoAlvo.trim()) { setAba("dados"); return setErro("Informe o cargo-alvo — é ele que liga a trilha às vagas."); }
    if (!f.slug.trim()) { setAba("dados"); return setErro("O endereço (slug) é obrigatório."); }
    if (selecionados.length === 0) { setAba("cursos"); return setErro("Escolha ao menos um curso."); }
    if (obrigatorios === 0) { setAba("cursos"); return setErro("Marque ao menos um curso como obrigatório, senão o selo nunca é emitido."); }

    setSalvando(true);
    setErro("");

    const r = await salvarTrilha(f);
    if (!r.ok || !r.dado) {
      setSalvando(false);
      return setErro(r.erro ?? "Não foi possível salvar a trilha.");
    }

    const [rc, rh] = await Promise.all([
      definirCursosDaTrilha(r.dado, selecionados),
      definirHabilidadesDaTrilha(r.dado, habs),
    ]);
    setSalvando(false);

    if (!rc.ok) return setErro(`Trilha salva, mas os cursos não: ${rc.erro}`);
    if (!rh.ok) return setErro(`Trilha salva, mas as habilidades não: ${rh.erro}`);
    aoSalvar();
  }

  return (
    <Modal
      titulo={editando ? "Editar trilha" : "Nova trilha"}
      subtitulo={editando ? trilha!.slug : "Reúna os cursos que formam alguém para um cargo."}
      aoFechar={aoFechar}
      largura="max-w-3xl"
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {selecionados.length} cursos · {obrigatorios} obrigatórios · {cargaTotal}h ·{" "}
            {pepcTotal} PEPC
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
            <Button variant="gold" onClick={submeter} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar trilha"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>

        <div className="flex gap-1 rounded-xl bg-cream p-1">
          {([
            ["dados", "Dados"],
            ["cursos", `Cursos (${selecionados.length})`],
            ["habilidades", `Habilidades (${habs.length})`],
          ] as const).map(([k, rotulo]) => (
            <button
              key={k}
              onClick={() => setAba(k)}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition",
                aba === k ? "bg-white text-navy-700 shadow-sm" : "text-muted hover:text-navy-700"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {/* --------------------------------------------------------- dados */}
        {aba === "dados" && (
          <div className="space-y-5">
            <Field label="Nome da trilha">
              <input
                value={f.nome}
                onChange={(e) =>
                  setF((v) => ({
                    ...v,
                    nome: e.target.value,
                    slug: editando ? v.slug : gerarSlug(e.target.value),
                  }))
                }
                placeholder="Ex.: Analista Fiscal — do iniciante ao profissional"
                className={inputCls}
              />
            </Field>

            <Field label="Endereço (slug)" hint={`/app/trilhas/${f.slug || "..."}`}>
              <input
                value={f.slug}
                onChange={(e) => setF((v) => ({ ...v, slug: gerarSlug(e.target.value) }))}
                className={inputCls}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Cargo-alvo"
                hint="É por este texto que a vaga encontra a trilha. Use o nome do cargo como está no anúncio."
              >
                <input
                  value={f.cargoAlvo}
                  onChange={(e) => setF((v) => ({ ...v, cargoAlvo: e.target.value }))}
                  placeholder="Analista Fiscal"
                  className={inputCls}
                />
              </Field>
              <Field label="Área">
                <select
                  value={f.area}
                  onChange={(e) => setF((v) => ({ ...v, area: e.target.value }))}
                  className={inputCls}
                >
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Subtítulo">
              <input
                value={f.subtitulo}
                onChange={(e) => setF((v) => ({ ...v, subtitulo: e.target.value }))}
                placeholder="A trilha que tira você do zero e coloca no departamento fiscal"
                className={inputCls}
              />
            </Field>

            <Field label="Descrição">
              <textarea
                rows={3}
                value={f.descricao}
                onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
                className={inputCls}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Nível de entrada">
                <select
                  value={f.nivelEntrada}
                  onChange={(e) => setF((v) => ({ ...v, nivelEntrada: e.target.value }))}
                  className={inputCls}
                >
                  {NIVEIS.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Nível de saída">
                <select
                  value={f.nivelSaida}
                  onChange={(e) => setF((v) => ({ ...v, nivelSaida: e.target.value }))}
                  className={inputCls}
                >
                  {NIVEIS.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Faixa salarial" hint="Aparece na página da trilha.">
                <input
                  value={f.faixaSalarial}
                  onChange={(e) => setF((v) => ({ ...v, faixaSalarial: e.target.value }))}
                  placeholder="R$ 2.500 – R$ 7.200"
                  className={inputCls}
                />
              </Field>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
                Cor
              </span>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setF((v) => ({ ...v, cor: c }))}
                    className={cn(
                      "h-9 w-9 rounded-lg border-2 transition",
                      f.cor === c ? "border-gold-400 ring-2 ring-gold-400/30" : "border-transparent"
                    )}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4">
              <input
                type="checkbox"
                checked={f.publicada}
                onChange={(e) => setF((v) => ({ ...v, publicada: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[#C89F50]"
              />
              <span>
                <span className="block text-sm font-semibold text-navy-700">Publicada</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Só trilhas publicadas aparecem para o aluno e podem ser exigidas por uma vaga.
                </span>
              </span>
            </label>
          </div>
        )}

        {/* -------------------------------------------------------- cursos */}
        {aba === "cursos" && (
          <div className="space-y-5">
            {selecionados.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                  Sequência da trilha
                </p>
                <div className="space-y-2">
                  {selecionados.map((s, i) => {
                    const c = porId.get(s.cursoId);
                    if (!c) return null;
                    return (
                      <div
                        key={s.cursoId}
                        className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white p-3"
                      >
                        <span className="flex shrink-0 flex-col">
                          <button
                            onClick={() => moverCurso(i, -1)}
                            disabled={i === 0}
                            className="text-navy-200 transition hover:text-navy-700 disabled:opacity-25"
                            title="Subir"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moverCurso(i, 1)}
                            disabled={i === selecionados.length - 1}
                            className="text-navy-200 transition hover:text-navy-700 disabled:opacity-25"
                            title="Descer"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </span>
                        <span className="shrink-0 rounded-md bg-navy-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-ink leading-snug">{c.titulo}</span>
                        <span className="shrink-0 text-xs text-muted">{c.cargaHoraria}h</span>
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={s.obrigatorio}
                            onChange={(e) =>
                              setSelecionados((lista) =>
                                lista.map((x) =>
                                  x.cursoId === s.cursoId
                                    ? { ...x, obrigatorio: e.target.checked }
                                    : x
                                )
                              )
                            }
                            className="h-3.5 w-3.5 accent-[#C89F50]"
                          />
                          <span className="text-xs font-semibold text-navy-600">obrigatório</span>
                        </label>
                        <button
                          onClick={() => alternarCurso(s.cursoId)}
                          className="shrink-0 text-navy-300 transition hover:text-red-600"
                          title="Remover da trilha"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-xs text-muted">
                  O selo é emitido quando o aluno conclui todos os cursos marcados como
                  obrigatórios. Os opcionais enriquecem a trilha sem travar o selo.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                Catálogo
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-navy-100 p-2">
                {cursos.map((c) => {
                  const dentro = selecionados.some((s) => s.cursoId === c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => alternarCurso(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                        dentro ? "bg-gold-50" : "hover:bg-cream"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          dentro ? "border-gold-400 bg-gold-400 text-white" : "border-navy-200"
                        )}
                      >
                        {dentro && <Plus size={10} className="rotate-45" />}
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-ink leading-snug">{c.titulo}</span>
                      {!c.publicado && <Badge tone="gold">Rascunho</Badge>}
                      <span className="shrink-0 text-xs text-muted">{c.cargaHoraria}h</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- habilidades */}
        {aba === "habilidades" && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">
              As habilidades da trilha alimentam o cálculo de compatibilidade com as vagas.
              O nível esperado é a régua: 90 significa que o egresso deve resolver o assunto
              sozinho; 70, que executa com supervisão.
            </p>

            <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-xl border border-navy-100 p-2">
              {habilidades.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Nenhuma habilidade cadastrada no banco.
                </p>
              )}
              {habilidades.map((h) => {
                const atual = habs.find((x) => x.habilidadeId === h.id);
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition",
                      atual ? "bg-gold-50" : "hover:bg-cream"
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(atual)}
                        onChange={(e) =>
                          setHabs((lista) =>
                            e.target.checked
                              ? [...lista, { habilidadeId: h.id, nivelEsperado: 80 }]
                              : lista.filter((x) => x.habilidadeId !== h.id)
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-[#C89F50]"
                      />
                      <span className="text-sm text-ink leading-snug">{h.nome}</span>
                    </label>
                    {atual && (
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          type="range" min={40} max={100} step={5}
                          value={atual.nivelEsperado}
                          onChange={(e) =>
                            setHabs((lista) =>
                              lista.map((x) =>
                                x.habilidadeId === h.id
                                  ? { ...x, nivelEsperado: Number(e.target.value) }
                                  : x
                              )
                            )
                          }
                          className="w-28 accent-[#C89F50]"
                        />
                        <span className="w-8 text-right text-xs font-bold tabular-nums text-navy-700">
                          {atual.nivelEsperado}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
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
