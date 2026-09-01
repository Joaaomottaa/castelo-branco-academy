"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, Check, Clock, Loader2, MapPin, MessageSquare, Search, Send,
  UserCheck, UserPlus, Users, X,
} from "lucide-react";
import {
  Avatar, Badge, Button, Card, EmptyState, abaCls, abasCls, cn, inputCls,
} from "@/components/ui";
import { useSession } from "@/lib/session";
import {
  abrirConversa, buscarColegas, carregarConexoes, conectar, enviarMensagem,
  marcarConversaLida, mensagensDaConversa, minhasConversas, responderConexao,
} from "@/lib/repo-comunidade";
import type { Colega, Conexao, Conversa, Mensagem } from "@/lib/types";

/* ==========================================================================
   COLEGAS

   Ficava tudo na lateral do feed: quatro sugestões fixas, nenhum campo de
   busca e nenhum lugar para conversar. Quem quisesse achar um colega pelo nome
   não tinha por onde.

   Virou tela própria, com três abas — e não uma aba "Feed e amigos" — porque
   são coisas com ritmos diferentes: o feed é leitura corrida, isto aqui é
   ação (procurar, aceitar, responder). Misturar deixava as duas piores.

   · Buscar    — procura no banco por nome, cargo, cidade ou habilidade.
   · Convites  — pedidos recebidos e enviados.
   · Mensagens — conversa 1:1, só entre quem se conectou.
   ========================================================================== */

type Aba = "buscar" | "convites" | "mensagens";

export default function ColegasPage() {
  const { user } = useSession();
  const [aba, setAba] = useState<Aba>("buscar");
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);

  const recarregarConexoes = useCallback(async () => {
    if (!user?.id) return;
    setConexoes(await carregarConexoes(user.id));
  }, [user?.id]);

  const recarregarConversas = useCallback(async () => {
    setConversas(await minhasConversas());
  }, []);

  useEffect(() => {
    void recarregarConexoes();
    void recarregarConversas();
  }, [recarregarConexoes, recarregarConversas]);

  const pendentesRecebidos = conexoes.filter((c) => c.status === "pendente" && !c.souSolicitante);
  const naoLidas = conversas.reduce((a, c) => a + c.naoLidas, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-gold-500">Comunidade</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
          Colegas
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Procure quem trabalha com o que você trabalha, conecte-se e converse. Contador
          resolve muita coisa perguntando a quem já passou por aquilo.
        </p>
      </div>

      <div className={abasCls}>
        {([
          ["buscar", "Buscar colegas", <Search key="i" size={15} />, 0],
          ["convites", "Convites", <UserPlus key="i" size={15} />, pendentesRecebidos.length],
          ["mensagens", "Mensagens", <MessageSquare key="i" size={15} />, naoLidas],
        ] as const).map(([k, rotulo, icone, contador]) => (
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
            {icone} {rotulo}
            {contador > 0 && (
              <span className="ml-1 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy-800">
                {contador}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === "buscar" && (
        <Buscar
          conexoes={conexoes}
          aoMudarConexoes={recarregarConexoes}
          aoConversar={async (id) => {
            setAba("mensagens");
            await recarregarConversas();
            return id;
          }}
        />
      )}

      {aba === "convites" && (
        <Convites conexoes={conexoes} aoResponder={recarregarConexoes} />
      )}

      {aba === "mensagens" && (
        <Mensagens
          conversas={conversas}
          aoAtualizar={recarregarConversas}
          conectados={conexoes.filter((c) => c.status === "aceita")}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- buscar ---- */
function Buscar({
  conexoes, aoMudarConexoes, aoConversar,
}: {
  conexoes: Conexao[];
  aoMudarConexoes: () => Promise<void>;
  aoConversar: (perfilId: string) => Promise<string>;
}) {
  const { user } = useSession();
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<Colega[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Busca com um respiro de 350ms: digitar "recuperação de crédito" não
  // dispara vinte consultas.
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const r = await buscarColegas(termo);
      if (vivo) setLista(r);
    }, termo ? 350 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [termo]);

  const statusDe = (id: string) =>
    conexoes.find((c) => c.perfilId === id)?.status;

  async function pedir(c: Colega) {
    if (!user?.id) return;
    setErro("");
    setOcupado(c.id);
    const r = await conectar(user.id, c.id);
    setOcupado(null);
    if (!r.ok) return setErro(r.erro ?? "Não consegui enviar o convite.");
    // Otimista na tela, confirmado no recarregamento.
    setLista((l) =>
      l?.map((x) =>
        x.id === c.id
          ? { ...x, conexao: { id: "novo", status: "pendente", souSolicitante: true } }
          : x
      ) ?? null
    );
    await aoMudarConexoes();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome, cargo, cidade ou habilidade — ex.: SPED, comex, Salvador"
            className={cn(inputCls, "pl-10")}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Aparece aqui quem publicou o perfil na plataforma. Para aparecer nas buscas,
          ligue a opção em{" "}
          <Link href="/app/perfil" className="font-semibold text-gold-600 hover:underline">
            Meu perfil
          </Link>
          .
        </p>
      </Card>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      {lista === null ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Procurando…
        </p></Card>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<Users size={30} />}
          title="Ninguém com esse termo"
          description="Tente pelo assunto que a pessoa domina — SPED, folha, comex — ou pela cidade."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((c) => {
            const status = c.conexao?.status ?? statusDe(c.id);
            return (
              <Card key={c.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <Avatar nome={c.nome} size={44} url={c.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-navy-700">{c.nome}</p>
                    <p className="text-xs leading-snug text-muted">{c.cargo ?? "Sem cargo"}</p>
                    {(c.cidade || c.uf) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs leading-snug text-muted">
                        <MapPin size={11} className="shrink-0" /> {c.cidade}
                        {c.uf ? `/${c.uf}` : ""}
                      </p>
                    )}
                  </div>
                  {c.crc && <Badge tone="teal">CRC</Badge>}
                </div>

                {c.habilidades.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.habilidades.slice(0, 4).map((h) => (
                      <span
                        key={h}
                        className="rounded-md bg-cream px-2 py-0.5 text-[11px] font-medium text-navy-600"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-100 pt-3.5">
                  {status === "aceita" ? (
                    <>
                      <Badge tone="green">
                        <UserCheck size={11} /> Conectados
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void aoConversar(c.id)}
                        className="ml-auto"
                      >
                        <MessageSquare size={13} /> Conversar
                      </Button>
                    </>
                  ) : status === "pendente" ? (
                    <Badge tone="gold">
                      <Clock size={11} /> Convite pendente
                    </Badge>
                  ) : (
                    <Button
                      variant="gold"
                      size="sm"
                      disabled={ocupado === c.id}
                      onClick={() => void pedir(c)}
                    >
                      {ocupado === c.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <UserPlus size={13} />
                      )}
                      Conectar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- convites ---- */
function Convites({
  conexoes, aoResponder,
}: {
  conexoes: Conexao[];
  aoResponder: () => Promise<void>;
}) {
  const recebidos = conexoes.filter((c) => c.status === "pendente" && !c.souSolicitante);
  const enviados = conexoes.filter((c) => c.status === "pendente" && c.souSolicitante);
  const aceitas = conexoes.filter((c) => c.status === "aceita");

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
          <UserPlus size={15} className="text-gold-500" /> Pedidos recebidos
        </h2>
        {recebidos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum pedido esperando resposta.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {recebidos.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3">
                <Avatar nome={c.nome} size={38} />
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-semibold leading-snug text-navy-700">{c.nome}</p>
                  <p className="text-xs leading-snug text-muted">
                    {c.cargo}
                    {c.cidade ? ` · ${c.cidade}/${c.uf}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={async () => {
                      await responderConexao(c.id, true);
                      await aoResponder();
                    }}
                  >
                    <Check size={13} /> Aceitar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await responderConexao(c.id, false);
                      await aoResponder();
                    }}
                  >
                    <X size={13} /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {enviados.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
            <Clock size={15} className="text-gold-500" /> Convites que você enviou
          </h2>
          <div className="mt-4 space-y-2.5">
            {enviados.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar nome={c.nome} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-navy-700">{c.nome}</p>
                  <p className="text-[11px] leading-snug text-muted">{c.cargo}</p>
                </div>
                <Badge tone="muted">Aguardando</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
          <UserCheck size={15} className="text-gold-500" /> Minha rede ({aceitas.length})
        </h2>
        {aceitas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Você ainda não tem conexões. Comece pela busca.
          </p>
        ) : (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {aceitas.map((c) => (
              <Link
                key={c.id}
                href={`/app/talentos/${c.perfilId}`}
                className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-cream"
              >
                <Avatar nome={c.nome} size={34} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-navy-700">{c.nome}</p>
                  <p className="text-[11px] leading-snug text-muted">{c.cargo}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- mensagens ---- */
function Mensagens({
  conversas, aoAtualizar, conectados,
}: {
  conversas: Conversa[];
  aoAtualizar: () => Promise<void>;
  conectados: Conexao[];
}) {
  const { user } = useSession();
  const [ativa, setAtiva] = useState<Conversa | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const abrir = useCallback(
    async (c: Conversa) => {
      setAtiva(c);
      setMsgs(null);
      setErro("");
      const lista = await mensagensDaConversa(c.id);
      setMsgs(lista);
      if (user?.id && c.naoLidas > 0) {
        await marcarConversaLida(c.id, user.id);
        await aoAtualizar();
      }
    },
    [user?.id, aoAtualizar]
  );

  // Rola para a última mensagem quando a conversa abre ou cresce.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  /** Começa a conversa com alguém da rede que ainda não tem caixa aberta. */
  async function comecarCom(perfilId: string, nome: string, cargo?: string) {
    setErro("");
    const r = await abrirConversa(perfilId);
    if (r.erro || !r.id) return setErro(r.erro ?? "Não consegui abrir a conversa.");
    const nova: Conversa = {
      id: r.id,
      atualizadoEm: new Date().toISOString(),
      outro: { id: perfilId, nome, cargo },
      naoLidas: 0,
    };
    await aoAtualizar();
    await abrir(nova);
  }

  async function enviar() {
    if (!ativa || !user?.id) return;
    const conteudo = texto.trim();
    if (!conteudo) return;
    setEnviando(true);
    const r = await enviarMensagem(ativa.id, user.id, conteudo);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui enviar.");
    setTexto("");
    setMsgs(await mensagensDaConversa(ativa.id));
    await aoAtualizar();
  }

  // Quem está na rede e ainda não tem conversa aberta.
  const semConversa = useMemo(() => {
    const jaTem = new Set(conversas.map((c) => c.outro.id));
    return conectados.filter((c) => !jaTem.has(c.perfilId));
  }, [conversas, conectados]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Caixa de entrada */}
      <div className="space-y-3">
        <Card className="!p-0 overflow-hidden">
          {conversas.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              Nenhuma conversa ainda. Comece por alguém da sua rede.
            </p>
          ) : (
            <div className="divide-y divide-navy-100">
              {conversas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void abrir(c)}
                  className={cn(
                    "flex w-full items-start gap-3 p-3.5 text-left transition",
                    ativa?.id === c.id ? "bg-gold-50" : "hover:bg-cream/70"
                  )}
                >
                  <Avatar nome={c.outro.nome} size={38} url={c.outro.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-snug text-navy-700">
                      {c.outro.nome}
                      {c.naoLidas > 0 && (
                        <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy-800">
                          {c.naoLidas}
                        </span>
                      )}
                    </p>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted">
                      {c.ultima
                        ? `${c.ultima.minha ? "Você: " : ""}${c.ultima.conteudo}`
                        : "Conversa nova"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {semConversa.length > 0 && (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
              Começar conversa
            </p>
            <div className="mt-3 space-y-2">
              {semConversa.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => void comecarCom(c.perfilId, c.nome, c.cargo)}
                  className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-cream"
                >
                  <Avatar nome={c.nome} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-navy-700">
                      {c.nome}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted">{c.cargo}</span>
                  </span>
                  <MessageSquare size={14} className="shrink-0 text-gold-500" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Conversa */}
      <Card className="flex min-h-[26rem] flex-col !p-0">
        {!ativa ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <MessageSquare size={28} className="text-navy-200" />
            <p className="mt-3 text-sm font-semibold text-navy-700">
              Escolha uma conversa
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
              A conversa é entre quem já se conectou — é o que separa uma rede de uma
              caixa de entrada aberta a qualquer um.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-navy-100 p-4">
              <Avatar nome={ativa.outro.nome} size={38} url={ativa.outro.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug text-navy-700">
                  {ativa.outro.nome}
                </p>
                <p className="text-[11px] leading-snug text-muted">{ativa.outro.cargo}</p>
              </div>
              <Button href={`/app/talentos/${ativa.outro.id}`} variant="ghost" size="sm">
                Ver perfil
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
              {msgs === null ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> Abrindo…
                </p>
              ) : msgs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  Nenhuma mensagem. Diga o que você precisa — a maioria aqui responde.
                </p>
              ) : (
                msgs.map((m) => {
                  const minha = m.remetenteId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", minha ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          minha
                            ? "bg-navy-700 text-white"
                            : "border border-navy-100 bg-cream/70 text-ink"
                        )}
                      >
                        <p className="whitespace-pre-line break-words">{m.conteudo}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            minha ? "text-navy-100/60" : "text-muted"
                          )}
                        >
                          {new Date(m.criadoEm).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={fim} />
            </div>

            {erro && (
              <p className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
              </p>
            )}

            <div className="flex gap-2 border-t border-navy-100 p-3">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                placeholder="Escreva uma mensagem…"
                className={cn(inputCls, "min-w-0 flex-1")}
              />
              <Button
                variant="gold"
                onClick={() => void enviar()}
                disabled={!texto.trim() || enviando}
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
