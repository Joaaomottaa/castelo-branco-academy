"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Award, Building2, CalendarClock, CheckCircle2,
  ClipboardList, Clock, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Progress, cn } from "@/components/ui";
import {
  carregarEquipe, carregarFormacoes, carregarResumoEmpresa,
  type Formacao, type MembroEquipe, type ResumoEmpresa,
} from "@/lib/repo-empresa";
import { useEmpresa } from "./contexto";

/* ==========================================================================
   PAINEL DA EMPRESA

   A pergunta que um gestor faz ao abrir isto não é "quantas horas o time
   estudou". É "de quem eu preciso cobrar hoje". O painel responde nessa ordem:
   primeiro o que está fora do lugar, depois os números do ano.

   A meta de 40 pontos por pessoa vem da Resolução CFC 1.377/2011. É o número
   que o escritório precisa fechar até dezembro, e é por isso que ele está no
   topo e não numa aba de relatório.
   ========================================================================== */

export default function PainelEmpresa() {
  const { empresa } = useEmpresa();
  const [resumo, setResumo] = useState<ResumoEmpresa | null>(null);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void Promise.all([carregarResumoEmpresa(), carregarEquipe(), carregarFormacoes()])
      .then(([r, e, f]) => {
        if (!ativo) return;
        setResumo(r);
        setEquipe(e);
        setFormacoes(f);
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  const atrasados = useMemo(
    () => equipe.filter((m) => m.formacoesAtrasadas > 0)
      .sort((a, b) => b.formacoesAtrasadas - a.formacoesAtrasadas),
    [equipe]
  );

  const parados = useMemo(
    () => equipe.filter((m) => diasSem(m.ultimoEstudo) >= 30)
      .sort((a, b) => diasSem(b.ultimoEstudo) - diasSem(a.ultimoEstudo)),
    [equipe]
  );

  const pctPepc = resumo && resumo.metaPepc > 0
    ? Math.min(100, Math.round((resumo.pontosPepcAno / resumo.metaPepc) * 100))
    : 0;

  return (
    <div className="space-y-7">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14"
            style={{ background: `linear-gradient(135deg, ${empresa.cor ?? "#00204D"}, #0d3563)` }}
          >
            <Building2 size={26} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-gold-500">Painel da empresa</p>
            <h1 className="text-xl font-bold leading-snug tracking-tight text-navy-700 sm:text-2xl">{empresa.nome}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {empresa.segmento && <span>{empresa.segmento}</span>}
              {empresa.cidade && <span>· {empresa.cidade}/{empresa.uf}</span>}
              <Badge tone="gold">
                {empresa.licencas.usadas}/{empresa.licencas.contratadas} licenças
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/empresa/equipe" variant="gold" size="sm">
            <UserPlus size={15} /> Convidar pessoa
          </Button>
          <Button href="/empresa/formacoes" variant="ghost" size="sm">
            <ClipboardList size={15} /> Atribuir formação
          </Button>
        </div>
      </div>

      {/* O que precisa de atenção */}
      {!carregando && (atrasados.length > 0 || parados.length > 0 || empresa.licencas.livres > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {atrasados.length > 0 && (
            <Alerta
              tom="vermelho"
              icone={<AlertTriangle size={17} />}
              titulo={`${atrasados.length} pessoa(s) com formação atrasada`}
              texto={atrasados.slice(0, 3).map((m) => m.nome.split(" ")[0]).join(", ")
                + (atrasados.length > 3 ? ` e mais ${atrasados.length - 3}` : "")}
              href="/empresa/formacoes"
              acao="Ver formações"
            />
          )}
          {parados.length > 0 && (
            <Alerta
              tom="ambar"
              icone={<Clock size={17} />}
              titulo={`${parados.length} pessoa(s) sem estudar há 30 dias`}
              texto="Licença parada é dinheiro parado. Vale conversar ou realocar o assento."
              href="/empresa/equipe"
              acao="Ver equipe"
            />
          )}
          {empresa.licencas.livres > 0 && (
            <Alerta
              tom="ouro"
              icone={<UserPlus size={17} />}
              titulo={`${empresa.licencas.livres} assento(s) livre(s)`}
              texto="Você já pagou por eles. Convide quem ainda está de fora do time."
              href="/empresa/equipe"
              acao="Convidar"
            />
          )}
        </div>
      )}

      {/* Números do ano */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Metrica
          icone={<Users size={18} />}
          rotulo="Pessoas no time"
          valor={resumo?.membros ?? empresa.membros}
          nota={`${resumo?.ativos7d ?? 0} estudaram nos últimos 7 dias`}
        />
        <Metrica
          icone={<Clock size={18} />}
          rotulo={`Horas estudadas em ${resumo?.ano ?? new Date().getFullYear()}`}
          valor={resumo?.horasAno ?? 0}
          sufixo="h"
          nota={
            resumo && resumo.membros > 0
              ? `${(resumo.horasAno / resumo.membros).toFixed(1)}h por pessoa`
              : "—"
          }
        />
        <Metrica
          icone={<Award size={18} />}
          rotulo="Certificados no ano"
          valor={resumo?.certificadosAno ?? 0}
          nota="Com código público de validação"
        />
        <Metrica
          icone={<TrendingUp size={18} />}
          rotulo="Pontos PEPC do time"
          valor={resumo?.pontosPepcAno ?? 0}
          nota={`Meta do ano: ${resumo?.metaPepc ?? 0} pts`}
        />
      </div>

      {/* Conformidade PEPC */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-navy-700">
              Educação continuada — {resumo?.ano ?? new Date().getFullYear()}
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              A Resolução CFC 1.377/2011 pede 40 pontos por profissional no ano. Aqui é
              a soma do time inteiro; o detalhe por pessoa, com o código de cada
              certificado, está no relatório.
            </p>
          </div>
          <Button href="/empresa/relatorios" variant="ghost" size="sm">
            Abrir relatório <ArrowRight size={14} />
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-navy-700">
                {resumo?.pontosPepcAno ?? 0} de {resumo?.metaPepc ?? 0} pontos
              </span>
              <span className="tabular-nums text-muted">{pctPepc}%</span>
            </div>
            <Progress value={pctPepc} className="mt-2 h-2" />
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-cream/70 px-4 py-3">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-navy-700">
                {resumo?.emDia ?? 0} de {resumo?.membros ?? 0}
              </p>
              <p className="text-[11px] text-muted">já bateram os 40 pontos</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Formações em andamento */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-navy-700">Formações atribuídas</h2>
          <Link
            href="/empresa/formacoes"
            className="text-xs font-semibold text-gold-600 transition hover:text-gold-500"
          >
            Gerenciar
          </Link>
        </div>

        {carregando ? (
          <Card><p className="text-sm text-muted">Carregando…</p></Card>
        ) : formacoes.length === 0 ? (
          <Card className="text-center">
            <ClipboardList size={22} className="mx-auto text-navy-300" />
            <p className="mt-2.5 text-sm font-semibold text-navy-700">
              Nenhuma formação atribuída ainda
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
              Dar acesso é metade do trabalho. Atribuir uma trilha com prazo é o que
              transforma assinatura em plano de desenvolvimento.
            </p>
            <div className="mt-4">
              <Button href="/empresa/formacoes" variant="gold" size="sm">
                Atribuir a primeira <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {formacoes.slice(0, 4).map((f) => (
              <CartaoFormacao key={f.id} f={f} />
            ))}
          </div>
        )}
      </div>

      {/* Quem precisa de atenção */}
      {!carregando && equipe.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-navy-700">Ritmo da equipe</h2>
            <Link
              href="/empresa/equipe"
              className="text-xs font-semibold text-gold-600 transition hover:text-gold-500"
            >
              Ver todos
            </Link>
          </div>
          <Card className="!p-0 overflow-hidden">
            <div className="divide-y divide-navy-100">
              {[...equipe]
                .sort((a, b) => diasSem(b.ultimoEstudo) - diasSem(a.ultimoEstudo))
                .slice(0, 5)
                .map((m) => (
                  <div key={m.perfilId} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <Avatar nome={m.nome} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-700">{m.nome}</p>
                      <p className="text-xs text-muted leading-snug">
                        {m.cargo ?? "Sem cargo"} · {textoUltimoEstudo(m.ultimoEstudo)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-bold tabular-nums text-navy-700">{m.horasAno}h</p>
                        <p className="text-[10px] text-muted">no ano</p>
                      </div>
                      <div>
                        <p className={cn(
                          "text-sm font-bold tabular-nums",
                          m.pontosPepcAno >= 40 ? "text-emerald-600" : "text-navy-700"
                        )}>
                          {m.pontosPepcAno}
                        </p>
                        <p className="text-[10px] text-muted">pts PEPC</p>
                      </div>
                      {m.formacoesAtrasadas > 0 && (
                        <Badge tone="red">{m.formacoesAtrasadas} atrasada(s)</Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- peças ----- */

function Metrica({
  icone, rotulo, valor, sufixo, nota,
}: {
  icone: React.ReactNode; rotulo: string; valor: number | string;
  sufixo?: string; nota?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-gold-500">{icone}</div>
      <p className="mt-3 text-xl font-bold tabular-nums tracking-tight text-navy-700 sm:text-2xl">
        {valor}{sufixo}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase leading-snug tracking-wide text-navy-600">{rotulo}</p>
      {nota && <p className="mt-1.5 text-xs text-muted">{nota}</p>}
    </Card>
  );
}

function Alerta({
  tom, icone, titulo, texto, href, acao,
}: {
  tom: "vermelho" | "ambar" | "ouro";
  icone: React.ReactNode; titulo: string; texto: string; href: string; acao: string;
}) {
  const tons = {
    vermelho: "border-red-200 bg-red-50 text-red-700",
    ambar: "border-amber-200 bg-amber-50 text-amber-700",
    ouro: "border-gold-200 bg-gold-50 text-gold-600",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tons[tom])}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icone}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy-700">{titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed">{texto}</p>
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-navy-700 underline underline-offset-2"
          >
            {acao} <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartaoFormacao({ f }: { f: Formacao }) {
  const total = f.pessoas.length;
  const feitos = f.pessoas.filter((p) => p.concluido).length;
  const atrasados = f.pessoas.filter((p) => p.atrasado).length;
  const media = total > 0 ? Math.round(f.pessoas.reduce((a, p) => a + p.pct, 0) / total) : 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={f.tipo === "trilha" ? "teal" : "navy"}>
              {f.tipo === "trilha" ? "Trilha" : "Curso"}
            </Badge>
            {f.obrigatoria && <Badge tone="gold">Obrigatória</Badge>}
            {!f.paraTime && <Badge tone="muted">Individual</Badge>}
          </div>
          <p className="mt-2 font-bold leading-snug text-navy-700">{f.titulo}</p>
        </div>
        {f.prazo && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted">
            <CalendarClock size={12} /> {dataCurta(f.prazo)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between text-xs">
        <span className="text-muted">
          {feitos} de {total} concluíram
          {atrasados > 0 && <span className="text-red-600"> · {atrasados} atrasado(s)</span>}
        </span>
        <span className="font-semibold tabular-nums text-navy-700">{media}%</span>
      </div>
      <Progress value={media} className="mt-1.5" tone={atrasados > 0 ? "navy" : "gold"} />
    </Card>
  );
}

/* ---------------------------------------------------------- utilidades --- */

function diasSem(iso?: string): number {
  if (!iso) return 999;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return Number.isFinite(d) ? d : 999;
}

function textoUltimoEstudo(iso?: string): string {
  const d = diasSem(iso);
  if (d >= 999) return "nunca estudou";
  if (d === 0) return "estudou hoje";
  if (d === 1) return "estudou ontem";
  return `há ${d} dias sem estudar`;
}

function dataCurta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short",
  });
}
