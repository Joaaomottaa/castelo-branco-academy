"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award, Calendar, CheckCircle2, Clock, Flame, Gift, Lock, Sparkles,
  Target, TrendingUp, Trophy, X, Zap,
} from "lucide-react";
import { Badge, Button, Card, Carregando, Progress, cn } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useDados } from "@/lib/dados";
import { carregarGamificacao, type PainelGamificacao } from "@/lib/repo-gamificacao";
import type { Conquista, Missao } from "@/lib/types";

const RARIDADES: Record<string, { rotulo: string; cor: string; borda: string; texto: string }> = {
  comum:    { rotulo: "Comum",    cor: "bg-slate-100",   borda: "border-slate-200",   texto: "text-slate-600" },
  raro:     { rotulo: "Raro",     cor: "bg-navy-50",     borda: "border-navy-200",    texto: "text-navy-700" },
  epico:    { rotulo: "Épico",    cor: "bg-teal/10",     borda: "border-teal/30",     texto: "text-teal" },
  lendario: { rotulo: "Lendário", cor: "bg-gold-50",     borda: "border-gold-300",    texto: "text-gold-600" },
};

const CATEGORIAS = [
  { slug: "todas",     rotulo: "Todas" },
  { slug: "ofensiva",  rotulo: "Ofensiva" },
  { slug: "estudo",    rotulo: "Estudo" },
  { slug: "avaliacao", rotulo: "Avaliações" },
  { slug: "carreira",  rotulo: "Carreira" },
  { slug: "comunidade",rotulo: "Comunidade" },
];

export default function ConquistasPage() {
  const { user } = useSession();
  const { meusCertificados, minhasTrilhas } = useDados();
  const [painel, setPainel] = useState<PainelGamificacao | null>(null);
  const [categoria, setCategoria] = useState("todas");
  const [aberta, setAberta] = useState<Conquista | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarGamificacao(user?.id).then((p) => {
      if (ativo) setPainel(p);
    });
    return () => {
      ativo = false;
    };
  }, [user?.id]);

  const conquistas = painel?.conquistas ?? [];
  const missoes = painel?.missoes ?? [];

  const filtradas = useMemo(
    () => (categoria === "todas" ? conquistas : conquistas.filter((c) => c.categoria === categoria)),
    [conquistas, categoria]
  );

  if (!painel) return <Carregando texto="Carregando suas conquistas…" />;

  const obtidas = conquistas.filter((c) => c.obtida).length;
  const xpTotal = user?.pontos ?? 0;
  const nivel = user?.nivel ?? 1;
  const xpNivelAtual = Math.pow(nivel - 1, 2) * 250;
  const xpProximo = Math.pow(nivel, 2) * 250;
  const pctNivel = Math.min(
    100,
    Math.round(((xpTotal - xpNivelAtual) / Math.max(1, xpProximo - xpNivelAtual)) * 100)
  );

  const diarias = missoes.filter((m) => m.periodo === "diaria");
  const semanais = missoes.filter((m) => m.periodo === "semanal");
  const mensais = missoes.filter((m) => m.periodo === "mensal");

  const minutosSemana = painel.estudo
    .slice(0, 7)
    .reduce((a, d) => a + d.minutos, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-gold-500">Sua evolução</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-navy-700">
          Conquistas e missões
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Cada conquista tem lastro: nota mínima, projeto entregue ou constância real.
          Nada é dado por presença.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="!bg-navy-700 !border-navy-700">
          <div className="flex items-start justify-between">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-gold-300">
              <Trophy size={18} />
            </span>
            <Badge tone="gold">Nível {nivel}</Badge>
          </div>
          <p className="mt-4 text-2xl font-bold text-white">{xpTotal.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-navy-100/60">XP acumulado</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="gold-gradient h-full rounded-full transition-all" style={{ width: `${pctNivel}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-navy-100/55">
            faltam {Math.max(0, xpProximo - xpTotal).toLocaleString("pt-BR")} XP para o nível {nivel + 1}
          </p>
        </Card>

        <Kpi icon={<Flame size={18} />} valor={`${user?.ofensiva ?? 0} dias`} rotulo="Ofensiva atual" tom="gold" />
        <Kpi icon={<Award size={18} />} valor={`${obtidas}/${conquistas.length}`} rotulo="Conquistas" tom="teal" />
        <Kpi icon={<Clock size={18} />} valor={`${Math.round(minutosSemana)} min`} rotulo="Estudo nos últimos 7 dias" tom="navy" />
      </div>

      {/* Ofensiva visual */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
            <Flame size={16} className="text-gold-500" /> Sua constância
          </h2>
          <span className="text-xs text-muted">Últimos 14 dias</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {Array.from({ length: 14 }, (_, i) => {
            const dia = new Date(Date.now() - (13 - i) * 86400000);
            const iso = dia.toISOString().slice(0, 10);
            const reg = painel.estudo.find((d) => d.dia === iso);
            const min = reg?.minutos ?? 0;
            return (
              <div
                key={iso}
                title={`${dia.toLocaleDateString("pt-BR")} — ${min} min`}
                className={cn(
                  "flex h-11 flex-1 min-w-[36px] flex-col items-center justify-center rounded-lg border text-[10px] font-semibold transition",
                  min === 0
                    ? "border-navy-100 bg-cream text-navy-200"
                    : min < 30
                      ? "border-gold-200 bg-gold-50 text-gold-600"
                      : "gold-gradient border-transparent text-navy-800"
                )}
              >
                <span>{dia.getDate()}</span>
                {min > 0 && <span className="text-[9px] opacity-80">{min}m</span>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Estudar qualquer coisa no dia mantém a sequência. Perder um dia zera —
          é o que faz a ofensiva valer alguma coisa.
        </p>
      </Card>

      {/* Missões */}
      <div>
        <h2 className="text-lg font-bold text-navy-700">Missões</h2>
        <p className="mt-1 text-sm text-muted">
          Objetivos pequenos e alcançáveis. As diárias reiniciam à meia-noite; as semanais, na segunda.
        </p>

        <div className="mt-5 space-y-6">
          <GrupoMissoes titulo="Hoje" icone={<Zap size={15} />} missoes={diarias} />
          <GrupoMissoes titulo="Esta semana" icone={<Calendar size={15} />} missoes={semanais} />
          <GrupoMissoes titulo="Este mês" icone={<TrendingUp size={15} />} missoes={mensais} />
        </div>
      </div>

      {/* Conquistas */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-navy-700">Conquistas</h2>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <button
                key={c.slug}
                onClick={() => setCategoria(c.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  categoria === c.slug
                    ? "border-gold-400 bg-gold-50 text-gold-600"
                    : "border-navy-100 bg-white text-muted hover:border-navy-200"
                )}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtradas.map((c) => {
            const r = RARIDADES[c.raridade] ?? RARIDADES.comum;
            return (
              <button
                key={c.id}
                onClick={() => setAberta(c)}
                className={cn(
                  "group rounded-2xl border p-5 text-left transition",
                  c.obtida
                    ? `${r.borda} bg-white card-hover`
                    : "border-navy-100 bg-cream/60 hover:border-navy-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition",
                      c.obtida ? r.cor : "bg-navy-50 grayscale opacity-40"
                    )}
                  >
                    {c.obtida ? c.icone : <Lock size={18} className="text-navy-300" />}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      c.obtida ? `${r.borda} ${r.texto} ${r.cor}` : "border-navy-100 text-navy-300"
                    )}
                  >
                    {r.rotulo}
                  </span>
                </div>

                <p className={cn("mt-3.5 text-sm font-bold", c.obtida ? "text-navy-700" : "text-navy-400")}>
                  {c.nome}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {c.descricao}
                </p>

                <div className="mt-3.5 flex items-center justify-between border-t border-navy-100 pt-3">
                  <span className="text-[11px] font-bold text-gold-600">+{c.xp} XP</span>
                  {c.obtida ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <CheckCircle2 size={12} /> Conquistada
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">Ver como desbloquear</span>
                  )}
                </div>

                {c.recompensa && (
                  <p className={cn(
                    "mt-2.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug",
                    c.obtida ? "bg-gold-50 text-gold-600" : "bg-navy-50 text-navy-400"
                  )}>
                    <Gift size={12} className="mt-0.5 shrink-0" /> {c.recompensa}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Extrato de XP */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
          <Sparkles size={16} className="text-gold-500" /> Extrato de XP
        </h2>
        <div className="mt-4 divide-y divide-navy-100">
          {painel.eventos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              Nenhum XP registrado ainda. Assista a uma aula para começar.
            </p>
          )}
          {painel.eventos.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-gold-500">
                {e.tipo === "curso" ? <Award size={14} /> : e.tipo === "missao" ? <Target size={14} /> : <Zap size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{e.descricao ?? e.tipo}</p>
                <p className="text-[11px] text-muted">
                  {new Date(e.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gold-600">+{e.xp}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Detalhe da conquista */}
      {aberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm"
          onClick={() => setAberta(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-2xl text-3xl",
                  aberta.obtida ? (RARIDADES[aberta.raridade] ?? RARIDADES.comum).cor : "bg-navy-50 grayscale opacity-50"
                )}
              >
                {aberta.obtida ? aberta.icone : <Lock size={24} className="text-navy-300" />}
              </span>
              <button onClick={() => setAberta(null)} className="text-muted hover:text-navy-700">
                <X size={20} />
              </button>
            </div>

            <h3 className="mt-5 text-xl font-bold text-navy-700">{aberta.nome}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{aberta.descricao}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="gold">+{aberta.xp} XP</Badge>
              <Badge tone="navy">{(RARIDADES[aberta.raridade] ?? RARIDADES.comum).rotulo}</Badge>
              {aberta.obtida && aberta.obtidaEm && (
                <Badge tone="green">
                  Conquistada em {new Date(aberta.obtidaEm).toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>

            {aberta.criterio?.meta && (
              <div className="mt-5 rounded-xl border border-navy-100 bg-cream/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-navy-600">
                  Como desbloquear
                </p>
                <p className="mt-1.5 text-sm text-ink">
                  {descreverCriterio(aberta)}
                </p>
              </div>
            )}

            {aberta.recompensa && aberta.recompensa !== "—" && (
              <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-600">
                  <Gift size={12} /> Recompensa
                </p>
                <p className="mt-1.5 text-sm font-medium text-gold-600/90">{aberta.recompensa}</p>
              </div>
            )}

            <div className="mt-6">
              <Button
                href={aberta.categoria === "comunidade" ? "/app/comunidade" : aberta.categoria === "avaliacao" ? "/app/questoes" : "/app/cursos"}
                variant={aberta.obtida ? "outline" : "gold"}
                full
              >
                {aberta.obtida ? "Ver meu progresso" : "Ir trabalhar nisso"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GrupoMissoes({
  titulo, icone, missoes,
}: {
  titulo: string; icone: React.ReactNode; missoes: Missao[];
}) {
  if (missoes.length === 0) return null;
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
        <span className="text-gold-500">{icone}</span> {titulo}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {missoes.map((m) => {
          const pct = Math.min(100, Math.round((m.progresso / m.meta) * 100));
          return (
            <Card
              key={m.id}
              className={cn(m.concluida && "!border-emerald-200 !bg-emerald-50/50")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy-700">{m.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.descricao}</p>
                </div>
                {m.concluida ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                ) : (
                  <Badge tone="gold">+{m.xp}</Badge>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[11px] font-semibold">
                  <span className="text-muted">
                    {m.progresso} / {m.meta} {rotuloMetrica(m.metrica)}
                  </span>
                  <span className={m.concluida ? "text-emerald-600" : "text-navy-700"}>{pct}%</span>
                </div>
                <Progress value={pct} tone={m.concluida ? "green" : "gold"} />
              </div>

              {m.recompensa && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gold-600">
                  <Gift size={11} /> {m.recompensa}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  icon, valor, rotulo, tom,
}: {
  icon: React.ReactNode; valor: string; rotulo: string; tom: "gold" | "navy" | "teal";
}) {
  const tons: Record<string, string> = {
    gold: "bg-gold-50 text-gold-500",
    navy: "bg-navy-50 text-navy-600",
    teal: "bg-teal/10 text-teal",
  };
  return (
    <Card className="flex items-center gap-4">
      <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl", tons[tom])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold text-navy-700">{valor}</p>
        <p className="truncate text-xs text-muted">{rotulo}</p>
      </div>
    </Card>
  );
}

function rotuloMetrica(m: string) {
  return (
    { aulas: "aulas", minutos: "min", questoes: "questões", quiz: "avaliação", posts: "publicações", cursos: "curso", dias: "dias" } as Record<string, string>
  )[m] ?? m;
}

function descreverCriterio(c: Conquista) {
  const { metrica, meta, dias } = c.criterio ?? {};
  if (!meta) return c.descricao ?? "";
  switch (metrica) {
    case "dias": return `Estude por ${meta} dias seguidos sem quebrar a sequência.`;
    case "minutos": return `Acumule ${meta} minutos (${Math.round(meta / 60)}h) de aula assistida.`;
    case "minutos_por_dia": return `Assista ${meta} minutos por dia durante ${dias} dias seguidos.`;
    case "questoes": return `Responda ${meta} questões no banco de questões.`;
    case "certificados": return `Emita ${meta} certificado${meta > 1 ? "s" : ""} de curso.`;
    case "trilhas": return `Conclua ${meta} trilha${meta > 1 ? "s" : ""} de carreira por inteiro.`;
    case "pepc": return `Acumule ${meta} pontos de educação profissional continuada no ano.`;
    case "nota": return `Tire ${meta}% em uma avaliação final.`;
    case "simulado": return `Faça um simulado e acerte ao menos ${meta}%.`;
    case "conexoes": return `Conecte-se com ${meta} profissionais na comunidade.`;
    case "curtidas": return `Receba ${meta} curtidas somando todas as suas publicações.`;
    case "posts": return `Publique ${meta} vez${meta > 1 ? "es" : ""} no feed da comunidade.`;
    case "respostas": return `Responda ${meta} dúvidas de outros alunos.`;
    default: return c.descricao ?? "";
  }
}
