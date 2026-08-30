"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, CheckCircle2, Filter, Flame, ListChecks, Target,
  TrendingUp, X, XCircle,
} from "lucide-react";
import { Badge, Button, Card, cn, inputCls } from "@/components/ui";
import { AreaLinha, Barras, BarrasRanking, Rosca } from "@/components/graficos";
import { useSession } from "@/lib/session";
import { minhasRespostas } from "@/lib/repo-questoes";
import type { RespostaRegistrada } from "@/lib/types";

/* ==========================================================================
   MEUS RESULTADOS

   O aluno respondia questão e o resultado sumia. Sem histórico, estudar vira
   sensação: "acho que estou melhorando".

   A tela responde três perguntas, nesta ordem de importância:

   1. Onde eu erro mais? — é onde ele deve estudar amanhã.
   2. Estou melhorando? — a linha de aproveitamento ao longo do tempo.
   3. Quanto eu estudei? — volume por dia, que é o que ele controla.

   O ranking de assuntos é ordenado por ERRO, não por acerto. Lista de acertos
   é troféu; lista de erros é plano de estudo.
   ========================================================================== */

const PERIODOS = [
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["ano", "Este ano"],
  ["tudo", "Tudo"],
  ["custom", "Escolher datas"],
] as const;

type Periodo = (typeof PERIODOS)[number][0];

/** `2026-08-29` a partir de um Date local — `toISOString` volta em UTC e, à
 *  noite, devolve o dia seguinte. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ResultadosPage() {
  const { user, modoDemo } = useSession();
  const [respostas, setRespostas] = useState<RespostaRegistrada[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [de, setDe] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return iso(d);
  });
  const [ate, setAte] = useState(() => iso(new Date()));
  const [area, setArea] = useState("");
  const [assunto, setAssunto] = useState("");
  const [nivel, setNivel] = useState("");
  const [acerto, setAcerto] = useState<"" | "certas" | "erradas">("");

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    setRespostas(await minhasRespostas(user.id));
    setCarregando(false);
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const desde = useMemo(() => {
    if (periodo === "custom") {
      const d = new Date(`${de}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (periodo === "7d") d.setDate(d.getDate() - 6);
    else if (periodo === "30d") d.setDate(d.getDate() - 29);
    else if (periodo === "90d") d.setDate(d.getDate() - 89);
    else if (periodo === "ano") d.setMonth(0, 1);
    else return null;
    return d;
  }, [periodo, de]);

  // O fim entra às 23:59:59 do dia escolhido: sem isso, escolher 29/08 como
  // fim descartaria tudo o que a pessoa respondeu no próprio dia 29.
  const ateData = useMemo(() => {
    if (periodo !== "custom") return null;
    const d = new Date(`${ate}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [periodo, ate]);

  // O recorte de período vale para todos os números da tela. Se o filtro
  // valesse só para o gráfico, o KPI ao lado contaria outra história.
  const noPeriodo = useMemo(
    () =>
      respostas.filter((r) => {
        const d = new Date(r.criadoEm);
        if (desde && d < desde) return false;
        if (ateData && d > ateData) return false;
        return true;
      }),
    [respostas, desde, ateData]
  );

  const areas = useMemo(
    () => [...new Set(noPeriodo.map((r) => r.area))].sort(),
    [noPeriodo]
  );
  const assuntos = useMemo(
    () =>
      [
        ...new Set(
          noPeriodo.filter((r) => !area || r.area === area).map((r) => r.assunto)
        ),
      ].sort(),
    [noPeriodo, area]
  );

  const filtradas = useMemo(
    () =>
      noPeriodo.filter((r) => {
        if (area && r.area !== area) return false;
        if (assunto && r.assunto !== assunto) return false;
        if (nivel && r.nivel !== nivel) return false;
        if (acerto === "certas" && !r.correta) return false;
        if (acerto === "erradas" && r.correta) return false;
        return true;
      }),
    [noPeriodo, area, assunto, nivel, acerto]
  );

  const total = filtradas.length;
  const acertos = filtradas.filter((r) => r.correta).length;
  const erros = total - acertos;
  const pct = total ? Math.round((acertos / total) * 100) : 0;

  const diasEstudados = new Set(filtradas.map((r) => r.criadoEm.slice(0, 10))).size;
  const tempoMedio = (() => {
    const comTempo = filtradas.filter((r) => r.segundos);
    if (!comTempo.length) return null;
    return Math.round(
      comTempo.reduce((a, r) => a + (r.segundos ?? 0), 0) / comTempo.length
    );
  })();

  /* ------------------------------------------------------- agregações --- */
  const porDia = useMemo(() => agrupePorDia(filtradas, desde), [filtradas, desde]);

  const evolucao = useMemo(() => {
    // Semanas fechadas: dia a dia o aproveitamento oscila demais para se ler
    // como tendência — com três questões respondidas, um erro derruba 33%.
    const mapa = new Map<string, { total: number; acertos: number }>();
    for (const r of filtradas) {
      const d = new Date(r.criadoEm);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const chave = d.toISOString().slice(0, 10);
      const atual = mapa.get(chave) ?? { total: 0, acertos: 0 };
      atual.total += 1;
      if (r.correta) atual.acertos += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([dia, v]) => ({
        rotulo: new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        valor: Math.round((v.acertos / v.total) * 100),
      }));
  }, [filtradas]);

  const porArea = useMemo(() => agrupe(filtradas, (r) => r.area), [filtradas]);
  const porAssunto = useMemo(() => agrupe(filtradas, (r) => r.assunto), [filtradas]);
  const porNivel = useMemo(() => agrupe(filtradas, (r) => r.nivel), [filtradas]);

  const filtroLigado = Boolean(area || assunto || nivel || acerto);

  if (carregando) {
    return <p className="py-16 text-center text-sm text-muted">Carregando seu histórico…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/app/questoes"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
          >
            <ArrowLeft size={15} /> Questões
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-700">
            Meus resultados
          </h1>
          <p className="mt-1 text-sm text-muted">
            {respostas.length === 0
              ? "Você ainda não respondeu questões."
              : `${respostas.length} questões respondidas no total.`}
          </p>
        </div>

        <Button href="/app/questoes" variant="gold" size="sm">
          <ListChecks size={15} /> Praticar agora
        </Button>
      </div>

      {modoDemo && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-600">
          Modo demonstração: o histórico abaixo é sintético, gerado para a
          apresentação. Com o Supabase ligado, ele lê as suas respostas reais.
        </p>
      )}

      {/* Filtros */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <CalendarDays size={13} /> Período
          </span>
          {PERIODOS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriodo(k)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                periodo === k
                  ? "border-navy-700 bg-navy-700 text-white"
                  : "border-navy-100 text-muted hover:border-navy-200"
              )}
            >
              {label}
            </button>
          ))}

          {periodo === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={de}
                max={ate}
                onChange={(e) => setDe(e.target.value)}
                aria-label="Data inicial"
                className={cn(inputCls, "!w-auto !py-1.5 text-xs")}
              />
              <span className="text-xs text-muted">até</span>
              <input
                type="date"
                value={ate}
                min={de}
                max={iso(new Date())}
                onChange={(e) => setAte(e.target.value)}
                aria-label="Data final"
                className={cn(inputCls, "!w-auto !py-1.5 text-xs")}
              />
              <span className="text-xs text-muted">
                {(() => {
                  const dias =
                    Math.round(
                      (new Date(`${ate}T00:00:00`).getTime() -
                        new Date(`${de}T00:00:00`).getTime()) /
                        86400000
                    ) + 1;
                  return Number.isFinite(dias) && dias > 0
                    ? `${dias} ${dias === 1 ? "dia" : "dias"}`
                    : "período inválido";
                })()}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setAssunto("");
            }}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <select
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todos os assuntos</option>
            {assuntos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todos os níveis</option>
            {["Iniciante", "Intermediário", "Avançado"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>

          <select
            value={acerto}
            onChange={(e) => setAcerto(e.target.value as typeof acerto)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Acertos e erros</option>
            <option value="certas">Só o que acertei</option>
            <option value="erradas">Só o que errei</option>
          </select>

          {filtroLigado && (
            <button
              onClick={() => {
                setArea("");
                setAssunto("");
                setNivel("");
                setAcerto("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted transition hover:text-navy-700"
            >
              <X size={13} /> Limpar
            </button>
          )}

          {filtroLigado && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Filter size={12} /> {filtradas.length} de {noPeriodo.length} no período
            </span>
          )}
        </div>
      </Card>

      {total === 0 ? (
        <Card className="text-center">
          <ListChecks size={30} className="mx-auto text-navy-200" />
          <p className="mt-3 text-sm font-semibold text-navy-700">
            Nada respondido neste recorte
          </p>
          <p className="mt-1 text-xs text-muted">
            Amplie o período ou limpe os filtros. Se você ainda não praticou,
            comece por qualquer assunto — a estatística nasce na primeira questão.
          </p>
          <Button href="/app/questoes" variant="gold" size="sm" className="mt-4">
            Ir para as questões
          </Button>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icone={<Target size={17} />}
              valor={`${pct}%`}
              rotulo="Aproveitamento"
              detalhe={`${acertos} de ${total}`}
              tom={pct >= 70 ? "verde" : pct >= 50 ? "ouro" : "vermelho"}
            />
            <Kpi
              icone={<CheckCircle2 size={17} />}
              valor={String(acertos)}
              rotulo="Acertos"
              detalhe={total ? `${Math.round((acertos / total) * 100)}% do total` : ""}
              tom="verde"
            />
            <Kpi
              icone={<XCircle size={17} />}
              valor={String(erros)}
              rotulo="Erros"
              detalhe={erros ? "o seu plano de estudo" : "nenhum no período"}
              tom="vermelho"
            />
            <Kpi
              icone={<Flame size={17} />}
              valor={String(diasEstudados)}
              rotulo={diasEstudados === 1 ? "Dia de estudo" : "Dias de estudo"}
              detalhe={tempoMedio ? `${tempoMedio}s por questão` : ""}
              tom="navy"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* Volume por dia */}
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-navy-700">Questões por dia</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Constância pesa mais que maratona.
                  </p>
                </div>
                <Badge tone="navy">{total} no período</Badge>
              </div>
              <div className="mt-5">
                <Barras
                  rotulos={porDia.map((d) => d.rotulo)}
                  valores={porDia.map((d) => d.valor)}
                  altura={190}
                  formatar={(v) => String(v)}
                />
              </div>
            </Card>

            {/* Acerto x erro */}
            <Card>
              <h2 className="text-sm font-bold text-navy-700">Acertos e erros</h2>
              <p className="mt-0.5 text-xs text-muted">Distribuição no recorte atual.</p>
              <div className="mt-4 flex justify-center">
                <Rosca
                  fatias={[
                    { rotulo: "Acertos", valor: acertos, cor: "#2F9E68" },
                    { rotulo: "Erros", valor: erros, cor: "#C4543F" },
                  ]}
                  tamanho={168}
                />
              </div>
            </Card>
          </div>

          {/* Evolução */}
          {evolucao.length >= 2 && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                    <TrendingUp size={15} className="text-gold-500" /> Aproveitamento por
                    semana
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Semana fechada, não dia a dia: com poucas questões, um erro
                    derruba o percentual e some com a tendência.
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <AreaLinha
                  rotulos={evolucao.map((e) => e.rotulo)}
                  valores={evolucao.map((e) => e.valor)}
                  altura={200}
                  formatar={(v) => `${v}%`}
                />
              </div>
            </Card>
          )}

          {/* Onde erra mais */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-bold text-navy-700">Assuntos que mais derrubam</h2>
              <p className="mt-0.5 text-xs text-muted">
                Ordenado por quantidade de erro — é por aqui que vale começar.
              </p>
              <div className="mt-4">
                <BarrasRanking
                  itens={porAssunto
                    .filter((a) => a.total - a.acertos > 0)
                    .sort((a, b) => b.total - b.acertos - (a.total - a.acertos))
                    .slice(0, 6)
                    .map((a) => ({
                      rotulo: a.chave,
                      valor: a.total - a.acertos,
                      detalhe: `${Math.round((a.acertos / a.total) * 100)}% de acerto em ${a.total}`,
                    }))}
                  formatar={(v) => `${v} ${v === 1 ? "erro" : "erros"}`}
                />
                {porAssunto.every((a) => a.total === a.acertos) && (
                  <p className="py-6 text-center text-sm text-emerald-600">
                    Nenhum erro no recorte. Suba o nível do filtro.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-bold text-navy-700">Aproveitamento por área</h2>
              <p className="mt-0.5 text-xs text-muted">
                Percentual de acerto em cada área do recorte.
              </p>
              <div className="mt-4">
                <BarrasRanking
                  itens={porArea
                    .sort((a, b) => b.acertos / b.total - a.acertos / a.total)
                    .map((a) => ({
                      rotulo: a.chave,
                      valor: Math.round((a.acertos / a.total) * 100),
                      detalhe: `${a.acertos} de ${a.total}`,
                    }))}
                  formatar={(v) => `${v}%`}
                />
              </div>
            </Card>
          </div>

          {/* Por nível */}
          <Card>
            <h2 className="text-sm font-bold text-navy-700">Desempenho por nível</h2>
            <p className="mt-0.5 text-xs text-muted">
              Cair no avançado é esperado; cair no iniciante é sinal de base.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Iniciante", "Intermediário", "Avançado"].map((n) => {
                const linha = porNivel.find((x) => x.chave === n);
                const p = linha ? Math.round((linha.acertos / linha.total) * 100) : null;
                return (
                  <div key={n} className="rounded-xl border border-navy-100 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">{n}</p>
                    {p === null ? (
                      <p className="mt-2 text-sm text-muted">Sem respostas</p>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "mt-1 text-2xl font-bold",
                            p >= 70
                              ? "text-emerald-600"
                              : p >= 50
                                ? "text-gold-600"
                                : "text-red-600"
                          )}
                        >
                          {p}%
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              p >= 70
                                ? "bg-emerald-500"
                                : p >= 50
                                  ? "bg-gold-400"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted">
                          {linha!.acertos} de {linha!.total}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- peças -- */
function Kpi({
  icone, valor, rotulo, detalhe, tom,
}: {
  icone: React.ReactNode;
  valor: string;
  rotulo: string;
  detalhe?: string;
  tom: "verde" | "vermelho" | "ouro" | "navy";
}) {
  const cores = {
    verde: "bg-emerald-50 text-emerald-600",
    vermelho: "bg-red-50 text-red-600",
    ouro: "bg-gold-50 text-gold-600",
    navy: "bg-navy-50 text-navy-600",
  }[tom];

  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", cores)}>
          {icone}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold text-navy-700">{valor}</p>
          <p className="text-[11px] text-muted">{rotulo}</p>
        </div>
      </div>
      {detalhe && <p className="mt-2 truncate text-[11px] text-muted">{detalhe}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------- apoio ---- */
function agrupe(
  lista: RespostaRegistrada[],
  chaveDe: (r: RespostaRegistrada) => string
) {
  const mapa = new Map<string, { total: number; acertos: number }>();
  for (const r of lista) {
    const k = chaveDe(r);
    const atual = mapa.get(k) ?? { total: 0, acertos: 0 };
    atual.total += 1;
    if (r.correta) atual.acertos += 1;
    mapa.set(k, atual);
  }
  return [...mapa.entries()].map(([chave, v]) => ({ chave, ...v }));
}

/**
 * Série diária com os dias vazios preenchidos.
 *
 * Sem os zeros, três dias de estudo em um mês viram três barras coladas e a
 * pessoa parece ter estudado todo dia.
 */
function agrupePorDia(lista: RespostaRegistrada[], desde: Date | null) {
  const contagem = new Map<string, number>();
  for (const r of lista) {
    const k = r.criadoEm.slice(0, 10);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }

  const inicio = desde ?? menorData(lista);
  if (!inicio) return [];

  const dias: Array<{ rotulo: string; valor: number }> = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const cursor = new Date(inicio);
  // Acima de ~60 barras a leitura vira ruído: agrupa por semana.
  const distancia = Math.round((hoje.getTime() - cursor.getTime()) / 86400000);
  const passo = distancia > 60 ? 7 : 1;

  while (cursor <= hoje) {
    let soma = 0;
    for (let i = 0; i < passo; i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      soma += contagem.get(d.toISOString().slice(0, 10)) ?? 0;
    }
    dias.push({
      rotulo: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      valor: soma,
    });
    cursor.setDate(cursor.getDate() + passo);
  }
  return dias;
}

function menorData(lista: RespostaRegistrada[]): Date | null {
  if (!lista.length) return null;
  const min = lista.reduce(
    (a, r) => (r.criadoEm < a ? r.criadoEm : a),
    lista[0].criadoEm
  );
  const d = new Date(min);
  d.setHours(0, 0, 0, 0);
  return d;
}
