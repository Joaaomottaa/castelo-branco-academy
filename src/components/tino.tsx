"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Loader2, Minus, Send } from "lucide-react";
import { cn } from "./ui";
import { useSession } from "@/lib/session";
import { brand } from "@/lib/brand";
import { abrirTino, type ChamadaTino } from "@/lib/tino-abrir";

/* ==========================================================================
   TINO — assistente da Castelo Branco Academy
   "Ter tino" é ter bom senso prático. É o que se espera de um contador, e é o
   que o assistente deve entregar: orientação direta, sem enrolação.
   ========================================================================== */

interface Msg {
  autor: "tino" | "voce";
  texto: string;
}

/**
 * Quem já entrou pergunta sobre o próprio estudo; quem está de fora pergunta
 * sobre o produto. Oferecer as mesmas quatro frases aos dois desperdiça o
 * único lugar da tela onde dá para sugerir o próximo passo.
 */
const SUGESTOES_ALUNO = [
  "Que curso combina com o meu momento?",
  "Quero seguir a área fiscal, o que me recomenda?",
  "Como funciona o certificado PEPC?",
  "Como funciona o banco de talentos?",
];

const SUGESTOES_VISITANTE = [
  "O que eu aprendo aqui?",
  "Quanto custa o plano Pro?",
  "O certificado vale pontos no CRC?",
  "Tenho vaga garantida depois?",
];

/**
 * A abertura do Tino.
 *
 * Chamar a pessoa pelo nome muda o tom da conversa inteira — e o nome já está
 * na sessão, não custa uma consulta. Sem sessão (visitante na página pública)
 * a saudação continua a mesma de antes, sem um "Olá, undefined".
 */
function saudacao(nome?: string): Msg {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  return {
    autor: "tino",
    texto: [
      primeiro
        ? `Olá, **${primeiro}**! Sou o **Tino**, assistente da Castelo Branco Academy.`
        : "Oi! Sou o **Tino**, assistente da Castelo Branco Academy.",
      "",
      "Funciona assim: posso te ajudar a escolher um curso, montar uma trilha de carreira, tirar dúvidas sobre planos e certificados — ou te passar o contato direto da equipe.",
      "",
      "O que você precisa hoje?",
    ].join("\n"),
  };
}


/* ==========================================================================
   A MARCA DO TINO

   O botão flutuante era um balãozinho genérico — o mesmo de qualquer site.
   Agora ele carrega o leão da Castelo Branco, recortado do próprio logotipo.

   O recorte é feito em CSS em vez de um PNG novo: um segundo arquivo de
   imagem sairia de sincronia com a marca na primeira vez que ela mudasse, e
   aqui o leão é sempre o mesmo bitmap do cabeçalho.
   ========================================================================== */
function LeaoTino({ className }: { className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-full", className)}>
      {/*
        O recorte é a cabeça do leão, não o leão inteiro.

        No PNG de 369x97 o corpo vai até y=86, mas a palavra "CASTELO" começa
        em x=60 e a juba passa por baixo dela — nenhum retângulo pega o animal
        completo sem pegar letra junto. A cabeça (x 12-58, y 8-48) é o pedaço
        que fecha sozinho, e num avatar de 36px é o único que se reconhece.

        Os três números saem dessa janela: 800% = 369/46 de largura, e os
        deslocamentos põem o canto (12, 8) na origem da caixa.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logoCastelo.png"
        alt=""
        aria-hidden="true"
        className="absolute left-[-26%] top-[-11%] w-[800%] max-w-none"
      />
    </span>
  );
}

/**
 * O disco que o leão habita.
 *
 * Leão dourado sobre fundo dourado desaparece — a primeira versão deste botão
 * provou isso. Aqui o fundo é o navy mais escuro da marca, com anel dourado:
 * é o mesmo contraste do logotipo no cabeçalho do site.
 */
function MarcaTino({ className, anel = true }: { className?: string; anel?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-navy-800",
        anel && "ring-2 ring-gold-400",
        className
      )}
    >
      <LeaoTino className="h-[72%] w-[72%]" />
    </span>
  );
}

export function Tino() {
  const { user } = useSession();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([saudacao(user?.nome)]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [naoLida, setNaoLida] = useState(true);
  /** Pergunta que chegou de outra tela e precisa ser enviada assim que abrir. */
  const [pendente, setPendente] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  // O perfil chega um instante depois do primeiro render. Enquanto a conversa
  // não começou, a saudação é reescrita com o nome; depois disso, nunca — seria
  // reescrever histórico que a pessoa já leu.
  useEffect(() => {
    setMsgs((m) => (m.length === 1 ? [saudacao(user?.nome)] : m));
  }, [user?.nome]);

  useEffect(() => {
    if (aberto) {
      setNaoLida(false);
      fim.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, aberto]);

  // Qualquer tela pode chamar o Tino, com ou sem pergunta pronta:
  //   window.dispatchEvent(new CustomEvent("cba:abrir-tino", { detail: "..." }))
  // Um evento no window evita ter de içar o estado do chat para um provider
  // global só para dois botões o abrirem.
  useEffect(() => {
    function aoChamar(e: Event) {
      setAberto(true);
      const d = (e as CustomEvent<ChamadaTino | string>).detail;
      const pergunta = typeof d === "string" ? d : d?.pergunta;
      const automatico = typeof d === "object" && d !== null && d.enviar;
      if (!pergunta) return;
      if (automatico) setPendente(pergunta);
      else setTexto(pergunta);
    }
    window.addEventListener("cba:abrir-tino", aoChamar);
    return () => window.removeEventListener("cba:abrir-tino", aoChamar);
  }, []);

  // O envio sai daqui, e não do próprio listener, para usar sempre a versão
  // atual de `enviar` — dentro do listener ela ficaria congelada no primeiro
  // render, com o histórico vazio.
  useEffect(() => {
    if (!pendente) return;
    const texto = pendente;
    setPendente(null);
    void enviar(texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendente]);

  async function enviar(pergunta?: string) {
    const conteudo = (pergunta ?? texto).trim();
    if (!conteudo || pensando) return;

    setMsgs((m) => [...m, { autor: "voce", texto: conteudo }]);
    setTexto("");
    setPensando(true);

    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "chat",
          mensagem: conteudo,
          // Duplicado de propósito no topo do corpo: fluxos do n8n leem
          // `$json.body.nome` direto, sem cavar dentro de `usuario`.
          nome: user?.nome ?? null,
          usuario: user
            ? { id: user.id, nome: user.nome, plano: user.plano, cargo: user.cargo }
            : null,
          historico: msgs.slice(-6).map((m) => ({ autor: m.autor, texto: m.texto })),
        }),
      });
      const dados = await r.json();
      setMsgs((m) => [
        ...m,
        { autor: "tino", texto: dados.resposta ?? "Não consegui responder agora. Tenta de novo?" },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          autor: "tino",
          texto: `Estou com problema de conexão agora. Se for urgente, fale direto com a equipe:\n\n${brand.whatsapp}`,
        },
      ]);
    }
    setPensando(false);
  }

  // A volta do login social é uma tela de meio segundo com um spinner. Um
  // assistente piscando ali não ajuda ninguém — só polui a transição.
  if (pathname?.startsWith("/auth/")) return null;

  const sugestoes = user ? SUGESTOES_ALUNO : SUGESTOES_VISITANTE;

  return (
    <>
      {/* Botão flutuante — pílula no desktop, círculo no celular.
          Um círculo sozinho não diz o que é: a pessoa precisa clicar para
          descobrir. Com o nome ao lado, ela decide antes. */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir o Tino, assistente da Academy"
          className="group fixed bottom-5 right-5 z-[60] flex items-center gap-0 overflow-hidden rounded-full bg-navy-700 p-1.5 shadow-2xl shadow-navy-900/30 ring-1 ring-gold-400/40 transition-all hover:ring-gold-400 sm:gap-3 sm:pr-5"
        >
          <span className="relative shrink-0">
            <MarcaTino className="h-12 w-12" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-navy-700 ring-2 ring-navy-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-bold leading-tight text-white">
              Falar com o Tino
            </span>
            <span className="block text-[11px] leading-tight text-navy-100/60">
              Assistente da Academy
            </span>
          </span>
          {naoLida && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-gold-400 sm:hidden" />
          )}
        </button>
      )}

      {/* Janela */}
      {aberto && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex h-[min(660px,calc(100vh-1rem))] w-full flex-col overflow-hidden rounded-t-3xl border border-navy-100 bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100vh-3rem))] sm:w-[420px] sm:rounded-3xl">
          {/* Cabeçalho */}
          <div className="brand-gradient relative shrink-0 px-5 py-4">
            <div className="grid-lines absolute inset-0" />
            <div className="relative flex items-center gap-3">
              <MarcaTino className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-tight text-white">Tino</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-navy-100/70">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  Assistente da Academy
                </p>
              </div>
              <a
                href={brand.whatsapp}
                target="_blank"
                rel="noreferrer"
                title="Falar com a equipe no WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-110"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                  <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37s-1.04 1.01-1.04 2.47 1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91S17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 01-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.16 8.16 0 01-1.25-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.82c0 4.54-3.7 8.21-8.25 8.21z" />
                </svg>
              </a>
              <button
                onClick={() => setAberto(false)}
                aria-label="Minimizar o Tino"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-navy-100/60 transition hover:bg-white/10 hover:text-white"
              >
                <Minus size={18} />
              </button>
            </div>
          </div>

          {/* Conversa */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-cream/50 p-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-end gap-2",
                  m.autor === "voce" ? "justify-end" : "justify-start"
                )}
              >
                {/* O avatar só na primeira fala de cada bloco: repetido em toda
                    linha, ele vira ruído numa conversa longa. */}
                {m.autor === "tino" && (
                  <MarcaTino
                    anel={false}
                    className={cn("mb-0.5 h-7 w-7", msgs[i - 1]?.autor === "tino" && "invisible")}
                  />
                )}
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    m.autor === "voce"
                      ? "rounded-2xl rounded-br-md bg-navy-700 text-white"
                      : "rounded-2xl rounded-bl-md border border-navy-100 bg-white text-ink"
                  )}
                >
                  <Markdown texto={m.texto} escuro={m.autor === "voce"} />
                </div>
              </div>
            ))}

            {pensando && (
              <div className="flex items-end gap-2">
                <MarcaTino anel={false} className="mb-0.5 h-7 w-7" />
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-navy-100 bg-white px-4 py-3 shadow-sm">
                  <Loader2 size={14} className="animate-spin text-gold-500" />
                  <span className="text-xs text-muted">Tino está pensando…</span>
                </div>
              </div>
            )}

            {msgs.length === 1 && !pensando && (
              <div className="space-y-2 pt-1">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Perguntas frequentes
                </p>
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-navy-100 bg-white px-3.5 py-3 text-left text-[13px] font-medium text-navy-700 shadow-sm transition hover:border-gold-400 hover:bg-gold-50"
                  >
                    {s}
                    <ArrowRight size={14} className="shrink-0 text-gold-500" />
                  </button>
                ))}
              </div>
            )}

            <div ref={fim} />
          </div>

          {/* Entrada */}
          <div className="shrink-0 border-t border-navy-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 rounded-2xl border border-navy-200 bg-cream/40 p-1.5 pl-4 transition focus-within:border-gold-400 focus-within:bg-white">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder={user ? "Pergunte alguma coisa…" : "Pergunte antes de criar conta…"}
                aria-label="Mensagem para o Tino"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
              <button
                onClick={() => enviar()}
                disabled={!texto.trim() || pensando}
                aria-label="Enviar"
                className="gold-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-navy-800 transition hover:brightness-105 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted">
              O Tino pode errar. Confirme informações críticas com a equipe.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Markdown mínimo: negrito, itálico e link. Suficiente para as respostas. */
function Markdown({ texto, escuro }: { texto: string; escuro?: boolean }) {
  const linhas = texto.split("\n");
  return (
    <>
      {linhas.map((linha, i) => {
        if (!linha.trim()) return <div key={i} className="h-2" />;
        const partes = linha.split(/(\*\*[^*]+\*\*|_[^_]+_|https?:\/\/\S+)/g);
        return (
          <p key={i} className={i > 0 ? "mt-1" : undefined}>
            {partes.map((p, j) => {
              if (p.startsWith("**") && p.endsWith("**")) {
                return <strong key={j} className={escuro ? "text-white" : "text-navy-700"}>{p.slice(2, -2)}</strong>;
              }
              if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
                return <em key={j} className="opacity-75">{p.slice(1, -1)}</em>;
              }
              if (/^https?:\/\//.test(p)) {
                return (
                  <a
                    key={j}
                    href={p}
                    target="_blank"
                    rel="noreferrer"
                    className={cn("underline underline-offset-2", escuro ? "text-gold-300" : "text-gold-600")}
                  >
                    falar no WhatsApp
                  </a>
                );
              }
              return <span key={j}>{p}</span>;
            })}
          </p>
        );
      })}
    </>
  );
}

/* ==========================================================================
   CONVITE DO TINO — a caixinha do painel

   Um botão "abrir assistente" pede uma decisão antes de mostrar valor: a
   pessoa precisa querer conversar para descobrir que dá para conversar. A
   caixa já cumprimenta e já tem onde escrever — o primeiro passo custa nada.

   Ela não conversa aqui: ao enviar, abre o chat de verdade com a pergunta já
   despachada. Duas caixas de conversa na mesma tela seria duas conversas
   diferentes com o mesmo assistente.
   ========================================================================== */
export function ConviteTino({ nome }: { nome?: string }) {
  const [texto, setTexto] = useState("");

  const atalhos = [
    "Que curso combina com o meu momento?",
    "Como funciona o certificado PEPC?",
    "Me ajuda a montar uma trilha",
  ];

  function mandar(pergunta?: string) {
    const conteudo = (pergunta ?? texto).trim();
    if (!conteudo) {
      abrirTino();
      return;
    }
    abrirTino(conteudo, true);
    setTexto("");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gold-200 bg-gold-50">
      <div className="flex items-start gap-3 p-4">
        <MarcaTino className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy-700">
            Olá{nome ? `, ${nome}` : ""}! Eu sou o Tino
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gold-600/90">
            Pergunte sobre qualquer aula, legislação ou material — a resposta vem com a
            fonte citada.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4">
        {atalhos.map((a) => (
          <button
            key={a}
            onClick={() => mandar(a)}
            className="rounded-full border border-gold-300 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-gold-600 transition hover:bg-white"
          >
            {a}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mandar();
        }}
        className="mt-3 flex items-center gap-2 border-t border-gold-200 bg-white/60 p-3"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua dúvida…"
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label="Enviar para o Tino"
          className="gold-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy-800 transition hover:brightness-105"
        >
          {texto.trim() ? <Send size={15} /> : <ArrowRight size={15} />}
        </button>
      </form>
    </div>
  );
}
