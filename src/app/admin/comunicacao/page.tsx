"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, CheckCircle2, Filter, History, Mail, Megaphone,
  Send, Sparkles, Users,
} from "lucide-react";
import { Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro } from "@/components/modal";
import {
  dispararCampanha, listarCampanhas, preverPublico,
  type Campanha, type Destinatario, type FiltroCampanha,
} from "@/lib/repo-pessoas";

/* ==========================================================================
   COMUNICAÇÃO EM MASSA

   Três decisões que moldaram a tela:

   1. A prévia do público vem ANTES do botão de enviar, e mostra nome por nome.
      Disparo em massa sem ver quem vai receber é como assinar sem ler.

   2. Os modelos prontos existem porque a maioria das campanhas de escola é a
      mesma: reativar quem sumiu, empurrar quem se cadastrou e não começou,
      avisar quem está perto do certificado.

   3. O e-mail entra numa fila e a tela diz isso. Não há SMTP configurado —
      fingir envio seria pior do que registrar como pendente.
   ========================================================================== */

const TIPOS = [
  { v: "info", rotulo: "Informativo", cor: "navy" as const },
  { v: "alerta", rotulo: "Alerta", cor: "red" as const },
  { v: "promo", rotulo: "Promoção", cor: "gold" as const },
  { v: "conquista", rotulo: "Conquista", cor: "green" as const },
];

interface Modelo {
  nome: string;
  descricao: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  link?: string;
  filtro: FiltroCampanha;
}

const MODELOS: Modelo[] = [
  {
    nome: "Reativar quem sumiu",
    descricao: "Sem acessar há mais de 30 dias",
    titulo: "Sentimos sua falta na Academy",
    mensagem:
      "Faz um tempo que você não aparece. A Reforma Tributária não esperou — atualizamos o conteúdo e há aulas novas na sua trilha. Que tal 20 minutos hoje?",
    tipo: "info",
    link: "/app/cursos",
    filtro: { inativoDias: 30, papel: "aluno" },
  },
  {
    nome: "Cadastrou e não começou",
    descricao: "Sem nenhuma matrícula",
    titulo: "Sua primeira aula está esperando",
    mensagem:
      "Você criou a conta mas ainda não começou nenhum curso. A aula de abertura de qualquer trilha é gratuita e leva menos de 15 minutos.",
    tipo: "info",
    link: "/app/cursos",
    filtro: { semMatricula: true, papel: "aluno" },
  },
  {
    nome: "Empurrar para o certificado",
    descricao: "Estudou mas ainda não tem certificado",
    titulo: "Falta pouco para o seu certificado",
    mensagem:
      "Você já avançou nos cursos, mas ainda não concluiu nenhum. O certificado vale pontos de educação continuada e aparece no seu perfil do banco de talentos.",
    tipo: "info",
    link: "/app/cursos",
    filtro: { semCertificado: true, papel: "aluno" },
  },
  {
    nome: "Oferta para o plano Free",
    descricao: "Quem está no gratuito e ativo",
    titulo: "Desconto no plano Pro",
    mensagem:
      "Use o cupom CASTELO50 e pague metade no primeiro mês do Pro: todos os cursos, certificados com validação e o Tino explicando cada questão que você errar.",
    tipo: "promo",
    link: "/app/planos",
    filtro: { planos: ["Free"], ativoUltimosDias: 30, papel: "aluno" },
  },
  {
    nome: "Aviso de manutenção",
    descricao: "Toda a base ativa",
    titulo: "Manutenção programada",
    mensagem:
      "A plataforma ficará indisponível no domingo, das 2h às 5h, para uma atualização. Nenhum progresso será perdido.",
    tipo: "alerta",
    filtro: {},
  },
];

export default function AdminComunicacaoPage() {
  const [modelo, setModelo] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState("info");
  const [link, setLink] = useState("");
  const [canais, setCanais] = useState<string[]>(["notificacao"]);
  const [filtro, setFiltro] = useState<FiltroCampanha>({ somenteAtivos: true });

  const [publico, setPublico] = useState<Destinatario[]>([]);
  const [carregandoPublico, setCarregandoPublico] = useState(false);
  const [historico, setHistorico] = useState<Campanha[]>([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const atualizarPublico = useCallback(async () => {
    setCarregandoPublico(true);
    const r = await preverPublico(filtro);
    setPublico(r.lista);
    if (r.erro) setErro(r.erro);
    setCarregandoPublico(false);
  }, [filtro]);

  useEffect(() => {
    void atualizarPublico();
  }, [atualizarPublico]);

  useEffect(() => {
    void listarCampanhas().then(setHistorico);
  }, []);

  function aplicarModelo(m: Modelo) {
    setModelo(m.nome);
    setTitulo(m.titulo);
    setMensagem(m.mensagem);
    setTipo(m.tipo);
    setLink(m.link ?? "");
    setFiltro({ somenteAtivos: true, ...m.filtro });
    setSucesso("");
  }

  function alternarCanal(c: string) {
    setCanais((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
  }

  async function enviar() {
    if (!titulo.trim() || !mensagem.trim()) {
      return setErro("Título e mensagem são obrigatórios.");
    }
    if (canais.length === 0) return setErro("Escolha ao menos um canal.");
    if (publico.length === 0) return setErro("Nenhuma pessoa se encaixa nesse filtro.");

    setEnviando(true);
    setErro("");
    const r = await dispararCampanha({ titulo, mensagem, tipo, link, canais, filtro });
    setEnviando(false);

    if (!r.ok) return setErro(r.erro ?? "Não foi possível disparar.");
    setSucesso(
      `Campanha disparada para ${r.destinatarios} pessoa(s).` +
        (canais.includes("email") ? " Os e-mails entraram na fila." : "")
    );
    setTitulo("");
    setMensagem("");
    setModelo(null);
    setHistorico(await listarCampanhas());
  }

  const resumoFiltro = useMemo(() => descreverFiltro(filtro), [filtro]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">Comunicação</h1>
        <p className="mt-1 text-sm text-muted">
          Avisos, campanhas e notificações para um público filtrado. A prévia mostra quem
          vai receber antes de você disparar.
        </p>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}
      {sucesso && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {/* --------------------------------------------------------- modelos */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
          <Sparkles size={13} className="text-gold-500" /> Comece por um modelo
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          {MODELOS.map((m) => (
            <button
              key={m.nome}
              onClick={() => aplicarModelo(m)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                modelo === m.nome
                  ? "border-gold-400 bg-gold-50"
                  : "border-navy-100 bg-white hover:border-gold-300"
              )}
            >
              <p className="text-[13px] font-bold text-navy-700">{m.nome}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{m.descricao}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------ mensagem */}
        <div className="space-y-4">
          <Card className="!p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <Megaphone size={13} className="text-gold-500" /> Mensagem
            </p>
            <div className="space-y-4">
              <Field label="Título">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Sentimos sua falta na Academy"
                  className={inputCls}
                />
              </Field>
              <Field label="Mensagem">
                <textarea
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Escreva como quem fala com um colega, não como quem manda circular."
                  className={inputCls}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                    {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
                  </select>
                </Field>
                <Field label="Link (opcional)" hint="Para onde o clique leva.">
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="/app/cursos"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
                  Canais
                </span>
                <div className="flex flex-wrap gap-2">
                  <BotaoCanal
                    ativo={canais.includes("notificacao")}
                    onClick={() => alternarCanal("notificacao")}
                    icone={<Bell size={13} />}
                    rotulo="Notificação no app"
                    nota="chega na hora"
                  />
                  <BotaoCanal
                    ativo={canais.includes("email")}
                    onClick={() => alternarCanal("email")}
                    icone={<Mail size={13} />}
                    rotulo="E-mail"
                    nota="entra na fila"
                  />
                </div>
                {canais.includes("email") && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Não há SMTP configurado. Os e-mails ficam registrados como{" "}
                      <strong>pendentes</strong> e saem quando o provedor for ligado — a
                      notificação no app, essa chega agora.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* ------------------------------------------------------ filtros */}
          <Card className="!p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <Filter size={13} className="text-gold-500" /> Quem recebe
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Perfil">
                <select
                  value={filtro.papel ?? ""}
                  onChange={(e) => setFiltro((f) => ({ ...f, papel: e.target.value || undefined }))}
                  className={inputCls}
                >
                  <option value="">Todos</option>
                  <option value="aluno">Alunos</option>
                  <option value="empresa">Empresas</option>
                  <option value="admin">Administradores</option>
                </select>
              </Field>
              <Field label="UF">
                <input
                  value={filtro.uf ?? ""}
                  maxLength={2}
                  onChange={(e) =>
                    setFiltro((f) => ({ ...f, uf: e.target.value.toUpperCase() || undefined }))
                  }
                  placeholder="BA"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
                Planos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {["Free", "Pro", "Enterprise"].map((p) => {
                  const marcado = filtro.planos?.includes(p) ?? false;
                  return (
                    <button
                      key={p}
                      onClick={() =>
                        setFiltro((f) => {
                          const atual = f.planos ?? [];
                          const novo = marcado ? atual.filter((x) => x !== p) : [...atual, p];
                          return { ...f, planos: novo.length ? novo : undefined };
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        marcado
                          ? "border-gold-400 bg-gold-50 text-gold-700"
                          : "border-navy-100 text-muted hover:border-navy-200"
                      )}
                    >
                      {p === "Enterprise" ? "Empresarial" : p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Sem acessar há mais de (dias)" hint="Inclui quem nunca acessou.">
                <input
                  type="number"
                  min={1}
                  value={filtro.inativoDias ?? ""}
                  onChange={(e) =>
                    setFiltro((f) => ({
                      ...f,
                      inativoDias: e.target.value ? Number(e.target.value) : undefined,
                      ativoUltimosDias: e.target.value ? undefined : f.ativoUltimosDias,
                    }))
                  }
                  placeholder="30"
                  className={inputCls}
                />
              </Field>
              <Field label="Ativo nos últimos (dias)">
                <input
                  type="number"
                  min={1}
                  value={filtro.ativoUltimosDias ?? ""}
                  onChange={(e) =>
                    setFiltro((f) => ({
                      ...f,
                      ativoUltimosDias: e.target.value ? Number(e.target.value) : undefined,
                      inativoDias: e.target.value ? undefined : f.inativoDias,
                    }))
                  }
                  placeholder="7"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="mt-4 space-y-2">
              {([
                ["semMatricula", "Nunca se matriculou em curso"],
                ["semCertificado", "Ainda não tem certificado"],
                ["comTrilha", "Já concluiu uma trilha"],
                ["somenteAtivos", "Somente contas ativas"],
              ] as const).map(([chave, rotulo]) => (
                <label key={chave} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(filtro[chave])}
                    onChange={(e) => setFiltro((f) => ({ ...f, [chave]: e.target.checked }))}
                    className="h-4 w-4 accent-[#C89F50]"
                  />
                  <span className="text-sm text-ink">{rotulo}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------------- prévia */}
        <div className="space-y-4">
          <Card className="!p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
                <Users size={13} className="text-gold-500" /> Público
              </p>
              {carregandoPublico && <span className="text-[11px] text-muted">calculando…</span>}
            </div>

            <p className="text-3xl font-bold tabular-nums text-navy-700">{publico.length}</p>
            <p className="text-xs text-muted">pessoa{publico.length === 1 ? "" : "s"} receberão</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{resumoFiltro}</p>

            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-navy-100 p-2">
              {publico.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted">
                  Nenhuma pessoa se encaixa nesse filtro.
                </p>
              ) : (
                publico.slice(0, 40).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded px-1.5 py-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{d.nome}</span>
                    <span className="shrink-0 text-[10px] text-muted">{d.plano}</span>
                  </div>
                ))
              )}
              {publico.length > 40 && (
                <p className="px-1.5 py-1 text-[11px] text-muted">
                  e mais {publico.length - 40}…
                </p>
              )}
            </div>

            <Button
              variant="gold"
              full
              className="mt-4"
              onClick={enviar}
              disabled={enviando || publico.length === 0 || !titulo.trim() || !mensagem.trim()}
            >
              {enviando ? "Disparando…" : (
                <><Send size={14} /> Disparar para {publico.length}</>
              )}
            </Button>
          </Card>

          {/* prévia visual da notificação */}
          {(titulo || mensagem) && (
            <Card className="!p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
                Como vai aparecer
              </p>
              <div className="rounded-xl border border-navy-100 bg-cream/40 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      tipo === "alerta" ? "bg-red-50 text-red-600"
                        : tipo === "promo" ? "gold-gradient text-navy-800"
                          : tipo === "conquista" ? "bg-emerald-50 text-emerald-600"
                            : "bg-navy-50 text-navy-600"
                    )}
                  >
                    <Bell size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-navy-700">
                      {titulo || "Título da mensagem"}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink">
                      {mensagem || "Corpo da mensagem."}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">agora</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="!p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <History size={13} className="text-gold-500" /> Últimas campanhas
            </p>
            {historico.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">Nenhuma campanha disparada.</p>
            ) : (
              <div className="space-y-2.5">
                {historico.slice(0, 8).map((c) => (
                  <div key={c.id} className="border-b border-navy-100 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-navy-700">
                        {c.titulo}
                      </p>
                      <Badge tone={TIPOS.find((t) => t.v === c.tipo)?.cor ?? "muted"}>
                        {c.destinatarios}
                      </Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                      <span>{new Date(c.criadoEm).toLocaleString("pt-BR")}</span>
                      <span>·</span>
                      <span>{c.canais.join(", ")}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function BotaoCanal({
  ativo, onClick, icone, rotulo, nota,
}: {
  ativo: boolean; onClick: () => void; icone: React.ReactNode; rotulo: string; nota: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition",
        ativo ? "border-gold-400 bg-gold-50" : "border-navy-100 hover:border-navy-200"
      )}
    >
      <span className={cn(ativo ? "text-gold-600" : "text-navy-300")}>{icone}</span>
      <span>
        <span className={cn("block text-[13px] font-semibold", ativo ? "text-navy-700" : "text-muted")}>
          {rotulo}
        </span>
        <span className="block text-[10px] text-muted">{nota}</span>
      </span>
    </button>
  );
}

function descreverFiltro(f: FiltroCampanha): string {
  const partes: string[] = [];
  partes.push(f.papel ? `perfil ${f.papel}` : "todos os perfis");
  if (f.planos?.length) partes.push(`plano ${f.planos.join(" ou ")}`);
  if (f.uf) partes.push(`de ${f.uf}`);
  if (f.inativoDias) partes.push(`sem acessar há mais de ${f.inativoDias} dias`);
  if (f.ativoUltimosDias) partes.push(`ativos nos últimos ${f.ativoUltimosDias} dias`);
  if (f.semMatricula) partes.push("sem matrícula");
  if (f.semCertificado) partes.push("sem certificado");
  if (f.comTrilha) partes.push("com trilha concluída");
  if (f.somenteAtivos) partes.push("contas ativas");
  return partes.join(" · ");
}
