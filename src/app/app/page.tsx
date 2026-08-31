"use client";

import Link from "next/link";
import {
  Award, BookOpen, CalendarDays, Clock, Flame, PlayCircle, Target, Trophy,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, Progress, cn } from "@/components/ui";
import { useDados } from "@/lib/dados";
import { ConviteTino } from "@/components/tino";
import { CartaoRevisao } from "@/components/revisao";
import { CartaoFormacoesDaEmpresa } from "@/components/formacoes-empresa";

export default function PainelPage() {
  const { user, progresso, progressoDoCurso } = useSession();
  const { cursos, vagas, totalAulas, meusCertificados: certificados } = useDados();

  const emAndamento = cursos
    .map((c) => {
      const p = progressoDoCurso(c.slug);
      if (!p) return null;
      const total = totalAulas(c);
      const pct = Math.round((p.aulasConcluidas.length / total) * 100);
      return { curso: c, pct, concluidas: p.aulasConcluidas.length, total, ultima: p.ultimaAulaId };
    })
    .filter(Boolean)
    .filter((x) => x!.pct < 100)
    .sort((a, b) => b!.pct - a!.pct) as Array<{
      curso: (typeof cursos)[number]; pct: number; concluidas: number; total: number; ultima: string;
    }>;

  const proximo = emAndamento[0];

  // O anel do nível estava travado em 64% e o texto em "+680 XP", para
  // qualquer pessoa. Com 1.000 XP por nível, a conta é direta — e passa a
  // dizer a verdade sobre quem está olhando.
  const xp = user?.pontos ?? 0;
  const nivel = user?.nivel ?? Math.max(1, Math.floor(xp / 1000) + 1);
  const dentroDoNivel = xp % 1000;
  const progressoNivel = dentroDoNivel / 1000;
  const faltamXP = 1000 - dentroDoNivel;
  const horasEstudadas = progresso.reduce((acc, p) => acc + p.aulasConcluidas.length * 0.35, 0);
  const pontosPEPC = certificados.reduce((a, c) => a + c.pontosPEPC, 0);

  return (
    <div className="min-w-0 max-w-full space-y-5 sm:space-y-8">
      {/* Cabeçalho */}
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-gold-500">{saudacao()}</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
            Olá, {user?.nome.split(" ")[0]} 👋
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Você tem {emAndamento.length} curso(s) em andamento e {vagas.filter((v) => (v.match ?? 0) > 80).length} vagas
            com alta compatibilidade.
          </p>
        </div>
        <Button href="/app/cursos" variant="outline" className="w-full sm:w-auto">
          <BookOpen size={15} /> Explorar catálogo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={<Flame size={18} />} valor={`${user?.ofensiva ?? 12} dias`} rotulo="Ofensiva de estudo" tom="gold" />
        <Kpi icon={<Clock size={18} />} valor={`${horasEstudadas.toFixed(1)}h`} rotulo="Horas estudadas" tom="navy" />
        <Kpi icon={<Award size={18} />} valor={`${certificados.length}`} rotulo="Certificados emitidos" tom="teal" />
        <Kpi icon={<Target size={18} />} valor={`${pontosPEPC}/40`} rotulo="Pontos PEPC 2026" tom="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* Continuar assistindo */}
          {proximo && (
            <Card className="w-full overflow-hidden !p-0">
              {/* No celular o botão não cabe ao lado do título: flex-wrap não
                  salvava porque o bloco de texto é flex-1 e encolhia,
                  empurrando o botão para fora da tela. Empilha, e vira linha
                  a partir do sm. */}
              <div
                className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5 sm:p-6"
                style={{ background: `linear-gradient(120deg, ${proximo.curso.cor} 0%, #001838 100%)` }}
              >
                <div className="min-w-0 flex-1">
                  <Badge tone="gold">Continuar de onde parou</Badge>
                  <h2 className="mt-3 text-lg font-bold leading-snug text-white sm:text-xl">{proximo.curso.titulo}</h2>
                  <p className="mt-1 text-sm text-navy-100/65">
                    {proximo.concluidas} de {proximo.total} aulas concluídas
                  </p>
                  <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
                    <div
                      className="gold-gradient h-full rounded-full transition-all"
                      style={{ width: `${proximo.pct}%` }}
                    />
                  </div>
                </div>
                <Button
                  href={`/app/cursos/${proximo.curso.slug}/aula/${proximo.ultima}`}
                  variant="gold"
                  size="lg"
                  className="w-full justify-center sm:w-auto"
                >
                  <PlayCircle size={17} /> Retomar aula
                </Button>
              </div>
            </Card>
          )}

          {/* A revisão do dia vem antes dos cursos: é a tarefa que perde
              valor se ficar para depois — o intervalo é o método. */}
          <CartaoRevisao />

          {/* O que a empresa atribuiu vem logo depois da revisão e antes do
              catálogo: é compromisso com prazo, não sugestão. Some sozinho
              para quem não tem empresa. */}
          <CartaoFormacoesDaEmpresa />

          {/* Cursos em andamento */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-700">Seus cursos</h2>
              <Link href="/app/cursos" className="text-sm font-semibold text-gold-600 hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="space-y-3">
              {emAndamento.map(({ curso, pct, concluidas, total }) => (
                <Link key={curso.slug} href={`/app/cursos/${curso.slug}`}>
                  <Card hover className="flex items-center gap-4 !py-4">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11"
                      style={{ background: curso.cor }}
                    >
                      <BookOpen size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug text-navy-700">{curso.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {concluidas}/{total} aulas · {curso.cargaHoraria}h
                      </p>
                      <Progress value={pct} className="mt-2.5" />
                    </div>
                    <span className="shrink-0 text-sm font-bold text-navy-700">{pct}%</span>
                  </Card>
                </Link>
              ))}
              {emAndamento.length === 0 && (
                <Card className="text-center text-sm text-muted">
                  Nenhum curso em andamento.{" "}
                  <Link href="/app/cursos" className="font-semibold text-gold-600">
                    Comece agora
                  </Link>
                  .
                </Card>
              )}
            </div>
          </div>

          {/* Vagas recomendadas */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-700">Vagas para o seu perfil</h2>
              <Link href="/app/vagas" className="text-sm font-semibold text-gold-600 hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {vagas
                .slice()
                .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
                .slice(0, 2)
                .map((v) => (
                  <Link key={v.id} href="/app/vagas">
                    <Card hover className="h-full">
                      {/* O nome da vaga é o que decide se vale abrir, e dividindo a
                          linha com o selo de match sobrava meia tela: "Analista
                          Fiscal Pleno — Transp…". O selo desceu para junto da
                          faixa salarial e o nome ganhou a largura inteira. */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-snug text-navy-700">{v.titulo}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted">
                          {v.empresa} · {v.cidade}/{v.uf}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-navy-700">{v.faixa}</p>
                        <Badge tone="green">{v.match}% match</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone="muted">{v.modelo}</Badge>
                        <Badge tone="muted">{v.contrato}</Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-5">
          {/* O Tino vem primeiro: no rodapé da coluna ele nunca era visto. */}
          <ConviteTino nome={user?.nome.split(" ")[0]} />

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-700">Progresso gamificado</h3>
              <Trophy size={17} className="text-gold-500" />
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#dce5ec" strokeWidth="3.5" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke="#C89F50" strokeWidth="3.5"
                    strokeDasharray="97.4"
                    strokeDashoffset={97.4 * (1 - progressoNivel)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-navy-700">{nivel}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted">nível</span>
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-navy-700">
                  {xp.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted">XP acumulado</p>
                <p className="mt-1.5 text-xs text-gold-600">
                  +{faltamXP.toLocaleString("pt-BR")} XP para o nível {nivel + 1}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {["🔥", "🎓", "⚡", "🏅"].map((e, i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-xl border border-navy-100 bg-cream text-xl"
                  title="Conquista desbloqueada"
                >
                  {e}
                </div>
              ))}
            </div>
            <Link
              href="/app/conquistas"
              className="mt-3 block text-center text-[11px] font-semibold text-muted transition hover:text-gold-600"
            >
              Ver todas as conquistas
            </Link>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <CalendarDays size={16} className="text-gold-500" /> Próximos eventos
            </h3>
            <div className="mt-4 space-y-3">
              {[
                ["04 SET", "Mentoria ao vivo — Split payment", "19h · Reforma Tributária"],
                ["12 SET", "Workshop: PER/DCOMP na prática", "20h · Recuperação de Créditos"],
                ["25 SET", "Encontro do banco de talentos", "18h · Networking"],
              ].map(([data, titulo, sub]) => (
                <div key={titulo} className="flex gap-3">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-navy-700 text-white">
                    <span className="text-[13px] font-bold leading-none">{data.split(" ")[0]}</span>
                    <span className="text-[8px] uppercase tracking-wider text-gold-300">
                      {data.split(" ")[1]}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-navy-700">{titulo}</p>
                    <p className="text-xs leading-snug text-muted">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon, valor, rotulo, tom,
}: {
  icon: React.ReactNode; valor: string; rotulo: string; tom: "gold" | "navy" | "teal" | "green";
}) {
  const tons: Record<string, string> = {
    gold: "bg-gold-50 text-gold-500",
    navy: "bg-navy-50 text-navy-600",
    teal: "bg-teal/10 text-teal",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <Card className="flex min-w-0 flex-col gap-2.5 !p-3 sm:flex-row sm:items-center sm:gap-4 sm:!p-5">
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
          tons[tom]
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="break-words text-base font-bold leading-tight text-navy-700 sm:text-xl">{valor}</p>
        <p className="text-[10px] leading-tight text-muted sm:text-xs">{rotulo}</p>
      </div>
    </Card>
  );
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
