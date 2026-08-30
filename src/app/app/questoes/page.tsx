"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, BookMarked, BookOpen, Check,
  CheckCircle2, ChevronRight, Filter, ListChecks, Loader2, Lock, NotebookPen,
  Plus, RotateCcw, Save, Search, Sparkles, Target, TrendingUp, X, XCircle,
} from "lucide-react";
import { Badge, Button, Card, Carregando, EmptyState, Progress, cn, inputCls } from "@/components/ui";
import { useSession } from "@/lib/session";
import { ehPago, limitesDoPlano } from "@/lib/planos";
import {
  adicionarAoCaderno, carregarCadernos, carregarQuestoes, criarCaderno,
  meuHistoricoQuestoes, questoesDoCaderno, registrarResposta, respostasDeHoje,
  salvarSimulado, type SituacaoQuestao,
} from "@/lib/repo-questoes";
import type { RespostaSimulado } from "@/lib/types";
import { avancarMissao, registrarEstudo, registrarXP } from "@/lib/repo-gamificacao";
import { FaixaRevisao } from "@/components/revisao";
import { QuestaoCard } from "@/components/questao-card";
import { Paginacao } from "@/components/paginacao";
import type { Caderno, QuestaoBanco } from "@/lib/types";

type Modo = "praticar" | "simulado";

/**
 * Filtrar pelo próprio histórico é o que separa estudo de rolagem: sem isso a
 * pessoa refaz a questão que já domina enquanto a que ela erra continua
 * escondida no meio da lista.
 */
const SITUACOES = [
  ["", "Todas"],
  ["nao", "Não respondidas"],
  ["erradas", "Respondidas — errei"],
  ["certas", "Respondidas — acertei"],
] as const;

type Situacao = (typeof SITUACOES)[number][0];

/**
 * Cinco por página. A questão agora vem inteira, com alternativas e abas —
 * vinte delas numa página só é rolagem, não estudo.
 */
const POR_PAGINA = 5;

export default function Page() {
  return (
    <Suspense fallback={<Carregando texto="Carregando o banco de questões…" />}>
      <QuestoesPage />
    </Suspense>
  );
}

function QuestoesPage() {
  const { user, modoDemo } = useSession();
  const params = useSearchParams();
  const pago = ehPago(user?.plano);
  const limites = limitesDoPlano(user?.plano);

  const [questoes, setQuestoes] = useState<QuestaoBanco[] | null>(null);
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [respondidasHoje, setRespondidasHoje] = useState(0);

  /* filtros — vários de cada eixo; dentro do eixo é "ou", entre eixos é "e" */
  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [assuntosSel, setAssuntosSel] = useState<string[]>([]);
  const [niveisSel, setNiveisSel] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("");
  /** O que eu já fiz em cada questão — base dos filtros de situação. */
  const [historico, setHistorico] = useState<Map<string, SituacaoQuestao>>(new Map());
  /** A lista só aparece depois do "Buscar questões". */
  const [buscou, setBuscou] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [cadernoFiltro, setCadernoFiltro] = useState<string | null>(
    params.get("caderno")
  );
  const [idsDoCaderno, setIdsDoCaderno] = useState<string[] | null>(null);

  /* sessão de estudo */
  const [modo, setModo] = useState<Modo>("praticar");
  const [iniciada, setIniciada] = useState(false);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [finalizado, setFinalizado] = useState(false);

  /* IA */
  const [explicando, setExplicando] = useState(false);
  const [explicacaoIA, setExplicacaoIA] = useState<Record<string, string>>({});

  /* modais */
  const [modalCaderno, setModalCaderno] = useState<QuestaoBanco | null>(null);
  const [novoCaderno, setNovoCaderno] = useState("");

  /* guardar o simulado */
  const [nomeSimulado, setNomeSimulado] = useState("");
  const [salvandoSim, setSalvandoSim] = useState(false);
  const [simuladoSalvo, setSimuladoSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      carregarQuestoes(),
      user?.id && !modoDemo ? carregarCadernos(user.id) : Promise.resolve(cadernosFallback),
      user?.id && !modoDemo ? respostasDeHoje(user.id) : Promise.resolve(0),
      user?.id && !modoDemo
        ? meuHistoricoQuestoes(user.id)
        : Promise.resolve(new Map<string, SituacaoQuestao>()),
    ]).then(([q, c, r, h]) => {
      if (!ativo) return;
      setQuestoes(q);
      setCadernos(c);
      setRespondidasHoje(r);
      setHistorico(h);
    });
    return () => { ativo = false; };
  }, [user?.id, modoDemo]);

  useEffect(() => {
    if (!cadernoFiltro || modoDemo) { setIdsDoCaderno(null); return; }
    questoesDoCaderno(cadernoFiltro).then(setIdsDoCaderno);
  }, [cadernoFiltro, modoDemo]);

  const areas = useMemo(() => [...new Set((questoes ?? []).map((q) => q.area))].sort(), [questoes]);
  const assuntos = useMemo(() => {
    const base = areasSel.length
      ? (questoes ?? []).filter((q) => areasSel.includes(q.area))
      : (questoes ?? []);
    return [...new Set(base.map((q) => q.assunto))].sort();
  }, [questoes, areasSel]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (questoes ?? []).filter((x) => {
      if (areasSel.length && !areasSel.includes(x.area)) return false;
      if (assuntosSel.length && !assuntosSel.includes(x.assunto)) return false;
      if (niveisSel.length && !niveisSel.includes(x.nivel)) return false;
      if (cadernoFiltro && idsDoCaderno && !idsDoCaderno.includes(x.id)) return false;

      if (situacao) {
        const h = historico.get(x.id);
        if (situacao === "nao" && h) return false;
        if (situacao === "erradas" && (!h || h.ultimaCorreta)) return false;
        if (situacao === "certas" && (!h || !h.ultimaCorreta)) return false;
      }

      if (q && !x.enunciado.toLowerCase().includes(q) && !x.assunto.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questoes, areasSel, assuntosSel, niveisSel, busca, cadernoFiltro, idsDoCaderno, situacao, historico]);

  // Mexeu no filtro, o resultado anterior deixa de valer: esconder a lista
  // evita a pessoa iniciar um simulado com o recorte que ela acabou de trocar.
  useEffect(() => {
    setBuscou(false);
    setPagina(1);
  }, [areasSel, assuntosSel, niveisSel, busca, cadernoFiltro, situacao]);

  /** Assunto que sobrou de uma área desmarcada não pode continuar filtrando. */
  useEffect(() => {
    setAssuntosSel((sel) => sel.filter((a) => assuntos.includes(a)));
  }, [assuntos]);

  const restantesHoje = pago
    ? Infinity
    : Math.max(0, (limites.questoesPorDia as number) - respondidasHoje);
  const bloqueado = !pago && restantesHoje <= 0;

  const atual = filtradas[indice];
  const respondida = atual ? confirmadas.has(atual.id) : false;
  const acertos = filtradas.filter(
    (q) => confirmadas.has(q.id) && respostas[q.id] === q.correta
  ).length;

  function limpar() {
    setAreasSel([]); setAssuntosSel([]); setNiveisSel([]);
    setBusca(""); setCadernoFiltro(null); setSituacao(""); setBuscou(false);
  }

  function alternar(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  const algumFiltro =
    areasSel.length > 0 || assuntosSel.length > 0 || niveisSel.length > 0 ||
    Boolean(busca) || Boolean(cadernoFiltro) || Boolean(situacao);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  function comecar(m: Modo) {
    setModo(m);
    setIniciada(true);
    setNomeSimulado(nomePadraoSimulado(areasSel, assuntosSel, niveisSel));
    setSimuladoSalvo(false);
    setIndice(0);
    setRespostas({});
    setConfirmadas(new Set());
    setFinalizado(false);
    setExplicacaoIA({});
  }

  /**
   * Registra a resposta de uma questão qualquer.
   *
   * A lista e o modo focado passam pelo mesmo caminho: duas rotinas de
   * gravação divergiriam na primeira mudança de XP ou de limite diário.
   */
  async function registrar(q: QuestaoBanco, escolha: string) {
    if (!user || confirmadas.has(q.id)) return;

    const acertou = escolha === q.correta;
    setRespostas((r) => ({ ...r, [q.id]: escolha }));
    setConfirmadas((s) => new Set(s).add(q.id));
    setRespondidasHoje((n) => n + 1);
    setHistorico((h) => {
      const novo = new Map(h);
      const atual = novo.get(q.id);
      novo.set(q.id, {
        tentativas: (atual?.tentativas ?? 0) + 1,
        ultimaCorreta: acertou,
        jaAcertei: (atual?.jaAcertei ?? false) || acertou,
      });
      return novo;
    });

    if (!modoDemo) {
      void registrarResposta(user.id, q.id, escolha, acertou);
      void registrarEstudo(user.id, { minutos: 1 });
      void avancarMissao(user.id, "diaria-questoes");
      if (acertou) void registrarXP(user.id, "questao", 10, `Questão certa: ${q.assunto}`);
    }
  }

  /** Cria o caderno e já devolve o id para a aba selecionar. */
  async function criarCadernoLocal(nome: string): Promise<string | null> {
    if (!user || modoDemo) return null;
    const id = await criarCaderno(user.id, nome);
    if (!id) return null;
    setCadernos((c) => [
      { id, nome, cor: "#00204D", total: 0, criadoEm: new Date().toISOString() },
      ...c,
    ]);
    return id;
  }

  async function vincularAoCaderno(cadernoId: string, questaoId: string) {
    if (modoDemo) return;
    await adicionarAoCaderno(cadernoId, questaoId);
    setCadernos((c) =>
      c.map((x) => (x.id === cadernoId ? { ...x, total: x.total + 1 } : x))
    );
  }

  async function confirmar() {
    if (!atual) return;
    const escolha = respostas[atual.id];
    if (!escolha) return;
    await registrar(atual, escolha);
  }

  /** As respostas do simulado, com o enunciado copiado — ver `RespostaSimulado`. */
  function respostasDoSimulado(): RespostaSimulado[] {
    return filtradas
      .filter((q) => confirmadas.has(q.id))
      .map((q) => ({
        questaoId: q.id,
        enunciado: q.enunciado,
        area: q.area,
        assunto: q.assunto,
        nivel: q.nivel,
        marcada: respostas[q.id] ?? "",
        correta: q.correta,
        textoCorreta: q.alternativas.find((a) => a.id === q.correta)?.texto,
        acertou: respostas[q.id] === q.correta,
      }));
  }

  async function finalizar() {
    setFinalizado(true);
    if (user && !modoDemo && modo === "simulado") {
      const pct = confirmadas.size ? (acertos / confirmadas.size) * 100 : 0;
      if (pct >= 80) void registrarXP(user.id, "simulado", 200, "Simulado com 80% ou mais");
    }
  }

  /**
   * Guardar é escolha do aluno, não automático.
   *
   * Antes todo simulado virava linha no histórico, inclusive os três que a
   * pessoa abandonou testando filtro. Um histórico cheio de lixo não é
   * histórico.
   */
  async function guardarSimulado() {
    if (!user || modoDemo) return;
    setSalvandoSim(true);
    const r = await salvarSimulado(
      user.id,
      nomeSimulado.trim() || nomePadraoSimulado(areasSel, assuntosSel, niveisSel),
      confirmadas.size,
      acertos,
      {
        area: areasSel.join(", ") || undefined,
        assunto: assuntosSel.join(", ") || undefined,
        nivel: niveisSel.join(", ") || undefined,
      },
      respostasDoSimulado()
    );
    setSalvandoSim(false);
    if (r.id) setSimuladoSalvo(true);
  }

  /** Explicação por IA — chama o mesmo webhook do assistente. */
  async function pedirExplicacaoIA() {
    if (!atual || !pago) return;
    setExplicando(true);
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "explicar_questao",
          questao: atual.enunciado,
          alternativas: atual.alternativas,
          correta: atual.correta,
          marcada: respostas[atual.id],
          explicacao: atual.explicacao,
          assunto: atual.assunto,
        }),
      });
      const dados = await r.json();
      setExplicacaoIA((e) => ({
        ...e,
        [atual.id]:
          dados.resposta ??
          "Não consegui gerar a explicação agora. O comentário do professor abaixo continua disponível.",
      }));
    } catch {
      setExplicacaoIA((e) => ({
        ...e,
        [atual.id]:
          "O assistente está indisponível no momento. Verifique se o fluxo do n8n está ativo — o comentário do professor abaixo continua valendo.",
      }));
    }
    setExplicando(false);
  }

  if (!questoes) return <Carregando texto="Carregando o banco de questões…" />;

  /* ======================================================= tela de resultado */
  if (finalizado) {
    const total = confirmadas.size;
    const pct = total ? Math.round((acertos / total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="text-center">
          <span
            className={cn(
              "mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full",
              pct >= 70 ? "bg-emerald-50 text-emerald-600" : pct >= 50 ? "bg-gold-50 text-gold-500" : "bg-red-50 text-red-500"
            )}
          >
            {pct >= 70 ? <CheckCircle2 size={30} /> : <Target size={30} />}
          </span>
          <p className="eyebrow text-gold-500">{modo === "simulado" ? "Simulado concluído" : "Prática concluída"}</p>
          <h1 className="mt-2 text-4xl font-bold text-navy-700">{pct}%</h1>
          <p className="mt-2 text-sm text-muted">
            {acertos} acerto{acertos === 1 ? "" : "s"} em {total} questõe{total === 1 ? "m" : "s"}
          </p>
          <Progress value={pct} className="mt-5" tone={pct >= 70 ? "green" : "gold"} />

          <p className="mt-5 text-sm leading-relaxed text-ink">
            {pct >= 80
              ? "Desempenho de quem domina o assunto. Vale partir para um nível acima."
              : pct >= 60
                ? "Base sólida, com pontos a reforçar. Revise as que errou antes de avançar."
                : "Vale revisitar o curso da área antes de tentar de novo — errar aqui é barato, no cliente não."}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="gold" onClick={() => comecar(modo)}>
              <RotateCcw size={15} /> Refazer
            </Button>
            <Button variant="outline" onClick={() => { setIniciada(false); setFinalizado(false); }}>
              Voltar aos filtros
            </Button>
          </div>
        </Card>

        {/* Guardar é escolha do aluno: histórico automático enche de simulado
            abandonado e deixa de servir para comparar evolução. */}
        {modo === "simulado" && total > 0 && (
          <Card className={simuladoSalvo ? "!border-emerald-200 !bg-emerald-50" : undefined}>
            {simuladoSalvo ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={17} /> Simulado guardado
                </p>
                <Button href="/app/questoes/simulados" variant="outline" size="sm">
                  Ver em Meus simulados <ArrowRight size={13} />
                </Button>
              </div>
            ) : (
              <>
                <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <Save size={15} className="text-gold-500" /> Salvar este simulado
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Fica em <strong className="text-navy-700">Meus simulados</strong> com as
                  questões que você errou — e com a análise do Tino quando você pedir.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    value={nomeSimulado}
                    onChange={(e) => setNomeSimulado(e.target.value)}
                    placeholder="Nome do simulado"
                    className={inputCls + " flex-1"}
                  />
                  <Button
                    variant="gold"
                    onClick={guardarSimulado}
                    disabled={salvandoSim || modoDemo}
                  >
                    {salvandoSim ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
                {modoDemo && (
                  <p className="mt-2 text-xs text-gold-600">
                    No modo demonstração o simulado não é gravado — ele depende do banco.
                  </p>
                )}
              </>
            )}
          </Card>
        )}

        {/* Revisão das erradas */}
        {filtradas.filter((q) => confirmadas.has(q.id) && respostas[q.id] !== q.correta).length > 0 && (
          <Card>
            <h2 className="text-sm font-bold text-navy-700">O que revisar</h2>
            <div className="mt-4 space-y-3">
              {filtradas
                .filter((q) => confirmadas.has(q.id) && respostas[q.id] !== q.correta)
                .map((q) => (
                  <div key={q.id} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="muted">{q.area}</Badge>
                      <Badge tone="red">{q.assunto}</Badge>
                    </div>
                    <p className="mt-2.5 text-sm text-ink">{q.enunciado}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Correta: {q.alternativas.find((a) => a.id === q.correta)?.texto}
                    </p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  /* ========================================================= tela de estudo */
  if (iniciada && atual) {
    const escolha = respostas[atual.id];
    const acertou = escolha === atual.correta;

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setIniciada(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
          >
            <ArrowLeft size={15} /> Sair
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              Questão <strong className="text-navy-700">{indice + 1}</strong> de {filtradas.length}
            </span>
            {modo === "praticar" && confirmadas.size > 0 && (
              <Badge tone="green">{acertos} acerto{acertos === 1 ? "" : "s"}</Badge>
            )}
          </div>
        </div>

        <Progress value={((indice + 1) / filtradas.length) * 100} />

        {!pago && (
          <div className="flex items-center gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-xs font-semibold text-gold-600">
            <AlertCircle size={14} />
            Plano gratuito: {restantesHoje === Infinity ? "" : `${restantesHoje} questõe${restantesHoje === 1 ? "m" : "s"} restante${restantesHoje === 1 ? "" : "s"} hoje`}
          </div>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="navy">{atual.area}</Badge>
            <Badge tone="muted">{atual.assunto}</Badge>
            <Badge tone="muted">{atual.nivel}</Badge>
            {atual.banca && <Badge tone="teal">{atual.banca} {atual.ano}</Badge>}
            <button
              onClick={() => setModalCaderno(atual)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1 text-[11px] font-semibold text-navy-600 transition hover:border-gold-400 hover:text-gold-600"
            >
              <BookMarked size={12} /> Salvar em caderno
            </button>
          </div>

          <p className="mt-5 text-[15px] font-medium leading-relaxed text-ink">
            {atual.enunciado}
          </p>

          <div className="mt-5 space-y-2.5">
            {atual.alternativas.map((alt) => {
              const marcada = escolha === alt.id;
              const eCorreta = alt.id === atual.correta;
              const mostrar = respondida;

              return (
                <button
                  key={alt.id}
                  disabled={respondida}
                  onClick={() => setRespostas((r) => ({ ...r, [atual.id]: alt.id }))}
                  className={cn(
                    "flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition",
                    mostrar && eCorreta && "border-emerald-300 bg-emerald-50",
                    mostrar && marcada && !eCorreta && "border-red-300 bg-red-50",
                    mostrar && !eCorreta && !marcada && "border-navy-100 opacity-60",
                    !mostrar && marcada && "border-gold-400 bg-gold-50",
                    !mostrar && !marcada && "border-navy-100 hover:border-navy-300 hover:bg-cream/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                      mostrar && eCorreta && "bg-emerald-500 text-white",
                      mostrar && marcada && !eCorreta && "bg-red-500 text-white",
                      !mostrar && marcada && "gold-gradient text-navy-800",
                      !mostrar && !marcada && "bg-navy-50 text-navy-500",
                      mostrar && !eCorreta && !marcada && "bg-navy-50 text-navy-400"
                    )}
                  >
                    {mostrar && eCorreta ? <Check size={14} /> : mostrar && marcada ? <X size={14} /> : alt.id}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-ink">{alt.texto}</span>
                </button>
              );
            })}
          </div>

          {/* Resultado + explicação */}
          {respondida && (
            <div className="mt-5 space-y-3">
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold",
                  acertou ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}
              >
                {acertou ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                {acertou ? "Você acertou." : "Resposta incorreta."}
              </div>

              {atual.explicacao && (
                <div className="rounded-xl border border-navy-100 bg-cream/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-navy-600">
                    Comentário do professor
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{atual.explicacao}</p>
                </div>
              )}

              {/* IA — só plano pago */}
              {!acertou && (
                pago ? (
                  explicacaoIA[atual.id] ? (
                    <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-600">
                        <Sparkles size={12} /> Tino explica
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gold-600/95">
                        {explicacaoIA[atual.id]}
                      </p>
                    </div>
                  ) : (
                    <Button variant="gold" onClick={pedirExplicacaoIA} disabled={explicando} full>
                      {explicando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      Pedir para o Tino explicar por que errei
                    </Button>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-gold-300 bg-gold-50/60 p-4 text-center">
                    <Lock size={17} className="mx-auto text-gold-500" />
                    <p className="mt-2 text-sm font-semibold text-navy-700">
                      Quer entender exatamente onde errou?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      No plano Pro o Tino analisa a alternativa que você marcou e explica o
                      raciocínio correto passo a passo.
                    </p>
                    <Button href="/app/planos" variant="gold" size="sm" className="mt-3">
                      Conhecer o Pro <ArrowRight size={13} />
                    </Button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Navegação */}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-navy-100 pt-5">
            <Button
              variant="ghost"
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
            >
              <ArrowLeft size={15} /> Anterior
            </Button>

            {!respondida ? (
              <Button variant="primary" onClick={confirmar} disabled={!escolha || bloqueado}>
                {bloqueado ? "Limite diário atingido" : "Confirmar resposta"}
              </Button>
            ) : indice === filtradas.length - 1 ? (
              <Button variant="gold" onClick={finalizar}>
                Ver resultado <ArrowRight size={15} />
              </Button>
            ) : (
              <Button variant="gold" onClick={() => setIndice((i) => i + 1)}>
                Próxima <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </Card>

        {bloqueado && <BloqueioPlano limite={limites.questoesPorDia as number} />}
        {modalCaderno && (
          <ModalCaderno
            questao={modalCaderno}
            cadernos={cadernos}
            pago={pago}
            limite={limites.cadernos}
            novo={novoCaderno}
            setNovo={setNovoCaderno}
            onFechar={() => setModalCaderno(null)}
            onCriar={async (nome) => {
              if (!user) return;
              const id = await criarCaderno(user.id, nome);
              const cd: Caderno = {
                id: id ?? `local-${Date.now()}`, nome, cor: "#00204D",
                total: 1, criadoEm: new Date().toISOString(),
              };
              setCadernos((c) => [cd, ...c]);
              if (id) void adicionarAoCaderno(id, modalCaderno.id);
              setNovoCaderno("");
              setModalCaderno(null);
            }}
            onAdicionar={(cadernoId) => {
              void adicionarAoCaderno(cadernoId, modalCaderno.id);
              setCadernos((c) => c.map((x) => x.id === cadernoId ? { ...x, total: x.total + 1 } : x));
              setModalCaderno(null);
            }}
          />
        )}
      </div>
    );
  }

  /* ========================================================= tela de filtros */
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-500">Banco de questões</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
            Praticar é mais barato que errar no cliente
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {questoes.length} questões de tributário, fiscal, comex, pessoal, contábil e
            gestão. Filtre, pratique e monte simulados com correção comentada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/app/questoes/resultados" variant="gold">
            <BarChart3 size={15} /> Meus resultados
          </Button>
          <Button href="/app/questoes/simulados" variant="outline">
            <TrendingUp size={15} /> Meus simulados
          </Button>
          <Button href="/app/questoes/cadernos" variant="outline">
            <NotebookPen size={15} /> Meus cadernos
          </Button>
        </div>
      </div>

      <FaixaRevisao />

      {!pago && (
        <Card className="!border-gold-200 !bg-gold-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-gold-500" />
              <div>
                <p className="text-sm font-bold text-navy-700">
                  Plano gratuito: {limites.questoesPorDia} questões por dia
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gold-600/90">
                  Você já respondeu {respondidasHoje} hoje. No Pro são ilimitadas, com
                  cadernos sem limite e o Tino explicando cada erro.
                </p>
              </div>
            </div>
            <Button href="/app/planos" variant="gold" size="sm">
              Ver planos <ArrowRight size={13} />
            </Button>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="space-y-5">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por enunciado ou assunto (ex.: split payment, NCM, rescisão)"
            className={inputCls + " pl-11"}
          />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Filter size={12} /> Área
            <span className="font-normal normal-case tracking-normal">
              · pode marcar mais de uma
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <Chip
                key={a}
                ativo={areasSel.includes(a)}
                onClick={() => alternar(areasSel, setAreasSel, a)}
              >
                {a}
              </Chip>
            ))}
          </div>
        </div>

        {assuntos.length > 1 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              Assunto
            </p>
            <div className="flex flex-wrap gap-1.5">
              {assuntos.map((a) => (
                <Chip
                  key={a}
                  ativo={assuntosSel.includes(a)}
                  onClick={() => alternar(assuntosSel, setAssuntosSel, a)}
                >
                  {a}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Minha situação
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SITUACOES.map(([k, label]) => (
              <Chip key={k || "todas"} ativo={situacao === k} onClick={() => setSituacao(k)}>
                {label}
                {k && historico.size > 0 && (
                  <span className="ml-1.5 opacity-70">{contarSituacao(questoes ?? [], historico, k)}</span>
                )}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Nível</p>
            <div className="flex flex-wrap gap-1.5">
              {["Iniciante", "Intermediário", "Avançado"].map((n) => (
                <Chip
                  key={n}
                  ativo={niveisSel.includes(n)}
                  onClick={() => alternar(niveisSel, setNiveisSel, n)}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          {cadernos.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Caderno</p>
              <select
                value={cadernoFiltro ?? ""}
                onChange={(e) => setCadernoFiltro(e.target.value || null)}
                className={inputCls}
              >
                <option value="">Todas as questões</option>
                {cadernos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.total})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-t border-navy-100 pt-5">
          <p className="text-sm text-muted">
            {algumFiltro ? (
              <>
                <strong className="text-navy-700">{filtradas.length}</strong>{" "}
                {filtradas.length === 1 ? "questão" : "questões"} com esses filtros
              </>
            ) : (
              <>Sem filtro, busca nas {questoes.length} questões do banco.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => { setBuscou(true); setPagina(1); }}
              disabled={filtradas.length === 0}
            >
              <Search size={15} /> Buscar questões
            </Button>
            {algumFiltro && (
              <button onClick={limpar} className="text-xs font-semibold text-gold-600 hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </Card>

      {buscou && filtradas.length === 0 && (
        <EmptyState
          icon={<BookOpen size={34} />}
          title="Nenhuma questão com esses filtros"
          description="Tente ampliar a área ou remover o assunto."
          action={<Button variant="outline" onClick={limpar}>Limpar filtros</Button>}
        />
      )}

      {buscou && filtradas.length > 0 && (
        <div className="space-y-4">
          {/* O modo simulado só aparece depois de existir resultado. Antes, ele
              competia com os filtros pela atenção de quem ainda escolhia o que
              estudar. */}
          <Card className="!border-navy-200 !py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <ListChecks size={16} className="text-gold-500" />
                  {filtradas.length}{" "}
                  {filtradas.length === 1 ? "questão encontrada" : "questões encontradas"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Responda aqui mesmo — o gabarito, a estatística da turma e as aulas
                  do assunto abrem embaixo de cada questão.
                </p>
              </div>
              <Button variant="gold" onClick={() => comecar("simulado")} disabled={bloqueado}>
                <TrendingUp size={15} /> Modo simulado
              </Button>
            </div>
          </Card>

          {visiveis.map((q, i) => (
            <QuestaoCard
              key={q.id}
              questao={q}
              numero={(pagina - 1) * POR_PAGINA + i + 1}
              marcada={respostas[q.id]}
              respondida={confirmadas.has(q.id)}
              bloqueado={bloqueado}
              pago={pago}
              jaRespondida={historico.has(q.id)}
              cadernos={cadernos}
              podeCriarCaderno={
                limites.cadernos === "ilimitado" || cadernos.length < limites.cadernos
              }
              aoResponder={(alt) => registrar(q, alt)}
              aoCriarCaderno={criarCadernoLocal}
              aoVincular={vincularAoCaderno}
            />
          ))}

          <Paginacao
            pagina={pagina}
            total={totalPaginas}
            primeiro={(pagina - 1) * POR_PAGINA + 1}
            ultimo={Math.min(pagina * POR_PAGINA, filtradas.length)}
            itens={filtradas.length}
            rotulo={filtradas.length === 1 ? "questão" : "questões"}
            aoIr={setPagina}
          />
        </div>
      )}

      {bloqueado && <BloqueioPlano limite={limites.questoesPorDia as number} />}
    </div>
  );
}

/* ---------------------------------------------------------------- auxiliares */
/** Quantas questões do banco caem em cada situação do aluno. */
function contarSituacao(
  questoes: QuestaoBanco[],
  historico: Map<string, SituacaoQuestao>,
  situacao: Situacao
): number {
  return questoes.filter((q) => {
    const h = historico.get(q.id);
    if (situacao === "nao") return !h;
    if (situacao === "erradas") return Boolean(h) && !h!.ultimaCorreta;
    if (situacao === "certas") return Boolean(h) && h!.ultimaCorreta;
    return true;
  }).length;
}

/**
 * Nome sugerido a partir do recorte escolhido.
 *
 * "Simulado 3" não diz nada três meses depois; "Simulado Fiscal · SPED" diz
 * exatamente o que foi medido.
 */
function nomePadraoSimulado(
  areas: string[],
  assuntos: string[],
  niveis: string[]
): string {
  const partes = [
    areas.length === 1 ? areas[0] : areas.length > 1 ? `${areas.length} áreas` : "geral",
    assuntos.length === 1 ? assuntos[0] : assuntos.length > 1 ? `${assuntos.length} assuntos` : null,
    niveis.length === 1 ? niveis[0] : null,
  ].filter(Boolean);
  return `Simulado ${partes.join(" · ")}`;
}

/**
 * O limite diário.
 *
 * Antes era um bloco vermelho de "acabou" e um botão de planos. Continua
 * dizendo a verdade, mas agora diz também o que fazer hoje: o que segue
 * liberado, quando a cota volta e o que muda no Pro. Vender no meio do estudo
 * só funciona quando a oferta não fecha a porta primeiro.
 */
function BloqueioPlano({ limite = 3 }: { limite?: number }) {
  return (
    <Card className="!border-gold-200 !bg-gold-50">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/25 text-gold-600">
          <Lock size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-navy-700">
            Limite diário atingido — {limite} questões no plano gratuito
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gold-600/90">
            A sua cota volta amanhã de manhã. Enquanto isso, continua liberado:
            rever o gabarito das questões que você já respondeu, os seus cadernos
            e as aulas ligadas a cada assunto.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["Questões ilimitadas", "Sem cota diária, todo dia."],
              ["Tino em cada erro", "Dúvida com IA sem limite."],
              ["Cadernos sem teto", "Monte quantos quiser."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-gold-200 bg-white/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-navy-700">
                  <Sparkles size={12} className="text-gold-500" /> {t}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button href="/app/planos" variant="gold" size="sm">
              Conhecer o Pro <ArrowRight size={14} />
            </Button>
            <Button href="/app/questoes/cadernos" variant="outline" size="sm">
              Ver meus cadernos
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ModalCaderno({
  questao, cadernos, pago, limite, novo, setNovo, onFechar, onCriar, onAdicionar,
}: {
  questao: QuestaoBanco; cadernos: Caderno[]; pago: boolean;
  limite: number | "ilimitado"; novo: string; setNovo: (v: string) => void;
  onFechar: () => void; onCriar: (nome: string) => void; onAdicionar: (id: string) => void;
}) {
  const podeeCriar = limite === "ilimitado" || cadernos.length < limite;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-navy-700">Salvar em caderno</h3>
            <p className="mt-1 text-xs text-muted">{questao.assunto}</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-navy-700"><X size={20} /></button>
        </div>

        <div className="mt-5 space-y-2">
          {cadernos.map((c) => (
            <button
              key={c.id}
              onClick={() => onAdicionar(c.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3.5 text-left transition hover:border-gold-400 hover:bg-cream/50"
            >
              <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: c.cor }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-700">{c.nome}</p>
                <p className="text-xs text-muted">{c.total} questõe{c.total === 1 ? "m" : "s"}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-navy-300" />
            </button>
          ))}
          {cadernos.length === 0 && (
            <p className="py-3 text-center text-sm text-muted">Você ainda não tem cadernos.</p>
          )}
        </div>

        <div className="mt-5 border-t border-navy-100 pt-5">
          {podeeCriar ? (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Novo caderno</p>
              <div className="flex gap-2">
                <input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  placeholder="Ex.: Revisar antes da prova"
                  className={inputCls}
                />
                <Button variant="gold" onClick={() => novo.trim() && onCriar(novo.trim())} disabled={!novo.trim()}>
                  <Plus size={15} />
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-300 bg-gold-50 p-4 text-center">
              <p className="text-sm font-semibold text-navy-700">
                Plano gratuito permite {limite} caderno
              </p>
              <Button href="/app/planos" variant="gold" size="sm" className="mt-2.5">
                Liberar cadernos ilimitados
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, ativo, onClick }: { children: React.ReactNode; ativo?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-600"
          : "border-navy-100 bg-white text-muted hover:border-navy-200 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

const cadernosFallback: Caderno[] = [
  { id: "cd1", nome: "Revisar antes da prova", cor: "#B88A45", total: 3, criadoEm: new Date().toISOString() },
  { id: "cd2", nome: "Reforma Tributária", cor: "#00204D", total: 2, criadoEm: new Date().toISOString() },
];
