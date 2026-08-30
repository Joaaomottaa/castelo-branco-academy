"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, BarChart3, BookMarked, Bot, Calculator, Check,
  CheckCircle2, Flag, Heart, Lightbulb, Loader2, Lock, MessageSquare, PenLine,
  PlayCircle, Plus, Send, Sparkles, Trash2, X, XCircle,
} from "lucide-react";
import { Badge, Button, Card, cn, inputCls } from "@/components/ui";
import { Barras, Rosca } from "@/components/graficos";
import { PainelFerramentas } from "@/components/ferramentas-questao";
import { Modal } from "@/components/modal";
import { useSession } from "@/lib/session";
import {
  MOTIVOS_REPORTE, alternarCurtidaComentario, apagarComentarioQuestao,
  aulasDaQuestao, cadernosDaQuestao, comentarQuestao, comentariosDaQuestao,
  estatisticasQuestao, minhaAnotacao, removerDoCaderno, reportarQuestao,
  salvarAnotacao,
  type AulaDaQuestao, type ComentarioQuestao, type EstatisticaQuestao,
} from "@/lib/repo-questoes";
import {
  duvidasDaQuestao, perguntarSobreQuestao, statusDuvidaIAQuestao,
  type DuvidaDaQuestao, type StatusDuvidaIA,
} from "@/lib/repo-duvidas";
import type { Caderno, QuestaoBanco } from "@/lib/types";

/* ==========================================================================
   A QUESTÃO COMPLETA

   Antes a busca devolvia o enunciado cortado em duas linhas e a pessoa tinha
   de entrar num "modo" para responder. Agora a questão é a própria tela: lê,
   responde ali, e o que vem depois — gabarito, estatística, aulas,
   comentário, anotação — abre em abas embaixo. As ferramentas de cálculo
   ficam na mesma barra, mas abertas desde o início: são o papel e a
   calculadora que existiriam em cima da mesa.

   Quatro abas só abrem depois de responder: gabarito, estatística,
   comentários e a dúvida com a IA. Não é burocracia: a distribuição das marcações entrega a
   resposta certa, e o comentário do colega entrega ainda mais rápido. Quem lê
   antes não estudou, só conferiu.
   ========================================================================== */

type Aba =
  | "gabarito" | "estatisticas" | "aulas" | "ferramentas" | "comentarios"
  | "duvida" | "cadernos" | "anotacao";

const LETRA = (id: string) => id.toUpperCase();

export function QuestaoCard({
  questao,
  numero,
  marcada,
  respondida,
  bloqueado,
  pago,
  jaRespondida,
  cadernos,
  podeCriarCaderno,
  aoResponder,
  aoCriarCaderno,
  aoVincular,
}: {
  questao: QuestaoBanco;
  numero: number;
  /** Alternativa já marcada, quando a pessoa respondeu nesta sessão. */
  marcada?: string;
  respondida: boolean;
  bloqueado?: boolean;
  pago: boolean;
  /** Já respondeu esta questão em alguma sessão anterior. */
  jaRespondida?: boolean;
  cadernos: Caderno[];
  podeCriarCaderno: boolean;
  aoResponder: (alternativa: string) => void | Promise<void>;
  aoCriarCaderno: (nome: string) => Promise<string | null>;
  aoVincular: (cadernoId: string, questaoId: string) => Promise<void>;
}) {
  const { modoDemo } = useSession();
  const [escolha, setEscolha] = useState<string | undefined>(marcada);
  const [enviando, setEnviando] = useState(false);
  const [aba, setAba] = useState<Aba | null>(null);
  const [reportar, setReportar] = useState(false);

  const acertou = respondida && escolha === questao.correta;

  // Quem já respondeu numa sessão anterior não precisa gastar a resposta de
  // novo para rever o gabarito: a trava existe para não entregar a resposta
  // antes da primeira tentativa, não para punir quem volta para revisar.
  const liberado = respondida || Boolean(jaRespondida);

  useEffect(() => {
    if (marcada) setEscolha(marcada);
  }, [marcada]);

  async function responder() {
    if (!escolha || respondida || bloqueado) return;
    setEnviando(true);
    await aoResponder(escolha);
    setEnviando(false);
    setAba("gabarito");
  }

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-navy-100 bg-cream/50 px-5 py-3">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-navy-700 px-1.5 text-[11px] font-bold text-white">
          {numero}
        </span>
        <Badge tone="navy">{questao.area}</Badge>
        <Badge tone="muted">{questao.assunto}</Badge>
        <Badge tone={questao.nivel === "Avançado" ? "gold" : "muted"}>{questao.nivel}</Badge>
        {questao.prova ? (
          <Badge tone="teal">{questao.prova}</Badge>
        ) : (
          questao.banca && (
            <Badge tone="teal">
              {questao.banca}
              {questao.ano ? ` ${questao.ano}` : ""}
            </Badge>
          )
        )}

        {respondida ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
              acertou ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {acertou ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {acertou ? "Você acertou" : "Você errou"}
          </span>
        ) : (
          /* Discreto de propósito: avisa que já passou por aqui sem entregar
             se acertou — senão a segunda tentativa vira consulta ao histórico. */
          jaRespondida && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <CheckCircle2 size={12} className="text-navy-300" />
              Você já respondeu essa pergunta
            </span>
          )
        )}
      </div>

      {/* Enunciado e alternativas */}
      <div className="p-5">
        <p className="text-[15px] leading-relaxed text-ink">{questao.enunciado}</p>

        <div className="mt-5 space-y-2">
          {questao.alternativas.map((alt) => {
            const escolhida = escolha === alt.id;
            const eCorreta = alt.id === questao.correta;
            const mostrarGabarito = respondida;

            return (
              <button
                key={alt.id}
                onClick={() => !respondida && setEscolha(alt.id)}
                disabled={respondida}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition",
                  mostrarGabarito && eCorreta
                    ? "border-emerald-300 bg-emerald-50"
                    : mostrarGabarito && escolhida
                      ? "border-red-300 bg-red-50"
                      : escolhida
                        ? "border-gold-400 bg-gold-50 ring-1 ring-gold-300"
                        : "border-navy-100 hover:border-navy-200 hover:bg-cream/50",
                  respondida && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    mostrarGabarito && eCorreta
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : mostrarGabarito && escolhida
                        ? "border-red-500 bg-red-500 text-white"
                        : escolhida
                          ? "border-gold-400 bg-gold-400 text-navy-800"
                          : "border-gold-300 text-gold-500"
                  )}
                >
                  {LETRA(alt.id)}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-ink">
                  {alt.texto}
                </span>
              </button>
            );
          })}
        </div>

        {!respondida && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="gold"
              onClick={responder}
              disabled={!escolha || enviando || bloqueado}
            >
              {enviando ? "Enviando…" : bloqueado ? "Limite diário atingido" : "Responder"}
            </Button>
            {escolha && !bloqueado && (
              <button
                onClick={() => setEscolha(undefined)}
                className="text-xs font-semibold text-muted transition hover:text-navy-700"
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}

        {/* O botão diz que acabou; esta linha diz o que fazer. Sem ela, o
            "Limite diário atingido" é só uma porta fechada. */}
        {!respondida && bloqueado && (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-600/90">
            <Lock size={12} className="shrink-0" />
            Sua cota volta amanhã de manhã.
            <Link
              href="/app/planos"
              className="font-bold text-navy-700 underline underline-offset-2 hover:text-gold-600"
            >
              No Pro são ilimitadas
            </Link>
            — e o gabarito das que você já respondeu continua liberado.
          </p>
        )}
      </div>

      {/* Barra de recursos */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-navy-100 px-3 py-2">
        <ItemBarra
          icone={<Lightbulb size={14} />}
          rotulo="Gabarito comentado"
          ativo={aba === "gabarito"}
          travado={!liberado}
          onClick={() => setAba(aba === "gabarito" ? null : "gabarito")}
        />
        <ItemBarra
          icone={<PlayCircle size={14} />}
          rotulo="Aulas"
          ativo={aba === "aulas"}
          onClick={() => setAba(aba === "aulas" ? null : "aulas")}
        />
        {/* Aberta antes de responder, de propósito: calculadora e tabela não
            entregam o gabarito — são o que a pessoa teria na mesa numa prova
            de verdade. Travar isso só empurraria para outra aba do navegador. */}
        <ItemBarra
          icone={<Calculator size={14} />}
          rotulo="Ferramentas"
          ativo={aba === "ferramentas"}
          onClick={() => setAba(aba === "ferramentas" ? null : "ferramentas")}
        />
        <ItemBarra
          icone={<MessageSquare size={14} />}
          rotulo="Comentários"
          ativo={aba === "comentarios"}
          travado={!liberado}
          onClick={() => setAba(aba === "comentarios" ? null : "comentarios")}
        />
        {/* O comentário é a turma; isto é o instrutor. São dúvidas de natureza
            diferente e as duas cabem — a mesma divisão que existe dentro da
            aula, entre "Dúvidas com IA" e o fórum. */}
        <ItemBarra
          icone={<Bot size={14} />}
          rotulo="Tirar dúvida com IA"
          destaque
          ativo={aba === "duvida"}
          travado={!liberado}
          onClick={() => setAba(aba === "duvida" ? null : "duvida")}
        />
        <ItemBarra
          icone={<BarChart3 size={14} />}
          rotulo="Estatísticas"
          ativo={aba === "estatisticas"}
          travado={!liberado}
          onClick={() => setAba(aba === "estatisticas" ? null : "estatisticas")}
        />
        <ItemBarra
          icone={<BookMarked size={14} />}
          rotulo="Cadernos"
          ativo={aba === "cadernos"}
          onClick={() => setAba(aba === "cadernos" ? null : "cadernos")}
        />
        <ItemBarra
          icone={<PenLine size={14} />}
          rotulo="Anotações"
          ativo={aba === "anotacao"}
          onClick={() => setAba(aba === "anotacao" ? null : "anotacao")}
        />
        <ItemBarra
          icone={<Flag size={14} />}
          rotulo="Notificar erro"
          onClick={() => setReportar(true)}
        />
      </div>

      {/* Painel da aba */}
      {aba && (
        <div className="border-t border-navy-100 bg-cream/40 p-5">
          {aba === "gabarito" && <PainelGabarito questao={questao} acertou={acertou} escolha={escolha} />}
          {aba === "estatisticas" && <PainelEstatisticas questao={questao} />}
          {aba === "aulas" && <PainelAulas questaoId={questao.id} assunto={questao.assunto} />}
          {aba === "ferramentas" && <PainelFerramentas questao={questao} />}
          {aba === "comentarios" && <PainelComentarios questaoId={questao.id} modoDemo={modoDemo} />}
          {aba === "duvida" && (
            <PainelDuvidaIA
              questao={questao}
              marcada={escolha}
              modoDemo={modoDemo}
            />
          )}
          {aba === "cadernos" && (
            <PainelCadernos
              questaoId={questao.id}
              cadernos={cadernos}
              podeCriar={podeCriarCaderno}
              modoDemo={modoDemo}
              aoCriar={aoCriarCaderno}
              aoVincular={aoVincular}
            />
          )}
          {aba === "anotacao" && <PainelAnotacao questaoId={questao.id} modoDemo={modoDemo} />}
        </div>
      )}

      {reportar && (
        <ModalReporte
          questao={questao}
          modoDemo={modoDemo}
          aoFechar={() => setReportar(false)}
        />
      )}

      {!pago && !respondida && (
        <p className="border-t border-navy-100 bg-gold-50 px-5 py-2 text-[11px] text-gold-600">
          Plano gratuito: o Tino explica cada erro em detalhe no Pro.
        </p>
      )}
    </Card>
  );
}

/* ==================================================================== IA ===
   TIRAR DÚVIDA COM A IA

   O gabarito comentado explica a questão; isto explica o erro. A diferença é
   o que a pessoa pergunta depois de ler o comentário e continuar sem entender
   por que a alternativa dela não servia.

   No plano gratuito é uma por dia. O número é pequeno de propósito: uma basta
   para a pessoa sentir a diferença, e é aí que o Pro passa a fazer sentido.
   O teto real está em `status_duvida_ia_questao()`, no banco — aqui é só o que
   se mostra.
   ========================================================================== */
function PainelDuvidaIA({
  questao, marcada, modoDemo,
}: {
  questao: QuestaoBanco;
  marcada?: string;
  modoDemo: boolean;
}) {
  const { user } = useSession();
  const [status, setStatus] = useState<StatusDuvidaIA | null>(null);
  const [historico, setHistorico] = useState<DuvidaDaQuestao[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (modoDemo) {
      setStatus({ usadasHoje: 0, limite: 1, pode: true });
      return;
    }
    let ativo = true;
    void Promise.all([statusDuvidaIAQuestao(), duvidasDaQuestao(questao.id)]).then(
      ([st, h]) => {
        if (!ativo) return;
        setStatus(st);
        setHistorico(h);
      }
    );
    return () => { ativo = false; };
  }, [questao.id, modoDemo]);

  const errou = Boolean(marcada) && marcada !== questao.correta;

  const atalhos = errou
    ? [
        "Por que a alternativa que marquei está errada?",
        "Como eu identifico essa pegadinha na prova?",
        "Me dá um exemplo prático dessa regra.",
      ]
    : [
        "Tem alguma exceção a essa regra?",
        "Como esse tema costuma cair em prova?",
        "Me dá um exemplo prático dessa regra.",
      ];

  async function perguntar(texto?: string) {
    const conteudo = (texto ?? pergunta).trim();
    if (!conteudo || pensando) return;

    if (modoDemo) {
      setErro("No modo demonstração o Tino não responde. Troque a chave para Supabase.");
      return;
    }

    setErro("");
    setPensando(true);
    const r = await perguntarSobreQuestao(questao.id, conteudo, {
      enunciado: questao.enunciado,
      alternativas: questao.alternativas,
      correta: questao.correta,
      marcada,
      explicacao: questao.explicacao,
      area: questao.area,
      assunto: questao.assunto,
      nivel: questao.nivel,
      banca: questao.banca,
      nome: user?.nome,
    });
    setPensando(false);

    if (r.erro === "limite") {
      setStatus((st) => (st ? { ...st, pode: false } : st));
      return;
    }
    if (r.erro) return setErro(r.erro);

    setPergunta("");
    setHistorico((h) => [
      ...h,
      {
        id: `novo-${Date.now()}`,
        pergunta: conteudo,
        resposta: r.resposta ?? "",
        criadoEm: new Date().toISOString(),
      },
    ]);
    setStatus((st) => (st ? { ...st, usadasHoje: st.usadasHoje + 1 } : st));
  }

  if (!status) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </p>
    );
  }

  const bloqueado = !status.pode && historico.length >= 0 && !pensando;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-gold-300">
            <Bot size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-navy-700">Tirar dúvida com o Tino</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {errou
                ? "Ele já sabe qual alternativa você marcou e explica onde o raciocínio virou."
                : "Pergunte sobre a regra, a exceção ou como o tema cai em prova."}
            </p>
          </div>
        </div>
        {status.limite !== null && (
          <Badge tone={status.pode ? "muted" : "gold"}>
            {status.usadasHoje}/{status.limite} hoje
          </Badge>
        )}
      </div>

      {/* Conversa */}
      {historico.map((d) => (
        <div key={d.id} className="space-y-2.5">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-700 px-4 py-2.5 text-sm text-white">
              {d.pergunta}
            </p>
          </div>
          <div className="rounded-2xl rounded-bl-md border border-navy-100 bg-white p-4">
            <TextoDaIA texto={d.resposta} />
          </div>
        </div>
      ))}

      {pensando && (
        <div className="flex items-center gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-3">
          <Loader2 size={14} className="animate-spin text-gold-500" />
          <span className="text-xs text-muted">O Tino está analisando a questão…</span>
        </div>
      )}

      {bloqueado ? (
        <LimiteIA usadas={status.usadasHoje} limite={status.limite ?? 1} />
      ) : (
        <>
          {historico.length === 0 && !pensando && (
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <button
                  key={a}
                  onClick={() => void perguntar(a)}
                  className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600"
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white p-1.5 pl-4 transition focus-within:border-gold-400">
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void perguntar()}
              placeholder="Escreva a sua dúvida sobre esta questão…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            <button
              onClick={() => void perguntar()}
              disabled={!pergunta.trim() || pensando}
              aria-label="Perguntar ao Tino"
              className="gold-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-navy-800 transition hover:brightness-105 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        </>
      )}

      {erro && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}

/**
 * O aviso de limite.
 *
 * Ele aparece no lugar do campo de pergunta, não como pop-up: interromper
 * quem está estudando para vender é o jeito mais rápido de a pessoa fechar a
 * tela. Aqui a oferta espera no lugar onde a ação aconteceria.
 */
function LimiteIA({ usadas, limite }: { usadas: number; limite: number }) {
  return (
    <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/25 text-gold-600">
          <Lock size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-navy-700">
            {usadas >= limite
              ? "Você já usou a sua dúvida de hoje"
              : "Dúvida com IA é do plano Pro"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gold-600/90">
            No plano gratuito é {limite === 1 ? "uma dúvida" : `${limite} dúvidas`} por dia.
            Volte amanhã — ou passe para o <strong className="text-navy-700">Pro</strong> e
            pergunte quantas vezes precisar, em qualquer questão.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button href="/app/planos" variant="gold" size="sm">
              <Sparkles size={13} /> Ver o Pro <ArrowRight size={13} />
            </Button>
            <span className="text-[11px] text-gold-600/80">
              O gabarito comentado continua liberado.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Markdown curtinho: negrito e parágrafo. É tudo que a resposta usa. */
function TextoDaIA({ texto }: { texto: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      {texto.split("\n").filter((l) => l.trim()).map((linha, i) => (
        <p key={i}>
          {linha.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return <strong key={j} className="text-navy-700">{parte.slice(2, -2)}</strong>;
            }
            if (parte.startsWith("_") && parte.endsWith("_") && parte.length > 2) {
              return <em key={j} className="text-muted">{parte.slice(1, -1)}</em>;
            }
            return <span key={j}>{parte}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- barra --- */
function ItemBarra({
  icone, rotulo, ativo, travado, destaque, onClick,
}: {
  icone: React.ReactNode;
  rotulo: string;
  ativo?: boolean;
  travado?: boolean;
  /** Dourado quando inativo: é a ação que a gente quer que seja notada. */
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={travado ? undefined : onClick}
      disabled={travado}
      title={travado ? "Disponível depois de responder" : rotulo}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
        ativo
          ? "bg-navy-700 text-white"
          : travado
            ? "cursor-not-allowed text-navy-200"
            : destaque
              ? "text-gold-600 hover:bg-gold-50"
              : "text-muted hover:bg-navy-50 hover:text-navy-700"
      )}
    >
      {icone} <span className="hidden sm:inline">{rotulo}</span>
    </button>
  );
}

/* ------------------------------------------------------------ gabarito --- */
function PainelGabarito({
  questao, acertou, escolha,
}: {
  questao: QuestaoBanco; acertou: boolean; escolha?: string;
}) {
  const correta = questao.alternativas.find((a) => a.id === questao.correta);
  const marcada = questao.alternativas.find((a) => a.id === escolha);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-emerald-700">
        Gabarito: {LETRA(questao.correta)} — {correta?.texto}
      </p>

      {!acertou && marcada && (
        <p className="text-sm text-red-700">
          Você marcou {LETRA(marcada.id)} — {marcada.texto}
        </p>
      )}

      {questao.explicacao ? (
        <p className="flex items-start gap-2.5 rounded-xl bg-white p-4 text-sm leading-relaxed text-ink">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-gold-500" />
          <span>{questao.explicacao}</span>
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-navy-200 bg-white p-4 text-sm text-muted">
          Esta questão ainda não tem comentário do professor. Use o botão
          &ldquo;Notificar erro&rdquo; se algo aqui não fizer sentido.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------- estatísticas --- */
const VERDE = "#2F9E68";
const VERMELHO = "#C4543F";
const AZUL = "#7f9bbb";

function PainelEstatisticas({ questao }: { questao: QuestaoBanco }) {
  const [dados, setDados] = useState<EstatisticaQuestao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void estatisticasQuestao(questao.id).then((d) => {
      if (!vivo) return;
      setDados(d);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [questao.id]);

  if (carregando) {
    return <p className="text-sm text-muted">Carregando estatísticas…</p>;
  }
  if (!dados || dados.respostas === 0) {
    return (
      <p className="text-sm text-muted">
        Você é a primeira pessoa a responder esta questão. A estatística aparece
        quando a turma passar por aqui.
      </p>
    );
  }

  const erros = dados.respostas - dados.acertos;
  const marcadas = questao.alternativas.map(
    (a) => dados.distribuicao.find((d) => d.alternativa === a.id)?.total ?? 0
  );

  // Cor com significado, não decoração: verde é o gabarito, vermelho é onde
  // você caiu, azul é o resto. Barra colorida ao acaso não informa nada.
  const cores = questao.alternativas.map((a) =>
    a.id === questao.correta
      ? VERDE
      : dados.minha?.alternativa === a.id
        ? VERMELHO
        : AZUL
  );

  const maisMarcada = [...dados.distribuicao].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-navy-600">
            Percentual de rendimento
          </p>
          <Rosca
            fatias={[
              { rotulo: "Acertos", valor: dados.acertos, cor: VERDE },
              { rotulo: "Erros", valor: erros, cor: VERMELHO },
            ]}
            tamanho={148}
          />
        </div>

        <div className="rounded-xl bg-white p-4">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-navy-600">
            Alternativas mais respondidas
          </p>
          <Barras
            rotulos={questao.alternativas.map((a) => LETRA(a.id))}
            valores={marcadas}
            cores={cores}
            altura={170}
            formatar={(v) => String(v)}
          />
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: VERDE }} /> gabarito
            </span>
            {dados.minha && dados.minha.alternativa !== questao.correta && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: VERMELHO }} /> sua
                marcação
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: AZUL }} /> demais
            </span>
          </p>
        </div>
      </div>

      {/* Histórico das minhas tentativas */}
      {dados.minhas.length > 0 && (
        <div className="space-y-2">
          {dados.minhas.map((m, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3"
            >
              <span className="text-sm text-ink">
                Em <strong className="font-semibold text-navy-700">{dataHora(m.em)}</strong>, você
                respondeu a opção {LETRA(m.alternativa)}.
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold",
                  m.correta ? "text-emerald-600" : "text-red-600"
                )}
              >
                {m.correta ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                {m.correta ? "Você acertou!" : "Incorreta"}
              </span>
            </div>
          ))}
        </div>
      )}

      {maisMarcada.alternativa !== questao.correta && (
        <p className="flex items-start gap-2 rounded-xl bg-white p-3.5 text-xs leading-relaxed text-ink">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-gold-500" />
          A alternativa mais marcada pela turma ({LETRA(maisMarcada.alternativa)}) não é o
          gabarito. Se você caiu nela, o erro é o mais comum — vale reler a explicação
          com calma.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- aulas -- */
const ROTULO_ORIGEM: Record<string, string> = {
  vinculo: "Aula do curso ligado a esta questão",
  selo: "Curso que concede o selo deste assunto",
  assunto: "Curso que trata deste assunto",
  area: "Curso da mesma área",
};

function PainelAulas({ questaoId, assunto }: { questaoId: string; assunto: string }) {
  const [aulas, setAulas] = useState<AulaDaQuestao[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void aulasDaQuestao(questaoId).then((a) => vivo && setAulas(a));
    return () => {
      vivo = false;
    };
  }, [questaoId]);

  if (!aulas) return <p className="text-sm text-muted">Procurando as aulas…</p>;

  if (aulas.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Ainda não há curso publicado que cubra <strong className="text-navy-700">{assunto}</strong>.
        Quando houver, as aulas aparecem aqui automaticamente.
      </p>
    );
  }

  const porOrigem = aulas[0].origem;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {ROTULO_ORIGEM[porOrigem] ?? "Aulas relacionadas"}
        {aulas[0].habilidade && (
          <span className="ml-1.5 normal-case tracking-normal text-gold-600">
            · selo {aulas[0].habilidade}
          </span>
        )}
      </p>

      <div className="space-y-2">
        {aulas.map((a) => (
          <Link
            key={a.aulaId}
            href={`/app/cursos/${a.cursoSlug}/aula/${a.aulaId}`}
            className="flex items-center gap-3 rounded-xl bg-white p-3 transition hover:ring-1 hover:ring-gold-300"
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: a.cursoCor }}
            >
              <PlayCircle size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-navy-700">
                {a.aulaTitulo}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {a.cursoTitulo} · {a.modulo} · {a.duracaoMin} min
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- comentários -- */
function PainelComentarios({
  questaoId, modoDemo,
}: {
  questaoId: string; modoDemo: boolean;
}) {
  const [lista, setLista] = useState<ComentarioQuestao[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLista(await comentariosDaQuestao(questaoId));
  }, [questaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const r = await comentarQuestao(questaoId, texto);
    setEnviando(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setTexto("");
    void carregar();
  }

  async function curtir(c: ComentarioQuestao) {
    setLista((l) =>
      (l ?? []).map((x) =>
        x.id === c.id
          ? { ...x, curti: !x.curti, curtidas: x.curtidas + (x.curti ? -1 : 1) }
          : x
      )
    );
    await alternarCurtidaComentario(c.id, !c.curti);
  }

  async function apagar(id: string) {
    setLista((l) => (l ?? []).filter((x) => x.id !== id));
    await apagarComentarioQuestao(id);
  }

  return (
    <div className="space-y-4">
      {modoDemo && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-xs text-gold-600">
          No modo demonstração os comentários não são gravados — eles dependem do banco.
        </p>
      )}

      {lista === null ? (
        <p className="text-sm text-muted">Carregando comentários…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted">
          Ninguém comentou esta questão ainda. Se você entendeu o pulo do gato,
          escreva — é o comentário que salva quem cair aqui depois.
        </p>
      ) : (
        <div className="space-y-2.5">
          {lista.map((c) => (
            <div key={c.id} className="rounded-xl bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-navy-700">{c.autorNome}</span>
                {c.autorCargo && (
                  <span className="text-[11px] text-muted">{c.autorCargo}</span>
                )}
                <span className="text-[11px] text-muted">· {quando(c.criadoEm)}</span>
                {c.meu && (
                  <button
                    onClick={() => apagar(c.id)}
                    title="Apagar comentário"
                    className="ml-auto text-muted transition hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
                {c.conteudo}
              </p>
              <button
                onClick={() => curtir(c)}
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition",
                  c.curti ? "text-gold-600" : "text-muted hover:text-navy-700"
                )}
              >
                <Heart size={13} className={c.curti ? "fill-gold-400 text-gold-400" : ""} />
                {c.curtidas > 0 ? c.curtidas : "Útil"}
              </button>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Explique o raciocínio para quem vier depois…"
          className={cn(inputCls, "min-w-56 flex-1 bg-white")}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={enviar}
          disabled={enviando || !texto.trim() || modoDemo}
        >
          <Send size={14} /> {enviando ? "Enviando…" : "Comentar"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ cadernos --- */
/**
 * Caderno é a lista de questões que a pessoa quer rever antes da prova.
 *
 * O botão abria um modal por cima da questão; agora é aba, no mesmo lugar das
 * outras — e mostra em quais cadernos a questão já está, porque o erro mais
 * comum aqui é salvar duas vezes sem perceber.
 */
function PainelCadernos({
  questaoId, cadernos, podeCriar, modoDemo, aoCriar, aoVincular,
}: {
  questaoId: string;
  cadernos: Caderno[];
  podeCriar: boolean;
  modoDemo: boolean;
  aoCriar: (nome: string) => Promise<string | null>;
  aoVincular: (cadernoId: string, questaoId: string) => Promise<void>;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [escolhido, setEscolhido] = useState("");
  const [dentro, setDentro] = useState<string[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { user } = useSession();

  const carregar = useCallback(async () => {
    if (!user?.id || modoDemo) {
      setDentro([]);
      return;
    }
    setDentro(await cadernosDaQuestao(user.id, questaoId));
  }, [user?.id, questaoId, modoDemo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!nome.trim()) return;
    setOcupado(true);
    setErro(null);
    const id = await aoCriar(nome.trim());
    setOcupado(false);
    if (!id) {
      setErro("Não foi possível criar o caderno.");
      return;
    }
    setNome("");
    setCriando(false);
    setEscolhido(id);
  }

  async function salvar() {
    if (!escolhido) return;
    setOcupado(true);
    setErro(null);
    await aoVincular(escolhido, questaoId);
    setOcupado(false);
    void carregar();
  }

  async function tirar(cadernoId: string) {
    setDentro((d) => (d ?? []).filter((x) => x !== cadernoId));
    await removerDoCaderno(cadernoId, questaoId);
  }

  const jaSalva = dentro ?? [];
  const disponiveis = cadernos.filter((c) => !jaSalva.includes(c.id));

  return (
    <div className="space-y-4">
      {modoDemo && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-xs text-gold-600">
          No modo demonstração os cadernos não são gravados — eles dependem do banco.
        </p>
      )}

      {jaSalva.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Esta questão já está em
          </p>
          <div className="flex flex-wrap gap-2">
            {jaSalva.map((id) => {
              const c = cadernos.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700"
                >
                  <BookMarked size={12} style={{ color: c?.cor ?? "#00204D" }} />
                  {c?.nome ?? "Caderno"}
                  <button
                    onClick={() => tirar(id)}
                    title="Tirar deste caderno"
                    className="text-muted transition hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {criando ? (
        <div className="rounded-xl bg-white p-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-navy-600">
              Nome do caderno
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Revisar antes da prova"
              className={cn(inputCls, "!py-2 text-sm")}
              autoFocus
            />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="gold" size="sm" onClick={criar} disabled={ocupado || !nome.trim()}>
              {ocupado ? "Criando…" : "Criar"}
            </Button>
            <button
              onClick={() => {
                setCriando(false);
                setNome("");
              }}
              className="text-xs font-semibold text-muted transition hover:text-navy-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCriando(true)}
          disabled={!podeCriar || modoDemo}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-semibold transition",
            podeCriar && !modoDemo
              ? "text-gold-600 hover:text-gold-500"
              : "cursor-not-allowed text-muted"
          )}
        >
          <Plus size={16} /> Criar novo caderno
        </button>
      )}

      {!podeCriar && (
        <p className="text-xs text-muted">
          O plano gratuito tem limite de cadernos. No Pro são ilimitados.
        </p>
      )}

      <div className="border-t border-navy-100 pt-4">
        {cadernos.length === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não tem cadernos. Crie o primeiro acima e vá guardando aqui as
            questões que quer rever.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink">
              Escolha o caderno para
              <br className="hidden sm:block" /> adicionar a questão
            </span>
            <select
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              className={cn(inputCls, "!w-auto !py-2 bg-white text-sm")}
            >
              <option value="">Cadernos</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.total})
                </option>
              ))}
            </select>
            <Button
              variant="gold"
              size="sm"
              onClick={salvar}
              disabled={!escolhido || ocupado || modoDemo}
            >
              {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} Salvar
            </Button>
          </div>
        )}

        {disponiveis.length === 0 && cadernos.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Esta questão já está em todos os seus cadernos.
          </p>
        )}
      </div>

      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ anotação --- */
function PainelAnotacao({
  questaoId, modoDemo,
}: {
  questaoId: string; modoDemo: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void minhaAnotacao(questaoId).then((t) => {
      if (!vivo) return;
      setTexto(t);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [questaoId]);

  async function salvar() {
    setSalvando(true);
    await salvarAnotacao(questaoId, texto);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (carregando) return <p className="text-sm text-muted">Carregando sua anotação…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        Só você vê esta anotação — nem a coordenação da Academy. É o lugar de
        escrever a regra que você confundiu, com as suas palavras.
      </p>
      <textarea
        rows={4}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        placeholder="Ex.: crédito só existe se o fornecedor recolheu — documento não basta."
        className={cn(inputCls, "bg-white")}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={salvar} disabled={salvando || modoDemo}>
          {salvando ? "Salvando…" : "Salvar anotação"}
        </Button>
        {salvo && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={13} /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- reporte --- */
function ModalReporte({
  questao, modoDemo, aoFechar,
}: {
  questao: QuestaoBanco; modoDemo: boolean; aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_REPORTE[0][0]);
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const r = await reportarQuestao(questao.id, motivo, descricao);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setEnviado(true);
  }

  return (
    <Modal
      titulo="Notificar erro na questão"
      subtitulo="O aviso vai direto para quem administra o banco de questões."
      aoFechar={aoFechar}
      largura="max-w-lg"
      rodape={
        <div className="flex justify-end gap-2">
          <button
            onClick={aoFechar}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
          >
            {enviado ? "Fechar" : "Cancelar"}
          </button>
          {!enviado && (
            <Button variant="gold" size="sm" onClick={enviar} disabled={enviando || modoDemo}>
              <Flag size={14} /> {enviando ? "Enviando…" : "Enviar aviso"}
            </Button>
          )}
        </div>
      }
    >
      {enviado ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-emerald-600">
          <CheckCircle2 size={18} /> Aviso enviado. Obrigado — isso conserta a
          questão para todo mundo.
        </p>
      ) : (
        <div className="space-y-4">
          {erro && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          <p className="rounded-xl bg-cream/70 p-3.5 text-xs leading-relaxed text-ink">
            {questao.enunciado.slice(0, 160)}
            {questao.enunciado.length > 160 ? "…" : ""}
          </p>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
              O que está errado?
            </p>
            <div className="space-y-1.5">
              {MOTIVOS_REPORTE.map(([k, label]) => (
                <label
                  key={k}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition",
                    motivo === k
                      ? "border-gold-400 bg-gold-50 text-navy-700"
                      : "border-navy-100 text-ink hover:border-navy-200"
                  )}
                >
                  <input
                    type="radio"
                    name="motivo"
                    checked={motivo === k}
                    onChange={() => setMotivo(k)}
                    className="h-4 w-4 accent-[#C89F50]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-navy-600">
              Detalhe (opcional)
            </span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que exatamente está errado? Se souber a resposta certa, diga qual."
              className={inputCls}
            />
          </label>

          {modoDemo && (
            <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-xs text-gold-600">
              No modo demonstração o aviso não é gravado.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------------- apoio --- */
/** `29/08/26 às 17:23` — o formato do histórico. */
function dataHora(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

function quando(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
