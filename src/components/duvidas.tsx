"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Bot, Check, CheckCircle2, Loader2, MessageSquare, Send,
  Sparkles, ThumbsUp, Trash2, Users,
} from "lucide-react";
import { Avatar, Badge, Button, cn } from "@/components/ui";
import { TextoRico } from "@/components/texto-rico";
import {
  alternarVoto, apagarDuvida, carregarDuvidas, marcarMelhorResposta,
  perguntarParaIA, publicarDuvida, responderDuvida, type Duvida,
} from "@/lib/repo-duvidas";

/* ==========================================================================
   DÚVIDAS DA AULA

   Duas vias, porque são dúvidas de natureza diferente:

   · Com a IA  — resposta na hora, particular. É onde cabe a pergunta básica,
                 aquela que a pessoa não faria na frente da turma. Ninguém mais
                 vê: a policy de RLS só devolve para o autor.

   · No fórum  — pergunta aberta, respondida por instrutor e colegas. Demora
                 mais e vale mais: fica no histórico da aula para quem vier
                 depois, e é onde aparece o caso real que ninguém previu.
   ========================================================================== */

interface Contexto {
  aulaTitulo: string;
  aulaDescricao?: string;
  cursoTitulo: string;
  moduloTitulo: string;
  nivel?: string;
  categoria?: string;
}

export function Duvidas({ aulaId, contexto }: { aulaId: string; contexto: Contexto }) {
  const [aba, setAba] = useState<"ia" | "forum">("ia");
  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setDuvidas(await carregarDuvidas(aulaId));
    setCarregando(false);
  }, [aulaId]);

  useEffect(() => {
    setCarregando(true);
    void recarregar();
  }, [recarregar]);

  // `.minha` além do tipo: a policy já garante isso no banco, mas a interface
  // não deve depender de uma única camada para uma decisão de privacidade.
  const daIA = duvidas.filter((d) => d.tipo === "ia" && d.minha);
  const doForum = duvidas.filter((d) => d.tipo === "forum");
  const semResposta = doForum.filter((d) => d.respostas.length === 0).length;

  return (
    <div>
      {/* ------------------------------------------------------------ abas
          "Tirar dúvida com IA" e "Fórum da turma" divididos em duas metades de
          um cartão de celular viravam "Tirar dúvi…" e "Fórum da t…". A barra
          rola de lado e cada aba fica com o rótulo inteiro. */}
      <div className="fileira flex gap-1 overflow-x-auto rounded-xl bg-cream p-1">
        <BotaoAba
          ativo={aba === "ia"}
          onClick={() => setAba("ia")}
          icone={<Sparkles size={14} />}
          rotulo="Tirar dúvida com IA"
          contador={daIA.length || undefined}
        />
        <BotaoAba
          ativo={aba === "forum"}
          onClick={() => setAba("forum")}
          icone={<Users size={14} />}
          rotulo="Fórum da turma"
          contador={doForum.length || undefined}
          alerta={semResposta > 0}
        />
      </div>

      <div className="mt-5">
        {aba === "ia" ? (
          <AbaIA
            aulaId={aulaId}
            contexto={contexto}
            historico={daIA}
            aoMudar={recarregar}
            carregando={carregando}
          />
        ) : (
          <AbaForum
            aulaId={aulaId}
            duvidas={doForum}
            aoMudar={recarregar}
            carregando={carregando}
          />
        )}
      </div>
    </div>
  );
}

function BotaoAba({
  ativo, onClick, icone, rotulo, contador, alerta,
}: {
  ativo: boolean; onClick: () => void; icone: React.ReactNode;
  rotulo: string; contador?: number; alerta?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition",
        ativo ? "bg-white text-navy-700 shadow-sm" : "text-muted hover:text-navy-700"
      )}
    >
      {icone}
      <span>{rotulo}</span>
      {contador !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-bold",
            alerta ? "bg-gold-400 text-navy-800" : "bg-navy-100 text-navy-600"
          )}
        >
          {contador}
        </span>
      )}
    </button>
  );
}

/* ======================================================================
   Aba 1 — IA
   ====================================================================== */
function AbaIA({
  aulaId, contexto, historico, aoMudar, carregando,
}: {
  aulaId: string; contexto: Contexto; historico: Duvida[];
  aoMudar: () => Promise<void>; carregando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");

  const sugestoes = [
    `Me explica de outro jeito o ponto principal de "${contexto.aulaTitulo}"`,
    "Qual é o erro mais comum nesse assunto na prática?",
    "Me dá um exemplo com números",
  ];

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p) return;
    setPensando(true);
    setErro("");
    const r = await perguntarParaIA(aulaId, p, contexto);
    setPensando(false);
    if (r.erro) return setErro(r.erro);
    setTexto("");
    await aoMudar();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gold-200 bg-gold-50/60 p-4">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
          <Bot size={16} className="mt-0.5 shrink-0 text-gold-600" />
          <span>
            <strong className="text-navy-700">Pergunte ao Tino sobre esta aula.</strong>{" "}
            Ele responde na hora, com o contexto de{" "}
            <em>{contexto.cursoTitulo}</em> e do que foi ensinado aqui. A conversa é{" "}
            <strong className="text-navy-700">só sua</strong> — nenhum colega vê.
          </span>
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void enviar(texto);
          }}
          placeholder="O que ficou confuso nesta aula? Escreva com suas palavras."
          className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-400/15"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {sugestoes.map((s) => (
              <button
                key={s}
                onClick={() => setTexto(s)}
                className="max-w-full truncate rounded-full border border-navy-100 px-3 py-1 text-xs text-muted transition hover:border-gold-300 hover:text-navy-700 sm:max-w-[240px]"
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={() => enviar(texto)}
            disabled={pensando || !texto.trim()}
            className="w-full sm:w-auto"
          >
            {pensando ? (
              <><Loader2 size={13} className="animate-spin" /> Pensando…</>
            ) : (
              <><Send size={13} /> Perguntar</>
            )}
          </Button>
        </div>
      </div>

      {carregando ? (
        <p className="py-6 text-center text-sm text-muted">Carregando suas perguntas…</p>
      ) : historico.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 py-8 text-center text-sm text-muted">
          Suas perguntas aparecem aqui, em ordem. Só você enxerga.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
            Suas perguntas nesta aula
          </p>
          {historico.map((d) => (
            <div key={d.id} className="rounded-xl border border-navy-100">
              <div className="flex items-start gap-3 border-b border-navy-100 bg-cream/40 px-4 py-3">
                <MessageSquare size={15} className="mt-0.5 shrink-0 text-navy-400" />
                <p className="min-w-0 flex-1 text-sm font-semibold text-navy-700">{d.pergunta}</p>
                <button
                  onClick={async () => { await apagarDuvida(d.id); await aoMudar(); }}
                  className="shrink-0 text-navy-200 transition hover:text-red-600"
                  title="Apagar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="gold-gradient flex h-6 w-6 items-center justify-center rounded-full text-navy-800">
                    <Bot size={13} />
                  </span>
                  <span className="text-xs font-bold text-navy-700">Tino</span>
                  {d.fonteIA === "reserva" && <Badge tone="muted">IA não conectada</Badge>}
                </div>
                <TextoRico texto={d.respostaIA ?? ""} className="text-ink" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted">
        O Tino ajuda a entender, não assina parecer. Caso concreto da sua empresa —
        número, contrato, autuação — fale com a equipe da Castelo Branco.
      </p>
    </div>
  );
}

/* ======================================================================
   Aba 2 — fórum
   ====================================================================== */
function AbaForum({
  aulaId, duvidas, aoMudar, carregando,
}: {
  aulaId: string; duvidas: Duvida[]; aoMudar: () => Promise<void>; carregando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");

  async function publicar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro("");
    const r = await publicarDuvida(aulaId, texto.trim());
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível publicar.");
    setTexto("");
    await aoMudar();
  }

  async function responder(duvidaId: string) {
    if (!resposta.trim()) return;
    const r = await responderDuvida(duvidaId, resposta.trim());
    if (!r.ok) return setErro(r.erro ?? "Não foi possível responder.");
    setResposta("");
    setRespondendo(null);
    await aoMudar();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-navy-100 bg-cream/40 p-4">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
          <Users size={16} className="mt-0.5 shrink-0 text-navy-500" />
          <span>
            <strong className="text-navy-700">Pergunte para a turma e para o instrutor.</strong>{" "}
            Demora mais que a IA e vale mais: a resposta fica no histórico da aula,
            e quem já passou pelo problema costuma trazer o caso real.
          </span>
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva a dúvida com o contexto: regime da empresa, o que você tentou e onde travou. Pergunta com contexto recebe resposta melhor."
          className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-400/15"
        />
        <div className="mt-2 flex flex-wrap justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={publicar}
            disabled={enviando || !texto.trim()}
            className="w-full sm:w-auto"
          >
            {enviando ? "Publicando…" : "Publicar no fórum"}
          </Button>
        </div>
      </div>

      {carregando ? (
        <p className="py-6 text-center text-sm text-muted">Carregando o fórum…</p>
      ) : duvidas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 py-8 text-center text-sm text-muted">
          Ninguém perguntou nada nesta aula ainda. Seja o primeiro — a sua dúvida
          provavelmente é a de mais gente.
        </p>
      ) : (
        <div className="space-y-4">
          {duvidas.map((d) => (
            <div key={d.id} className="rounded-xl border border-navy-100">
              <div className="flex items-start gap-3 p-4">
                <Avatar nome={d.autorNome} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-navy-700">{d.autorNome}</span>
                    {d.autorCargo && <span className="text-xs text-muted">{d.autorCargo}</span>}
                    {d.resolvida && (
                      <Badge tone="green"><CheckCircle2 size={10} /> Resolvida</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{d.pergunta}</p>
                  <p className="mt-2 text-[11px] text-muted">{quando(d.criadoEm)}</p>
                </div>
                {d.minha && (
                  <button
                    onClick={async () => { await apagarDuvida(d.id); await aoMudar(); }}
                    className="shrink-0 text-navy-200 transition hover:text-red-600"
                    title="Apagar"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {d.respostas.length > 0 && (
                <div className="space-y-3 border-t border-navy-100 bg-cream/30 p-4">
                  {d.respostas.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-lg p-3.5",
                        r.melhor ? "border border-emerald-200 bg-emerald-50/70" : "bg-white"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar nome={r.autorNome} size={26} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-navy-700">{r.autorNome}</span>
                            {r.autorRole === "admin" && <Badge tone="gold">Instrutor</Badge>}
                            {r.melhor && (
                              <Badge tone="green"><Check size={10} /> Melhor resposta</Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.conteudo}</p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <button
                              onClick={async () => { await alternarVoto(r.id, !r.votei); await aoMudar(); }}
                              className={cn(
                                "inline-flex items-center gap-1.5 text-[11px] font-semibold transition",
                                r.votei ? "text-gold-600" : "text-muted hover:text-navy-700"
                              )}
                            >
                              <ThumbsUp size={12} /> {r.votos > 0 ? r.votos : "Útil"}
                            </button>
                            {d.minha && !r.melhor && (
                              <button
                                onClick={async () => { await marcarMelhorResposta(d.id, r.id); await aoMudar(); }}
                                className="text-[11px] font-semibold text-muted transition hover:text-emerald-700"
                              >
                                Marcar como melhor resposta
                              </button>
                            )}
                            <span className="text-[11px] text-muted">{quando(r.criadoEm)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-navy-100 px-4 py-3">
                {respondendo === d.id ? (
                  <div>
                    <textarea
                      rows={2}
                      autoFocus
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      placeholder="Sua resposta"
                      className="w-full rounded-lg border border-navy-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-400"
                    />
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => { setRespondendo(null); setResposta(""); }}
                        className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-navy-700 sm:min-w-0 sm:flex-none"
                      >
                        Cancelar
                      </button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => responder(d.id)}
                        disabled={!resposta.trim()}
                        className="min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none"
                      >
                        Responder
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRespondendo(d.id)}
                    className="text-xs font-semibold text-gold-600 transition hover:text-gold-500"
                  >
                    Responder
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
