"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Lightbulb,
  RotateCcw, ShieldCheck, Trophy, X, XCircle,
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { corrigirQuiz, sortearQuestoes, statusDoQuiz } from "@/lib/repo-quiz";
import type { QuestaoAula, ResultadoQuiz, StatusQuiz } from "@/lib/types";

/* ==========================================================================
   AVALIAÇÃO PÓS-AULA — modal, uma questão por página

   Antes a prova ficava aberta embaixo do vídeo. Quem ainda estava assistindo
   já via as perguntas, e quem terminava não percebia que aquilo era a prova.
   Agora ela é um evento: a pessoa clica em concluir, o modal abre por cima
   do vídeo e o mundo lá fora para.

   Três decisões que mudam a sensação de uso:

   1. Uma questão por página. Rolagem com quatro questões abertas vira
      varredura; página única vira leitura.
   2. As questões são sorteadas a cada tentativa. Repetir a prova não é
      decorar a ordem — é estudar de novo.
   3. O gabarito só aparece no fim, com a explicação de cada erro. Errar sem
      entender não ensina nada.
   ========================================================================== */

export function ModalQuiz({
  aulaId,
  aulaTitulo,
  cursoTitulo,
  aoFechar,
  aoAprovar,
}: {
  aulaId: string;
  aulaTitulo: string;
  cursoTitulo?: string;
  aoFechar: () => void;
  /** Disparado quando a pessoa passa: sincroniza o progresso na interface. */
  aoAprovar: () => void;
}) {
  const [status, setStatus] = useState<StatusQuiz | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoAula[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [indice, setIndice] = useState(0);
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null);
  const [fase, setFase] = useState<"aviso" | "respondendo" | "resultado">("aviso");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setStatus(await statusDoQuiz(aulaId));
  }, [aulaId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Esc fecha, menos no meio da prova: sair sem querer queimaria a tentativa
  // na cabeça de quem estava respondendo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fase !== "respondendo") aoFechar();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aoFechar, fase]);

  async function comecar() {
    if (!status) return;
    setErro(null);
    const qs = await sortearQuestoes(aulaId, status.qtd);
    if (!qs.length) {
      setErro("Não foi possível carregar as questões desta aula.");
      return;
    }
    setQuestoes(qs);
    setRespostas({});
    setIndice(0);
    setResultado(null);
    setFase("respondendo");
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const { resultado: r, erro: e } = await corrigirQuiz(
      aulaId,
      questoes.map((q) => ({ questaoId: q.id, resposta: respostas[q.id] ?? null }))
    );
    setEnviando(false);

    if (e || !r) {
      setErro(e ?? "Não foi possível enviar as respostas.");
      return;
    }

    setResultado(r);
    setFase("resultado");
    await recarregar();
    if (r.aprovada) aoAprovar();
  }

  const restantes = status ? status.tentativasMax - status.tentativasUsadas : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 p-4 backdrop-blur-sm"
      onClick={() => fase !== "respondendo" && aoFechar()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-navy-100 px-6 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-500">
              <ClipboardCheck size={13} /> Teste de conhecimento
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold text-navy-700">{aulaTitulo}</h2>
            {cursoTitulo && <p className="truncate text-xs text-muted">{cursoTitulo}</p>}
          </div>
          {fase !== "respondendo" && (
            <button
              onClick={aoFechar}
              className="shrink-0 text-muted transition hover:text-navy-700"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Barra de progresso da prova */}
        {fase === "respondendo" && questoes.length > 0 && (
          <div className="shrink-0 border-b border-navy-100 px-6 py-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>
                Questão {indice + 1} de {questoes.length}
              </span>
              <span>
                {Object.keys(respostas).length} respondida
                {Object.keys(respostas).length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {questoes.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setIndice(i)}
                  aria-label={`Ir para a questão ${i + 1}`}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition",
                    i === indice
                      ? "bg-gold-400"
                      : respostas[q.id]
                        ? "bg-navy-600"
                        : "bg-navy-100"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {!status ? (
            <p className="py-10 text-center text-sm text-muted">Carregando avaliação…</p>
          ) : erro ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          ) : fase === "aviso" ? (
            <Abertura status={status} restantes={restantes} />
          ) : fase === "respondendo" ? (
            <Pergunta
              questao={questoes[indice]}
              marcada={respostas[questoes[indice].id]}
              aoMarcar={(alt) =>
                setRespostas((r) => ({ ...r, [questoes[indice].id]: alt }))
              }
            />
          ) : (
            resultado && <Resultado resultado={resultado} questoes={questoes} />
          )}
        </div>

        {/* Rodapé — a ação muda com a fase */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-6 py-4">
          {fase === "aviso" && (
            <>
              <button
                onClick={aoFechar}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:text-navy-700"
              >
                Agora não
              </button>
              <Button
                variant="gold"
                onClick={comecar}
                disabled={status !== null && restantes <= 0 && !status.aprovada}
              >
                {status?.aprovada ? "Refazer para praticar" : "Começar teste"}{" "}
                <ArrowRight size={15} />
              </Button>
            </>
          )}

          {fase === "respondendo" && (
            <>
              <button
                onClick={() => setIndice((i) => Math.max(0, i - 1))}
                disabled={indice === 0}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-40"
              >
                <ArrowLeft size={15} /> Anterior
              </button>

              {indice < questoes.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setIndice((i) => i + 1)}
                  disabled={!respostas[questoes[indice].id]}
                >
                  Próxima <ArrowRight size={15} />
                </Button>
              ) : (
                <Button
                  variant="gold"
                  onClick={enviar}
                  disabled={enviando || Object.keys(respostas).length < questoes.length}
                >
                  {enviando ? "Corrigindo…" : "Enviar respostas"}
                </Button>
              )}
            </>
          )}

          {fase === "resultado" && resultado && (
            <>
              <span className="text-xs text-muted">
                Tentativa {resultado.tentativasUsadas} de {resultado.tentativasMax}
              </span>
              <div className="flex flex-wrap gap-2">
                {!resultado.aprovada &&
                  resultado.tentativasUsadas < resultado.tentativasMax && (
                    <Button variant="outline" onClick={comecar}>
                      <RotateCcw size={15} /> Tentar novamente
                    </Button>
                  )}
                <Button variant={resultado.aprovada ? "gold" : "primary"} onClick={aoFechar}>
                  {resultado.aprovada ? "Continuar" : "Voltar para a aula"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- telas --- */
function Abertura({ status, restantes }: { status: StatusQuiz; restantes: number }) {
  if (status.aprovada) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={26} />
        </span>
        <h3 className="mt-4 text-lg font-bold text-navy-700">Você já passou nesta aula</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          A aula está concluída. Pode refazer o teste quantas vezes quiser para
          praticar — o resultado de treino não altera o seu progresso.
        </p>
      </div>
    );
  }

  if (restantes <= 0) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <XCircle size={26} />
        </span>
        <h3 className="mt-4 text-lg font-bold text-navy-700">Tentativas esgotadas</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Você usou as {status.tentativasMax} tentativas desta aula. Reveja o vídeo
          e fale com a coordenação da Academy para liberar uma nova rodada.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <span className="gold-gradient mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl text-navy-800">
        <ShieldCheck size={26} />
      </span>
      <h3 className="mt-4 text-lg font-bold text-navy-700">
        Vamos testar o que você aprendeu
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        As questões são sorteadas do banco desta aula. Responder de novo não
        repete a mesma prova.
      </p>

      <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-3">
        {[
          [String(status.qtd), status.qtd === 1 ? "questão" : "questões"],
          [String(status.minimo), "acertos para passar"],
          [String(restantes), restantes === 1 ? "tentativa" : "tentativas"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-xl border border-navy-100 bg-cream/60 p-3.5">
            <p className="text-2xl font-bold text-navy-700">{n}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
          </div>
        ))}
      </div>

      {status.tentativasUsadas > 0 && (
        <p className="mt-5 text-xs text-muted">
          Você já usou {status.tentativasUsadas} de {status.tentativasMax}.
        </p>
      )}
    </div>
  );
}

function Pergunta({
  questao,
  marcada,
  aoMarcar,
}: {
  questao: QuestaoAula;
  marcada?: string;
  aoMarcar: (alt: string) => void;
}) {
  return (
    <div>
      <p className="text-[15px] font-semibold leading-relaxed text-navy-700">
        {questao.enunciado}
      </p>
      <div className="mt-5 space-y-2.5">
        {questao.alternativas.map((alt) => {
          const ativa = marcada === alt.id;
          return (
            <button
              key={alt.id}
              onClick={() => aoMarcar(alt.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                ativa
                  ? "border-gold-400 bg-gold-50 ring-1 ring-gold-300"
                  : "border-navy-100 hover:border-navy-200 hover:bg-cream/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                  ativa ? "gold-gradient text-navy-800" : "bg-navy-50 text-navy-600"
                )}
              >
                {alt.id}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-ink">
                {alt.texto}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Resultado({
  resultado,
  questoes,
}: {
  resultado: ResultadoQuiz;
  questoes: QuestaoAula[];
}) {
  const erros = resultado.gabarito.filter((g) => !g.acertou);
  const porId = new Map(questoes.map((q) => [q.id, q]));

  return (
    <div className="space-y-6">
      {/* Placar */}
      <div
        className={cn(
          "rounded-2xl border p-6 text-center",
          resultado.aprovada
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        )}
      >
        <span
          className={cn(
            "mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl",
            resultado.aprovada ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          )}
        >
          {resultado.aprovada ? <Trophy size={26} /> : <XCircle size={26} />}
        </span>

        <p
          className={cn(
            "mt-3 text-3xl font-bold",
            resultado.aprovada ? "text-emerald-700" : "text-red-700"
          )}
        >
          {resultado.acertos} de {resultado.total}
        </p>
        <p
          className={cn(
            "mt-1 text-sm font-semibold",
            resultado.aprovada ? "text-emerald-700" : "text-red-700"
          )}
        >
          {resultado.aprovada
            ? "Aprovado — aula concluída"
            : `Faltou atingir ${resultado.minimo} ${resultado.minimo === 1 ? "acerto" : "acertos"}`}
        </p>

        <div className="mt-4 flex items-center justify-center gap-6 text-xs font-semibold">
          <span className="text-emerald-700">
            {resultado.acertos} {resultado.acertos === 1 ? "acerto" : "acertos"}
          </span>
          <span className="text-red-700">
            {erros.length} {erros.length === 1 ? "erro" : "erros"}
          </span>
          <span className="text-muted">
            {Math.round((resultado.acertos / Math.max(1, resultado.total)) * 100)}% de
            aproveitamento
          </span>
        </div>

        {!resultado.aprovada &&
          resultado.tentativasUsadas >= resultado.tentativasMax && (
            <p className="mt-4 text-xs text-red-700">
              Esta era a última tentativa. Reveja a aula e procure a coordenação.
            </p>
          )}
      </div>

      {/* Gabarito com explicação — só faz sentido para o que errou */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-navy-600">
          Gabarito comentado
        </p>

        {resultado.gabarito.map((g, i) => {
          const q = porId.get(g.questaoId);
          const alternativa = (id: string | null) =>
            q?.alternativas.find((a) => a.id === id)?.texto ?? "—";

          return (
            <div
              key={g.questaoId}
              className={cn(
                "rounded-xl border p-4",
                g.acertou ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/40"
              )}
            >
              <div className="flex items-start gap-2.5">
                {g.acertou ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-relaxed text-navy-700">
                    {i + 1}. {q?.enunciado ?? "Questão"}
                  </p>

                  {!g.acertou && (
                    <div className="mt-2.5 space-y-1 text-xs">
                      <p className="text-red-700">
                        <strong>Você marcou {String(g.marcada ?? "—").toUpperCase()}:</strong>{" "}
                        {alternativa(g.marcada)}
                      </p>
                      <p className="text-emerald-700">
                        <strong>Correta é {g.correta.toUpperCase()}:</strong>{" "}
                        {alternativa(g.correta)}
                      </p>
                    </div>
                  )}

                  {g.explicacao && (
                    <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-white/70 p-3 text-xs leading-relaxed text-ink">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-gold-500" />
                      <span>{g.explicacao}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
