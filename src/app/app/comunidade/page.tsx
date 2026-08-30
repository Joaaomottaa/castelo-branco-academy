"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award, Briefcase, Building2, Check, Heart, Loader2, MessageCircle,
  Megaphone, Send, Sparkles, UserPlus, Users, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Carregando, cn } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useDados } from "@/lib/dados";
import {
  alternarCurtida, carregarConexoes, carregarFeed, comentar, conectar,
  publicarPost, responderConexao,
} from "@/lib/repo-comunidade";
import { avancarMissao } from "@/lib/repo-gamificacao";
import type { Conexao, Post } from "@/lib/types";

const TIPOS: Record<string, { rotulo: string; tom: "gold" | "navy" | "green" | "teal" | "muted"; icone: React.ReactNode }> = {
  anuncio:     { rotulo: "Comunicado", tom: "gold",  icone: <Megaphone size={11} /> },
  vaga:        { rotulo: "Vaga",       tom: "green", icone: <Briefcase size={11} /> },
  artigo:      { rotulo: "Conteúdo",   tom: "teal",  icone: <Sparkles size={11} /> },
  certificado: { rotulo: "Certificado",tom: "gold",  icone: <Award size={11} /> },
  conquista:   { rotulo: "Conquista",  tom: "gold",  icone: <Award size={11} /> },
  texto:       { rotulo: "",           tom: "muted", icone: null },
};

export default function ComunidadePage() {
  const { user, modoDemo } = useSession();
  const { talentos } = useDados();

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [comentando, setComentando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      carregarFeed(user?.id),
      user?.id && !modoDemo ? carregarConexoes(user.id) : Promise.resolve([]),
    ]).then(([f, c]) => {
      if (!ativo) return;
      setPosts(f);
      setConexoes(c.length ? c : conexoesFallback);
    });
    return () => {
      ativo = false;
    };
  }, [user?.id, modoDemo]);

  const aceitas = conexoes.filter((c) => c.status === "aceita");
  const pendentes = conexoes.filter((c) => c.status === "pendente" && !c.souSolicitante);

  const sugestoes = useMemo(() => {
    const jaConectado = new Set(conexoes.map((c) => c.perfilId));
    return talentos.filter((t) => t.id !== user?.id && !jaConectado.has(t.id)).slice(0, 4);
  }, [talentos, conexoes, user?.id]);

  async function publicar() {
    const conteudo = texto.trim();
    if (!conteudo || !user) return;
    setEnviando(true);

    const id = await publicarPost(user.id, conteudo);
    const novo: Post = {
      id: id ?? `local-${Date.now()}`,
      autorId: user.id,
      autorNome: user.nome,
      autorCargo: user.cargo,
      autorNivel: user.nivel,
      tipo: "texto",
      conteudo,
      criadoEm: new Date().toISOString(),
      curtidas: 0,
      curtiu: false,
      comentarios: [],
    };
    setPosts((p) => [novo, ...(p ?? [])]);
    setTexto("");
    setEnviando(false);

    if (user.id) void avancarMissao(user.id, "semanal-comunidade");
  }

  function curtir(post: Post) {
    if (!user) return;
    const curtiu = !post.curtiu;
    setPosts((lista) =>
      (lista ?? []).map((p) =>
        p.id === post.id
          ? { ...p, curtiu, curtidas: p.curtidas + (curtiu ? 1 : -1) }
          : p
      )
    );
    void alternarCurtida(post.id, user.id, curtiu);
  }

  async function enviarComentario(post: Post) {
    const conteudo = rascunho.trim();
    if (!conteudo || !user) return;

    setPosts((lista) =>
      (lista ?? []).map((p) =>
        p.id === post.id
          ? {
              ...p,
              comentarios: [
                ...p.comentarios,
                {
                  id: `local-${Date.now()}`,
                  perfilId: user.id,
                  autorNome: user.nome,
                  autorCargo: user.cargo,
                  conteudo,
                  criadoEm: new Date().toISOString(),
                },
              ],
            }
          : p
      )
    );
    setRascunho("");
    await comentar(post.id, user.id, conteudo);
    if (user.id) void avancarMissao(user.id, "semanal-comunidade");
  }

  if (!posts) return <Carregando texto="Carregando a comunidade…" />;

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow text-gold-500">Comunidade</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
          O que está acontecendo na contabilidade
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Atualizações das empresas, conquistas dos alunos e as dúvidas que valem a pena
          discutir entre profissionais do setor.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------------------ feed */}
        <div className="space-y-5">
          {/* Compositor */}
          <Card>
            <div className="flex gap-3.5">
              <Avatar nome={user?.nome ?? "Você"} size={42} />
              <div className="min-w-0 flex-1">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={texto ? 4 : 2}
                  placeholder="Compartilhe uma conquista, uma dúvida técnica ou algo que você aprendeu esta semana…"
                  className="w-full resize-none rounded-xl border border-navy-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-gold-400 focus:ring-4 focus:ring-gold-400/15"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {texto.length > 0 ? `${texto.length} caracteres` : "Publicar conta para a missão da semana"}
                  </p>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={publicar}
                    disabled={!texto.trim() || enviando}
                  >
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Publicar
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {posts.map((p) => {
            const t = TIPOS[p.tipo] ?? TIPOS.texto;
            return (
              <Card key={p.id} className="!p-0 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3.5">
                    {p.empresaNome ? (
                      <span
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ background: p.empresaCor ?? "#00204D" }}
                      >
                        <Building2 size={18} />
                      </span>
                    ) : (
                      <Avatar nome={p.autorNome} size={44} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-navy-700">
                          {p.empresaNome ?? p.autorNome}
                        </span>
                        {t.rotulo && (
                          <Badge tone={t.tom}>
                            {t.icone} {t.rotulo}
                          </Badge>
                        )}
                        {p.autorNivel && !p.empresaNome && (
                          <span className="text-[11px] font-semibold text-gold-600">
                            Nível {p.autorNivel}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {p.empresaNome ? p.autorNome : p.autorCargo} · {tempoRelativo(p.criadoEm)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink">
                    {p.conteudo}
                  </p>

                  <div className="mt-4 flex items-center gap-1 border-t border-navy-100 pt-3">
                    <button
                      onClick={() => curtir(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                        p.curtiu ? "text-red-500 hover:bg-red-50" : "text-muted hover:bg-cream hover:text-navy-700"
                      )}
                    >
                      <Heart size={15} className={cn(p.curtiu && "fill-red-500")} />
                      {p.curtidas > 0 ? p.curtidas : "Curtir"}
                    </button>
                    <button
                      onClick={() => {
                        setComentando(comentando === p.id ? null : p.id);
                        setRascunho("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-cream hover:text-navy-700"
                    >
                      <MessageCircle size={15} />
                      {p.comentarios.length > 0 ? p.comentarios.length : "Comentar"}
                    </button>
                  </div>
                </div>

                {(p.comentarios.length > 0 || comentando === p.id) && (
                  <div className="space-y-3 border-t border-navy-100 bg-cream/50 p-5">
                    {p.comentarios.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar nome={c.autorNome} size={32} />
                        <div className="min-w-0 flex-1 rounded-xl bg-white p-3.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold text-navy-700">{c.autorNome}</span>
                            <span className="text-[11px] text-muted">{c.autorCargo}</span>
                            <span className="text-[11px] text-muted">· {tempoRelativo(c.criadoEm)}</span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-ink">{c.conteudo}</p>
                        </div>
                      </div>
                    ))}

                    {comentando === p.id && (
                      <div className="flex gap-3">
                        <Avatar nome={user?.nome ?? "Você"} size={32} />
                        <div className="flex min-w-0 flex-1 gap-2">
                          <input
                            autoFocus
                            value={rascunho}
                            onChange={(e) => setRascunho(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void enviarComentario(p);
                              }
                            }}
                            placeholder="Escreva um comentário…"
                            className="min-w-0 flex-1 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold-400"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void enviarComentario(p)}
                            disabled={!rascunho.trim()}
                          >
                            <Send size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* ---------------------------------------------------------- lateral */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {pendentes.length > 0 && (
            <Card>
              <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                <UserPlus size={15} className="text-gold-500" /> Convites ({pendentes.length})
              </h3>
              <div className="mt-4 space-y-3">
                {pendentes.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Avatar nome={c.nome} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-700">{c.nome}</p>
                      <p className="truncate text-xs text-muted">{c.cargo}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => {
                          void responderConexao(c.id, true);
                          setConexoes((l) => l.map((x) => x.id === c.id ? { ...x, status: "aceita" } : x));
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                        title="Aceitar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => {
                          void responderConexao(c.id, false);
                          setConexoes((l) => l.filter((x) => x.id !== c.id));
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Recusar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <Users size={15} className="text-gold-500" /> Minha rede
            </h3>
            <p className="mt-1 text-xs text-muted">
              {aceitas.length} conexõe{aceitas.length === 1 ? "m" : "s"} na comunidade
            </p>
            <div className="mt-4 space-y-2.5">
              {aceitas.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/app/talentos/${c.perfilId}`} className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-cream">
                  <Avatar nome={c.nome} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-700">{c.nome}</p>
                    <p className="truncate text-[11px] text-muted">{c.cargo}</p>
                  </div>
                </Link>
              ))}
              {aceitas.length === 0 && (
                <p className="py-3 text-sm text-muted">
                  Você ainda não tem conexões. Comece pelas sugestões abaixo.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">Pessoas para conhecer</h3>
            <p className="mt-1 text-xs text-muted">Profissionais do banco de talentos</p>
            <div className="mt-4 space-y-3">
              {sugestoes.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <Avatar nome={t.nome} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/talentos/${t.id}`}
                      className="block truncate text-sm font-semibold text-navy-700 hover:text-gold-600"
                    >
                      {t.nome}
                    </Link>
                    <p className="truncate text-[11px] text-muted">
                      {t.cargo} · {t.cidade}/{t.uf}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!user) return;
                      void conectar(user.id, t.id);
                      setConexoes((l) => [
                        ...l,
                        { id: `novo-${t.id}`, perfilId: t.id, nome: t.nome, cargo: t.cargo, status: "pendente", souSolicitante: true },
                      ]);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-navy-200 text-navy-600 transition hover:border-gold-400 hover:text-gold-600"
                    title="Conectar"
                  >
                    <UserPlus size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="!border-gold-200 !bg-gold-50">
            <Sparkles size={17} className="text-gold-500" />
            <p className="mt-2.5 text-sm font-bold text-navy-700">Publicar rende XP</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gold-600/90">
              Cada publicação ou comentário conta para a missão semanal da comunidade.
              Compartilhar o que aprendeu ajuda quem está começando — e a plataforma
              reconhece isso.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const conexoesFallback: Conexao[] = [
  { id: "x1", perfilId: "t2", nome: "Rafael Nogueira", cargo: "Consultor Tributário", cidade: "Salvador", uf: "BA", status: "aceita", souSolicitante: true },
  { id: "x2", perfilId: "t6", nome: "Diego Farias", cargo: "Coordenador Fiscal", cidade: "Curitiba", uf: "PR", status: "aceita", souSolicitante: true },
  { id: "x3", perfilId: "t3", nome: "Camila Duarte", cargo: "Analista de Comex", cidade: "São Paulo", uf: "SP", status: "pendente", souSolicitante: false },
];

function tempoRelativo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
