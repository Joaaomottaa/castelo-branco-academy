"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Bot, CheckCircle2, ChevronDown, Loader2, NotebookPen,
  Sparkles, Target, Trash2, TrendingUp, XCircle,
} from "lucide-react";
import { Badge, Button, Card, Carregando, EmptyState, Progress, cn } from "@/components/ui";
import { ConfirmarExclusao } from "@/components/modal";
import { TextoRico } from "@/components/texto-rico";
import { AreaLinha, BarrasRanking } from "@/components/graficos";
import { useSession } from "@/lib/session";
import {
  apagarSimulado, carregarSimulados, salvarFeedbackSimulado,
} from "@/lib/repo-questoes";
import type { ResultadoSimulado } from "@/lib/types";

/* ==========================================================================
   MEUS SIMULADOS

   O simulado deixou de ser um número que aparece e some. Aqui ele vira
   registro: o que caiu, o que a pessoa marcou, o que era certo.

   O "Feedback do Tino" é gerado uma vez e guardado. O simulado já terminou —
   a análise não muda, e regerar a cada abertura seria queimar chamada de IA
   para produzir o mesmo texto.
   ========================================================================== */

export default function SimuladosPage() {
  const { user, modoDemo } = useSession();
  const [lista, setLista] = useState<ResultadoSimulado[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<ResultadoSimulado | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.id || modoDemo) {
      setLista(modoDemo ? demo : []);
      return;
    }
    setLista(await carregarSimulados(user.id));
  }, [user?.id, modoDemo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(() => {
    const l = lista ?? [];
    if (!l.length) return null;
    const total = l.reduce((a, s) => a + s.total, 0);
    const acertos = l.reduce((a, s) => a + s.acertos, 0);
    return {
      quantos: l.length,
      total,
      acertos,
      media: total ? Math.round((acertos / total) * 100) : 0,
      melhor: Math.max(...l.map((s) => Math.round(s.nota))),
    };
  }, [lista]);

  // Evolução do mais antigo para o mais novo — a lista vem ao contrário.
  const evolucao = useMemo(() => {
    const l = [...(lista ?? [])].reverse().slice(-12);
    return l.map((s) => ({
      rotulo: s.finalizadoEm
        ? new Date(s.finalizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : "—",
      valor: Math.round(s.nota),
    }));
  }, [lista]);

  const porAssunto = useMemo(() => {
    const mapa = new Map<string, { erros: number; total: number }>();
    for (const s of lista ?? []) {
      for (const r of s.respostas ?? []) {
        const a = mapa.get(r.assunto) ?? { erros: 0, total: 0 };
        a.total += 1;
        if (!r.acertou) a.erros += 1;
        mapa.set(r.assunto, a);
      }
    }
    return [...mapa.entries()]
      .filter(([, v]) => v.erros > 0)
      .sort((a, b) => b[1].erros - a[1].erros)
      .slice(0, 6)
      .map(([assunto, v]) => ({
        rotulo: assunto,
        valor: v.erros,
        detalhe: `${Math.round(((v.total - v.erros) / v.total) * 100)}% de acerto em ${v.total}`,
      }));
  }, [lista]);

  async function confirmarExclusao() {
    if (!excluindo) return;
    if (!modoDemo) await apagarSimulado(excluindo.id);
    setLista((l) => (l ?? []).filter((s) => s.id !== excluindo.id));
    setExcluindo(null);
  }

  if (!lista) return <Carregando texto="Carregando seus simulados…" />;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/app/questoes"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
          >
            <ArrowLeft size={15} /> Questões
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Meus simulados</h1>
          <p className="mt-1.5 text-sm text-muted">
            Os simulados que você guardou, com o que caiu e o que errou em cada um.
          </p>
        </div>
        <Button href="/app/questoes/cadernos" variant="outline">
          <NotebookPen size={15} /> Meus cadernos
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={34} />}
          title="Nenhum simulado guardado"
          description="Ao terminar um simulado, dê um nome e clique em Salvar. Ele fica aqui com as questões que você errou e com a análise do Tino."
          action={
            <Button href="/app/questoes" variant="gold">
              Fazer um simulado <ArrowRight size={15} />
            </Button>
          }
        />
      ) : (
        <>
          {resumo && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador valor={String(resumo.quantos)} rotulo="Simulados guardados" />
              <Indicador valor={`${resumo.media}%`} rotulo="Média geral" destaque />
              <Indicador valor={`${resumo.melhor}%`} rotulo="Melhor resultado" />
              <Indicador
                valor={`${resumo.acertos}/${resumo.total}`}
                rotulo="Acertos no total"
              />
            </div>
          )}

          {(evolucao.length >= 2 || porAssunto.length > 0) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {evolucao.length >= 2 && (
                <Card>
                  <h2 className="text-sm font-bold text-navy-700">Nota simulado a simulado</h2>
                  <p className="mt-0.5 text-xs text-muted">Do mais antigo ao mais recente.</p>
                  <div className="mt-5">
                    <AreaLinha
                      rotulos={evolucao.map((e) => e.rotulo)}
                      valores={evolucao.map((e) => e.valor)}
                      altura={180}
                      formatar={(v) => `${v}%`}
                    />
                  </div>
                </Card>
              )}

              {porAssunto.length > 0 && (
                <Card>
                  <h2 className="text-sm font-bold text-navy-700">
                    Assuntos que mais derrubam
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Somando todos os simulados guardados.
                  </p>
                  <div className="mt-4">
                    <BarrasRanking
                      itens={porAssunto}
                      formatar={(v) => `${v} ${v === 1 ? "erro" : "erros"}`}
                    />
                  </div>
                </Card>
              )}
            </div>
          )}

          <div className="space-y-3">
            {lista.map((s) => (
              <SimuladoCard
                key={s.id}
                simulado={s}
                aberto={aberto === s.id}
                modoDemo={modoDemo}
                aoAlternar={() => setAberto(aberto === s.id ? null : s.id)}
                aoExcluir={() => setExcluindo(s)}
                aoGuardarFeedback={(texto) =>
                  setLista((l) =>
                    (l ?? []).map((x) => (x.id === s.id ? { ...x, feedback: texto } : x))
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {excluindo && (
        <ConfirmarExclusao
          titulo="Excluir simulado"
          descricao={`"${excluindo.nome}" sai do seu histórico. As respostas que você deu nas questões continuam contando em Meus resultados — só este registro é apagado.`}
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluindo(null)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- peças -- */
function Indicador({
  valor, rotulo, destaque,
}: {
  valor: string; rotulo: string; destaque?: boolean;
}) {
  return (
    <Card className="!p-4">
      <p className={cn("text-2xl font-bold", destaque ? "text-gold-600" : "text-navy-700")}>
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-muted">{rotulo}</p>
    </Card>
  );
}

function SimuladoCard({
  simulado, aberto, modoDemo, aoAlternar, aoExcluir, aoGuardarFeedback,
}: {
  simulado: ResultadoSimulado;
  aberto: boolean;
  modoDemo: boolean;
  aoAlternar: () => void;
  aoExcluir: () => void;
  aoGuardarFeedback: (texto: string) => void;
}) {
  const [pedindo, setPedindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nota = Math.round(simulado.nota);
  const respostas = simulado.respostas ?? [];
  const erradas = respostas.filter((r) => !r.acertou);

  async function pedirFeedback() {
    setPedindo(true);
    setErro(null);
    try {
      const r = await fetch("/api/feedback-simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: simulado.nome,
          total: simulado.total,
          acertos: simulado.acertos,
          respostas,
        }),
      });
      const dados = await r.json();
      if (!r.ok || !dados.feedback) {
        setErro(dados.erro ?? "Não consegui gerar a análise agora.");
      } else {
        aoGuardarFeedback(dados.feedback);
        if (!modoDemo) void salvarFeedbackSimulado(simulado.id, dados.feedback);
      }
    } catch {
      setErro("O assistente está indisponível no momento.");
    }
    setPedindo(false);
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        onClick={aoAlternar}
        className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition hover:bg-cream/50"
      >
        <span
          className={cn(
            "inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold",
            nota >= 70
              ? "bg-emerald-50 text-emerald-600"
              : nota >= 50
                ? "bg-gold-50 text-gold-600"
                : "bg-red-50 text-red-600"
          )}
        >
          {nota}%
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-navy-700">{simulado.nome}</p>
          <p className="mt-0.5 text-xs text-muted">
            {simulado.acertos} de {simulado.total} ·{" "}
            {simulado.finalizadoEm
              ? new Date(simulado.finalizadoEm).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "sem data"}
            {simulado.feedback && " · analisado pelo Tino"}
          </p>
          <Progress value={nota} className="mt-2" tone={nota >= 70 ? "green" : "gold"} />
        </div>

        <ChevronDown
          size={18}
          className={cn("shrink-0 text-muted transition", aberto && "rotate-180")}
        />
      </button>

      {aberto && (
        <div className="space-y-5 border-t border-navy-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="green">
                {simulado.acertos} {simulado.acertos === 1 ? "acerto" : "acertos"}
              </Badge>
              <Badge tone="red">
                {erradas.length} {erradas.length === 1 ? "erro" : "erros"}
              </Badge>
            </div>
            <button
              onClick={aoExcluir}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>

          {/* Feedback do Tino */}
          <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <Bot size={16} className="text-gold-500" /> Feedback do Tino
            </p>

            {simulado.feedback ? (
              <div className="mt-3 text-sm leading-relaxed text-ink">
                <TextoRico texto={simulado.feedback} />
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-gold-600">
                  O Tino lê as questões que você acertou e errou e diz por onde
                  recomeçar. A análise é gerada uma vez e fica guardada aqui.
                </p>
                {erro && (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {erro}
                  </p>
                )}
                <Button
                  variant="gold"
                  size="sm"
                  className="mt-3"
                  onClick={pedirFeedback}
                  disabled={pedindo || respostas.length === 0}
                >
                  {pedindo ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Analisando…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Analisar meu desempenho
                    </>
                  )}
                </Button>
                {respostas.length === 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Este simulado foi guardado antes de a plataforma passar a registrar
                    as respostas — não há o que analisar.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Questões */}
          {respostas.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-navy-600">
                Questões deste simulado
              </p>
              <div className="space-y-2">
                {respostas.map((r, i) => (
                  <div
                    key={`${r.questaoId}-${i}`}
                    className={cn(
                      "rounded-xl border p-3.5",
                      r.acertou
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-red-200 bg-red-50/40"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {r.acertou ? (
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="muted">{r.area}</Badge>
                          <Badge tone="muted">{r.assunto}</Badge>
                          <Badge tone="muted">{r.nivel}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink">{r.enunciado}</p>
                        {!r.acertou && (
                          <p className="mt-2 text-xs text-emerald-700">
                            <strong>Correta ({r.correta.toUpperCase()}):</strong>{" "}
                            {r.textoCorreta ?? "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ modo demo -- */
const demo: ResultadoSimulado[] = [
  {
    id: "s-demo-1",
    nome: "Simulado Tributário · Reforma Tributária",
    total: 8,
    acertos: 7,
    nota: 87.5,
    finalizadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
    respostas: [
      {
        questaoId: "d1",
        enunciado:
          "No modelo da CBS/IBS, o direito ao crédito do adquirente fica condicionado a quê?",
        area: "Tributário",
        assunto: "Reforma Tributária",
        nivel: "Intermediário",
        marcada: "a",
        correta: "b",
        textoCorreta: "Ao efetivo recolhimento do tributo pelo fornecedor.",
        acertou: false,
      },
      {
        questaoId: "d2",
        enunciado: "O Imposto Seletivo incide sobre:",
        area: "Tributário",
        assunto: "Reforma Tributária",
        nivel: "Iniciante",
        marcada: "b",
        correta: "b",
        textoCorreta: "Bens e serviços prejudiciais à saúde ou ao meio ambiente.",
        acertou: true,
      },
    ],
  },
  {
    id: "s-demo-2",
    nome: "Simulado geral",
    total: 12,
    acertos: 7,
    nota: 58.3,
    finalizadoEm: new Date(Date.now() - 9 * 86400000).toISOString(),
    respostas: [],
  },
];
