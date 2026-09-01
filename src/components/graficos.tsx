"use client";

import { useState } from "react";
import { cn } from "./ui";

/* ==========================================================================
   GRÁFICOS

   SVG puro, sem biblioteca. Três motivos: o pacote de gráficos mais leve
   custa ~50 kB no bundle, o visual precisa seguir os tokens da marca, e o
   painel usa cinco formatos — não vale a dependência.

   Todos recebem números já calculados. Nenhum faz conta.
   ========================================================================== */

const OURO = "#C89F50";
const NAVY = "#00204D";
const TEAL = "#2F6E75";

/** Paleta das fatias da rosca, na ordem. */
const CORES_SERIE = [OURO, NAVY, TEAL, "#B88A45", "#1F4A7A"];

function fmt(v: number): string {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/* ======================================================================
   Barras — o valor fica em cima, não no hover
   ====================================================================== */
export function Barras({
  rotulos,
  valores,
  cor = OURO,
  cores,
  altura = 200,
  formatar = fmt,
}: {
  rotulos: string[];
  valores: number[];
  cor?: string;
  /** Uma cor por barra — usado quando cada coluna significa uma coisa. */
  cores?: string[];
  altura?: number;
  formatar?: (v: number) => string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...valores);

  // Com muitos baldes o rótulo em cima de cada barra vira borrão. A partir de
  // 16 colunas o número sai e fica só no hover; o eixo passa a mostrar um a
  // cada dois.
  const cabeNumero = valores.length <= 16;
  const passoEixo = valores.length > 24 ? 4 : valores.length > 14 ? 2 : 1;

  return (
    // O rótulo do eixo ("31/08") dá a cada coluna uma largura mínima de ~26px.
    // Quatorze colunas não cabem nos 280px de um celular: em vez de deixar as
    // últimas serem cortadas pela borda do cartão, o gráfico rola de lado com
    // todas as datas legíveis. Onde couber, o `min-w-full` faz as colunas
    // ocuparem a largura inteira como antes.
    <div className="fileira overflow-x-auto">
      <div className="flex min-w-full items-end gap-[3px]" style={{ height: altura }}>
        {valores.map((v, i) => (
          <div
            key={i}
            className="flex h-full min-w-[26px] flex-1 flex-col justify-end"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
          >
            <div className="relative flex h-full flex-col justify-end">
              {!cabeNumero && ativo === i && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md bg-navy-900 px-2 py-1 text-[10px] font-bold tabular-nums text-white shadow-lg">
                  {rotulos[i]}: {formatar(v)}
                </span>
              )}
              {cabeNumero && (
                <span
                  className="mb-1 text-center text-[10px] font-bold tabular-nums text-navy-700 transition"
                  style={{ opacity: ativo === null || ativo === i ? 1 : 0.4 }}
                >
                  {formatar(v)}
                </span>
              )}
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`,
                  background: cores?.[i] ?? cor,
                  opacity: ativo === null || ativo === i ? 1 : 0.45,
                }}
              />
            </div>
            <span className="mt-1.5 block h-3 text-center text-[9px] leading-3 text-muted">
              {i % passoEixo === 0 ? rotulos[i] : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================================================================
   Área com linha — para métrica de estoque (MRR, base de assinantes)

   Padrão que a literatura de painel de SaaS converge:
   · eixo Y começa em zero — cortar a base infla visualmente o crescimento;
   · valor escrito em cada ponto, porque quem lê MRR quer o número, não a forma;
   · linhas de grade discretas para dar referência sem competir com o dado;
   · último ponto destacado, que é o valor "de hoje";
   · faixa preenchida em degradê, para separar da leitura de fluxo (barras).

   Os rótulos são HTML sobreposto, não <text> do SVG: com
   preserveAspectRatio="none" o texto sairia esticado.
   ====================================================================== */
export function AreaLinha({
  rotulos,
  valores,
  altura = 200,
  cor = OURO,
  formatar = fmt,
}: {
  rotulos: string[];
  valores: number[];
  altura?: number;
  cor?: string;
  formatar?: (v: number) => string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...valores);
  // Folga no topo para o rótulo do maior valor não encostar na borda.
  const teto = max * 1.18;
  const L = 100;
  const A = 40;

  const posicao = (v: number, i: number) => {
    const x = valores.length > 1 ? (i / (valores.length - 1)) * 100 : 50;
    const y = (v / teto) * 100; // 0 = base, 100 = topo
    return { x, y };
  };

  const pontos = valores.map((v, i) => {
    const { x, y } = posicao(v, i);
    return `${(x / 100) * L},${A - (y / 100) * A}`;
  });
  const linha = pontos.join(" ");
  const area = `0,${A} ${linha} ${L},${A}`;
  const id = `grad-${cor.replace("#", "")}`;

  const cabeRotulo = valores.length <= 14;
  const ultimo = valores.length - 1;

  return (
    <div>
      <div className="relative" style={{ height: altura }}>
        {/* grade */}
        {[0, 25, 50, 75, 100].map((p) => (
          <span
            key={p}
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-navy-100"
            style={{ bottom: `${p}%` }}
          />
        ))}

        <svg
          viewBox={`0 0 ${L} ${A}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${id})`} />
          <polyline
            points={linha}
            fill="none"
            stroke={cor}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* pontos e rótulos, em HTML para o texto não distorcer */}
        {valores.map((v, i) => {
          const { x, y } = posicao(v, i);
          const derradeiro = i === ultimo;
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{ left: `${x}%`, width: 1 }}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
            >
              <span
                className={cn(
                  "absolute -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white transition-all",
                  derradeiro ? "h-3 w-3" : ativo === i ? "h-2.5 w-2.5" : "h-2 w-2"
                )}
                style={{ bottom: `${y}%`, borderColor: cor }}
              />
              {(cabeRotulo || ativo === i) && (
                <span
                  className={cn(
                    "absolute -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition",
                    derradeiro
                      ? "bg-navy-700 text-white shadow-sm"
                      : ativo === i
                        ? "bg-navy-900 text-white shadow-lg"
                        : "text-navy-700"
                  )}
                  style={{ bottom: `calc(${y}% + 12px)` }}
                >
                  {formatar(v)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* faixas de hover e eixo */}
      <div className="mt-1.5 flex">
        {rotulos.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className={cn(
              "flex-1 text-center text-[9px] transition",
              i === ultimo ? "font-bold text-navy-700" : "text-muted"
            )}
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
          >
            {rotulos.length > 24 && i % 4 !== 0 ? "" : rotulos.length > 14 && i % 2 !== 0 ? "" : r}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ======================================================================
   Rosca — distribuição
   ====================================================================== */
export function Rosca({
  fatias,
  tamanho = 150,
}: {
  fatias: Array<{ rotulo: string; valor: number; cor?: string }>;
  tamanho?: number;
}) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sem dados no período.</p>;
  }

  const R = 15.9155; // circunferência = 100, então o dash vira percentual direto
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
      <svg viewBox="0 0 42 42" style={{ width: tamanho, height: tamanho }} className="shrink-0">
        <circle cx="21" cy="21" r={R} fill="none" stroke="#EEF1F5" strokeWidth="5" />
        {fatias.map((f, i) => {
          const p = (f.valor / total) * 100;
          const el = (
            <circle
              key={f.rotulo}
              cx="21" cy="21" r={R}
              fill="none"
              stroke={f.cor ?? CORES_SERIE[i % CORES_SERIE.length]}
              strokeWidth="5"
              strokeDasharray={`${p} ${100 - p}`}
              strokeDashoffset={25 - acumulado}
              className="transition-all duration-700"
            />
          );
          acumulado += p;
          return el;
        })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-navy-700 text-[5px] font-bold">
          {fmt(total)}
        </text>
        <text x="21" y="25" textAnchor="middle" className="fill-slate-400 text-[2.6px]">
          total
        </text>
      </svg>

      {/* A legenda tem largura mínima própria. Sem ela, o `flex-1` a espremia
          ao lado da rosca no celular e a coluna de porcentagem saía do cartão;
          com o mínimo, o flex-wrap desce a legenda para a linha de baixo. */}
      <div className="min-w-[170px] flex-1 space-y-2.5">
        {fatias.map((f, i) => (
          <div key={f.rotulo} className="flex items-baseline gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm"
              style={{ background: f.cor ?? CORES_SERIE[i % CORES_SERIE.length] }}
            />
            <span className="min-w-0 flex-1 text-sm leading-snug text-ink">{f.rotulo}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-navy-700">{f.valor}</span>
            <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">
              {((f.valor / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================================================================
   Funil

   O rótulo e o valor ficam ACIMA da barra, em texto escuro sobre fundo claro.
   A versão anterior escrevia por cima do gradiente: em etapa curta o texto
   caía fora da barra e sumia; em etapa longa ficava escuro sobre azul escuro.
   Barra só desenha proporção — quem informa é o texto.
   ====================================================================== */
export function Funil({
  etapas,
}: {
  etapas: Array<{ rotulo: string; valor: number; nota?: string }>;
}) {
  const topo = etapas[0]?.valor || 1;
  const fim = etapas[etapas.length - 1]?.valor ?? 0;

  return (
    <div className="space-y-1">
      {etapas.map((e, i) => {
        const largura = Math.min(100, Math.max(2, (e.valor / topo) * 100));
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const passagem = anterior && anterior > 0 ? e.valor / anterior : null;
        const perda = anterior !== null ? anterior - e.valor : 0;
        // Vermelho quando mais de 70% some de uma etapa para a outra: é onde o
        // dinheiro está vazando.
        const critico = passagem !== null && passagem < 0.3;

        return (
          <div key={e.rotulo}>
            {i > 0 && (
              <div className="flex items-center gap-1.5 py-1 pl-0.5 text-[10px]">
                <span className="text-navy-200">↓</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-px font-bold tabular-nums",
                    perda < 0
                      ? "bg-navy-50 text-navy-600"
                      : critico
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  {((passagem ?? 0) * 100).toFixed(1)}%
                </span>
                <span className="leading-snug text-muted">
                  {perda < 0
                    ? `${Math.abs(perda).toLocaleString("pt-BR")} a mais que a etapa anterior`
                    : `${perda.toLocaleString("pt-BR")} ficam pelo caminho`}
                </span>
              </div>
            )}

            <div className="group">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold leading-snug text-navy-700">{e.rotulo}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-navy-700">
                  {e.valor.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-navy-50">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${largura}%`,
                    background:
                      i === etapas.length - 1
                        ? `linear-gradient(90deg, ${NAVY}, ${OURO})`
                        : `linear-gradient(90deg, ${NAVY}, #1F4A7A)`,
                  }}
                />
              </div>
              {e.nota && (
                <p className="mt-0.5 text-[10px] leading-snug text-muted opacity-0 transition group-hover:opacity-100">
                  {e.nota}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="!mt-3 rounded-lg bg-cream px-3 py-2">
        <p className="text-[11px] leading-snug text-muted">
          Conversão ponta a ponta:{" "}
          <strong className="text-navy-700">{((fim / topo) * 100).toFixed(2)}%</strong>
        </p>
      </div>
    </div>
  );
}

/* ======================================================================
   Barras horizontais — ranking
   ====================================================================== */
export function BarrasRanking({
  itens,
  formatar = fmt,
}: {
  itens: Array<{ rotulo: string; valor: number; detalhe?: string }>;
  formatar?: (v: number) => string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Ainda sem registros.</p>;
  }

  return (
    <div className="space-y-3">
      {itens.map((i, k) => (
        <div key={i.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            {/* O nome da ferramenta é o dado do ranking: cortado ele deixa de
                responder a pergunta que a lista existe para responder. */}
            <span className="min-w-0 text-sm leading-snug text-ink">
              <span className="mr-2 text-xs font-bold text-navy-300">{k + 1}</span>
              {i.rotulo}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-navy-700">
              {formatar(i.valor)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(i.valor / max) * 100}%`,
                background: `linear-gradient(90deg, ${NAVY}, ${OURO})`,
              }}
            />
          </div>
          {i.detalhe && <p className="mt-1 text-[11px] text-muted">{i.detalhe}</p>}
        </div>
      ))}
    </div>
  );
}
