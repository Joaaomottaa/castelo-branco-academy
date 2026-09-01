"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowUpRight, Award, Briefcase, CheckCircle2,
  DollarSign, Download, GraduationCap, Info, RefreshCw, TrendingDown,
  TrendingUp, Users, Wrench,
} from "lucide-react";
import { Badge, Button, Card, Progress, cn } from "@/components/ui";
import { AreaLinha, Barras, BarrasRanking, Funil, Rosca } from "@/components/graficos";
import {
  METRICAS, MESES, PERIODOS, carregarMetricas, variacao,
  type ChaveMetrica, type Metricas, type ModoMetricas, type Periodo,
} from "@/lib/metricas";
import { useSession } from "@/lib/session";

/* ==========================================================================
   VISÃO GERAL

   Montado em volta de três perguntas que o CEO faz, nessa ordem: estamos
   crescendo? onde o funil vaza? o que a base está pedindo?

   Toda métrica derivada de modelo (visitantes, MRR) aparece marcada como
   estimativa. Painel que mistura medido com chute sem avisar destrói a
   confiança na primeira vez que alguém confere.
   ========================================================================== */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const selectCls =
  "rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-700 outline-none transition focus:border-gold-400";

export default function AdminPage() {
  const { modoDemo } = useSession();
  const anoAtual = new Date().getFullYear();

  const [ano, setAno] = useState(anoAtual);
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const [mes, setMes] = useState(new Date().getMonth());
  const [modo, setModo] = useState<ModoMetricas>(modoDemo ? "demo" : "real");
  const [metrica, setMetrica] = useState<ChaveMetrica>("matriculas");
  const [m, setM] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setM(await carregarMetricas({ ano, periodo, mes, modo }));
    setCarregando(false);
  }, [ano, periodo, mes, modo]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const definicao = useMemo(
    () => METRICAS.find((x) => x.v === metrica) ?? METRICAS[0],
    [metrica]
  );

  if (carregando || !m) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-navy-100" />
        <div className="h-14 animate-pulse rounded-2xl bg-navy-100/50" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-navy-100/60" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-2xl bg-navy-100/40" />
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-navy-100/40" />
      </div>
    );
  }

  const valores = m.serie.valores[metrica] ?? [];
  const ehMoeda = Boolean(definicao.moeda);
  const formatar = ehMoeda ? brl : (v: number) => v.toLocaleString("pt-BR");

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold-500">Área administrativa</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-700">Visão geral</h1>
          <p className="mt-0.5 text-xs text-muted">
            {m.rotuloJanela}
            {m.periodo !== "mes" && m.periodo !== "ano" && ` · ${ano}`}
            {m.modo === "demo" && " · cenário de demonstração"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={recarregar}>
            <RefreshCw size={14} /> Atualizar
          </Button>
          <Button href="/admin/cursos" variant="gold" size="sm">Gerenciar cursos</Button>
        </div>
      </div>

      {m.erro && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Não foi possível ler os dados reais ({m.erro}). Mostrando o cenário de demonstração.</span>
        </div>
      )}

      {/* --------------------------------------------------------- filtros */}
      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className={selectCls}
            aria-label="Ano"
          >
            {m.anosDisponiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <div className="flex flex-wrap rounded-lg border border-navy-100 p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriodo(p.v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition",
                  periodo === p.v ? "bg-navy-700 text-white" : "text-muted hover:text-navy-700"
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          {periodo === "mes" && (
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className={selectCls}
              aria-label="Mês"
            >
              {MESES.map((nome, i) => (
                <option key={nome} value={i}>{nome}</option>
              ))}
            </select>
          )}

          {/* No celular este par não cabe na mesma linha dos períodos: ele passa
              a ocupar a linha inteira, com o botão de baixar na ponta. */}
          <div className="ml-auto flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <div className="flex rounded-full border border-navy-100 p-0.5">
              {(["real", "demo"] as ModoMetricas[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setModo(k)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                    modo === k ? "bg-navy-700 text-white" : "text-muted hover:text-navy-700"
                  )}
                >
                  {k === "real" ? "Dados reais" : "Demonstração"}
                </button>
              ))}
            </div>
            <button
              onClick={() => baixarCSV(m)}
              title="Baixar os números do período em CSV"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
            >
              <Download size={15} />
            </button>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------- KPIs + base por plano */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3">
          <Kpi
            icone={<Users size={15} />}
            rotulo="Matrículas"
            valor={m.totais.matriculas.toLocaleString("pt-BR")}
            variacao={variacao(m.totais.matriculas, m.totaisAnterior.matriculas)}
            nota={`Mesmo recorte em ${ano - 1}: ${m.totaisAnterior.matriculas.toLocaleString("pt-BR")}`}
          />
          <Kpi
            icone={<DollarSign size={15} />}
            rotulo="Receita recorrente"
            valor={brl(m.totais.receita)}
            variacao={variacao(m.totais.receita, m.totaisAnterior.receita)}
            estimado
            nota={m.receita.nota}
          />
          <Kpi
            icone={<Award size={15} />}
            rotulo="Certificados"
            valor={m.totais.certificados.toLocaleString("pt-BR")}
            variacao={variacao(m.totais.certificados, m.totaisAnterior.certificados)}
            nota="Emitidos por trigger no banco, ao concluir 100% do curso"
          />
          <Kpi
            icone={<GraduationCap size={15} />}
            rotulo="Novos cadastros"
            valor={m.totais.cadastros.toLocaleString("pt-BR")}
            variacao={variacao(m.totais.cadastros, m.totaisAnterior.cadastros)}
            nota="Perfis criados no recorte"
          />
        </div>

        <Card className="!p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
            Base por plano
          </h2>
          <Rosca fatias={m.planos} tamanho={122} />
        </Card>
      </div>

      {/* ------------------------------------------- gráfico + funil */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <Card className="!p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <select
                value={metrica}
                onChange={(e) => setMetrica(e.target.value as ChaveMetrica)}
                className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm font-bold text-navy-700 outline-none transition focus:border-gold-400"
                aria-label="Métrica do gráfico"
              >
                {METRICAS.map((x) => (
                  <option key={x.v} value={x.v}>{x.rotulo}</option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {m.serie.gran === "dia" ? "por dia"
                  : m.serie.gran === "semana" ? "por semana"
                    : "por mês"}
              </span>
            </div>
            <Comparativo
              atual={m.totais[metrica]}
              anterior={m.totaisAnterior[metrica]}
              formatar={formatar}
              ano={ano}
            />
          </div>

          {ehMoeda ? (
            <AreaLinha
              rotulos={m.serie.rotulos}
              valores={valores}
              cor={definicao.cor}
              altura={230}
              formatar={formatar}
            />
          ) : (
            <Barras
              rotulos={m.serie.rotulos}
              valores={valores}
              cor={definicao.cor}
              altura={230}
              formatar={formatar}
            />
          )}
        </Card>

        <Card className="!p-4">
          <div className="mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-navy-600">
              Funil de conversão
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              A taxa entre as etapas mostra onde a operação perde gente
            </p>
          </div>
          <Funil etapas={m.funil} />
        </Card>
      </div>

      {/* ----------------------------------- cursos + ferramentas e saúde */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <Card className="!p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-navy-600">
              Desempenho por curso
            </h2>
            <Link href="/admin/cursos" className="text-xs font-semibold text-gold-600 hover:underline">
              Gerenciar
            </Link>
          </div>
          {/* Quatro colunas não cabem em 280px. Rolar a tabela de lado resolve o
              corte mas deixa o nome do curso pela metade na primeira olhada — e
              o nome é o que identifica a linha. No celular cada curso vira um
              bloco com o nome inteiro em cima e os três números embaixo; do
              `sm` para cima é a mesma tabela de sempre. */}
          <div className="space-y-3 sm:hidden">
            {m.cursos.map((c) => (
              <div key={c.titulo} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md" style={{ background: c.cor }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug text-navy-700">{c.titulo}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={c.conclusao} className="flex-1" tone={c.conclusao > 65 ? "green" : "gold"} />
                    <span className="text-[11px] font-semibold tabular-nums text-navy-700">
                      {c.conclusao}%
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    <span className="tabular-nums">{c.alunos.toLocaleString("pt-BR")} alunos</span>
                    <span className="tabular-nums">nota {c.nota.toFixed(1)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="pb-2 font-semibold">Curso</th>
                  <th className="pb-2 font-semibold">Alunos</th>
                  <th className="pb-2 font-semibold">Conclusão</th>
                  <th className="pb-2 text-right font-semibold">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {m.cursos.map((c) => (
                  <tr key={c.titulo}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="h-6 w-6 shrink-0 rounded-md" style={{ background: c.cor }} />
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-navy-700">
                          {c.titulo}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-[13px] tabular-nums text-muted">
                      {c.alunos.toLocaleString("pt-BR")}
                    </td>
                    <td className="w-28 py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <Progress value={c.conclusao} className="flex-1" tone={c.conclusao > 65 ? "green" : "gold"} />
                        <span className="text-[11px] font-semibold tabular-nums text-navy-700">
                          {c.conclusao}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-[13px] font-semibold tabular-nums text-navy-700">
                      {c.nota.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="!p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <Wrench size={13} className="text-gold-500" /> Ferramentas mais usadas
            </h2>
            <BarrasRanking itens={m.ferramentas.slice(0, 6)} />
            {m.ferramentas.length > 0 && (
              <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[10px] leading-relaxed text-muted">
                <strong className="text-navy-700">Leitura comercial:</strong> a calculadora
                mais aberta é demanda declarada. Se for a de importação, existe público para
                curso de comex antes de qualquer pesquisa.
              </p>
            )}
          </Card>

          <Card className="!p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <Activity size={13} className="text-gold-500" /> Saúde da operação
            </h2>
            <div className="space-y-2.5">
              {m.saude.map((s) => (
                <div key={s.rotulo} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      s.estado === "ok" && "bg-emerald-50 text-emerald-600",
                      s.estado === "atencao" && "bg-gold-50 text-gold-600",
                      s.estado === "critico" && "bg-red-50 text-red-600"
                    )}
                  >
                    {s.estado === "ok" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* "Aprovação nas avaliações" não cabe numa linha ao lado do
                        número no celular: o rótulo quebra e o número acompanha. */}
                    <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px] font-semibold text-navy-700">
                      <span className="min-w-0 leading-snug">{s.rotulo}</span>
                      <span className="shrink-0 tabular-nums">{s.valor}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{s.detalhe}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="!p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
              <Briefcase size={13} className="text-gold-500" /> Banco de talentos
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-cream p-3">
                <p className="text-lg font-bold text-navy-700">{m.vagas.valor}</p>
                <p className="text-[10px] text-muted">Vagas ativas</p>
              </div>
              <div className="rounded-lg bg-cream p-3">
                <p className="text-lg font-bold text-navy-700">
                  {m.totais.candidaturas.toLocaleString("pt-BR")}
                </p>
                <p className="text-[10px] text-muted">Candidaturas no recorte</p>
              </div>
            </div>
            <Button href="/admin/vagas" variant="outline" size="sm" full className="mt-3">
              Gerenciar vagas <ArrowUpRight size={12} />
            </Button>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          O que está marcado como <strong className="text-navy-700">estimativa</strong> vem de
          um modelo declarado, não de contagem: receita usa a base de planos × preço (vira
          número real quando houver cobrança) e visitantes usa 4 visitas por cadastro (vira
          real quando houver analytics na landing). O resto é contado no banco.
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- peças -- */
function Kpi({
  icone, rotulo, valor, variacao: v, nota, estimado,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  variacao: number | null;
  nota?: string;
  estimado?: boolean;
}) {
  const sobe = (v ?? 0) >= 0;
  return (
    <Card className="group relative !p-3.5 sm:!p-4">
      {/* O rótulo e a variação disputavam a mesma linha. Num cartão de meia
          tela de celular sobravam uns 50px para o texto, e "Matrículas" virava
          "Matr…" — um painel que esconde o nome do número não informa nada.
          A variação desceu para a linha do valor, que é curto e cabe ao lado
          dela; o rótulo ficou com a largura inteira e agora quebra em duas
          linhas em vez de ser cortado. */}
      <div className="flex items-start gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
          {icone}
        </span>
        <span className="min-w-0 text-[11px] font-semibold leading-tight text-muted">
          {rotulo}
          {estimado && (
            <span className="ml-1 rounded bg-navy-50 px-1 text-[8px] font-bold uppercase text-navy-500">
              est.
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-lg font-bold tabular-nums text-navy-700 sm:text-xl">{valor}</p>
        {v !== null && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              sobe ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            )}
          >
            {sobe ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {sobe ? "+" : ""}{v.toFixed(1)}%
          </span>
        )}
      </div>

      {nota && (
        <div className="pointer-events-none absolute inset-x-3 bottom-full z-10 mb-1 rounded-lg bg-navy-900 px-3 py-2 text-[10px] leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100">
          {nota}
        </div>
      )}
    </Card>
  );
}

function Comparativo({
  atual, anterior, formatar, ano,
}: {
  atual: number; anterior: number; formatar: (v: number) => string; ano: number;
}) {
  const v = variacao(atual, anterior);
  if (v === null) {
    return <span className="text-[11px] text-muted">sem base em {ano - 1}</span>;
  }
  return (
    <div className="text-right">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
          v >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        )}
      >
        {v >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {v >= 0 ? "+" : ""}{v.toFixed(1)}%
      </span>
      <p className="mt-0.5 text-[10px] text-muted">
        {ano - 1}: {formatar(anterior)}
      </p>
    </div>
  );
}

/** Exporta o recorte visível. O CEO vai querer levar para a reunião. */
function baixarCSV(m: Metricas) {
  const linhas = [
    ["Periodo", "Matriculas", "Certificados", "Cadastros", "Candidaturas", "Receita"],
    ...m.serie.rotulos.map((r, i) => [
      r,
      m.serie.valores.matriculas[i] ?? 0,
      m.serie.valores.certificados[i] ?? 0,
      m.serie.valores.cadastros[i] ?? 0,
      m.serie.valores.candidaturas[i] ?? 0,
      m.serie.valores.receita[i] ?? 0,
    ]),
  ];
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `castelo-branco-academy-${m.ano}-${m.periodo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
