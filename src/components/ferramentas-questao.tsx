"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, Calculator, ChevronDown, Delete, Eraser, Sigma, Table2, X,
} from "lucide-react";
import { cn } from "@/components/ui";
import { FerramentaForm, IconeFerramenta } from "@/components/ferramenta-form";
import {
  FERRAMENTAS_NA_QUESTAO, ferramentasSugeridas, type ContextoDaQuestao,
} from "@/lib/ferramentas/na-questao";
import {
  DEDUCAO_DEPENDENTE, DESCONTO_SIMPLIFICADO, FAIXAS_INSS, FAIXAS_IRRF,
  SALARIO_MINIMO, TETO_INSS, VIGENCIA,
} from "@/lib/ferramentas/tabelas";
import { brl } from "@/lib/ferramentas/nucleo";

/* ==========================================================================
   FERRAMENTAS DENTRO DA QUESTÃO

   Numa prova de verdade a pessoa tem papel e calculadora. Aqui ela tinha de
   sair da questão, abrir /app/ferramentas, calcular e voltar — e, ao voltar,
   já não lembrava o número.

   Então a bancada vem para dentro: calculadora com fita, a ferramenta certa
   para o assunto da questão e as tabelas que a banca usou para montar o
   gabarito. Nada disso é gabarito, então a aba abre antes de responder — é
   justamente o que ajuda a responder.
   ========================================================================== */

type Modo = "calculadora" | "tabelas" | string;

export function PainelFerramentas({ questao }: { questao: ContextoDaQuestao }) {
  const sugeridas = useMemo(() => ferramentasSugeridas(questao), [questao]);
  const [modo, setModo] = useState<Modo>("calculadora");
  const [todas, setTodas] = useState(false);

  const visiveis = todas ? FERRAMENTAS_NA_QUESTAO : sugeridas;
  const ferramenta = FERRAMENTAS_NA_QUESTAO.find((f) => f.slug === modo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-gold-300">
            <Calculator size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-navy-700">Ferramentas para resolver</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              A calculadora e os simuladores que a conta desta questão pede — sem
              sair daqui e sem perder o que você já digitou.
            </p>
          </div>
        </div>
        <Link
          href="/app/ferramentas"
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted transition hover:text-gold-600"
        >
          Ver todas em outra aba <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* Seletor */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          ativo={modo === "calculadora"}
          onClick={() => setModo("calculadora")}
          icone={<Calculator size={13} />}
          rotulo="Calculadora"
        />
        <Chip
          ativo={modo === "tabelas"}
          onClick={() => setModo("tabelas")}
          icone={<Table2 size={13} />}
          rotulo="Tabelas oficiais"
        />
        <span className="mx-1 my-auto h-4 w-px bg-navy-100" />
        {visiveis.map((f) => (
          <Chip
            key={f.slug}
            ativo={modo === f.slug}
            onClick={() => setModo(f.slug)}
            icone={<IconeFerramenta nome={f.icone} size={13} />}
            rotulo={f.nome}
          />
        ))}
        {!todas && FERRAMENTAS_NA_QUESTAO.length > sugeridas.length && (
          <button
            onClick={() => setTodas(true)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:text-gold-600"
          >
            <ChevronDown size={12} />
            Ver todas ({FERRAMENTAS_NA_QUESTAO.length - sugeridas.length})
          </button>
        )}
      </div>

      {modo === "calculadora" && <Calculadora />}
      {modo === "tabelas" && <TabelasOficiais />}
      {ferramenta && (
        <div className="rounded-xl border border-navy-100 bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-navy-700">{ferramenta.nome}</p>
              <p className="text-xs text-muted">{ferramenta.descricao}</p>
            </div>
            {ferramenta.vigencia && (
              <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold text-muted">
                {ferramenta.vigencia}
              </span>
            )}
          </div>
          <FerramentaForm ferramenta={ferramenta} />
        </div>
      )}
    </div>
  );
}

function Chip({
  ativo, onClick, icone, rotulo,
}: {
  ativo: boolean; onClick: () => void; icone: React.ReactNode; rotulo: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
        ativo
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-navy-200 bg-white text-navy-700 hover:border-gold-400 hover:text-gold-600"
      )}
    >
      {icone}
      {rotulo}
    </button>
  );
}

/* ==================================================================== 1 ===
   CALCULADORA

   Com fita, porque questão de cálculo quase nunca é uma conta só: é a base,
   depois a alíquota, depois a dedução. Sem a fita a pessoa refaz tudo quando
   erra a última tecla — e é aí que ela desiste e chuta.

   O `%` é o das calculadoras de escritório, não o de dividir por cem solto:
   `200 + 10 %` devolve 220, que é o que a pessoa espera ao acrescentar 10%.
   ========================================================================== */
/** Uma tecla. Vive fora de `Calculadora`: componente declarado dentro do corpo
    de outro é um tipo novo a cada render, e o React remonta o teclado inteiro
    a cada dígito — o clique seguinte cai num nó já descartado. */
function T({
  children, onClick, tom = "num", largo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tom?: "num" | "op" | "acao" | "igual";
  largo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition active:scale-95",
        largo && "col-span-2",
        tom === "num" && "bg-white text-navy-700 shadow-sm hover:bg-cream",
        tom === "op" && "bg-navy-50 text-navy-700 hover:bg-navy-100",
        tom === "acao" && "bg-navy-100/70 text-navy-600 hover:bg-navy-200",
        tom === "igual" && "gold-gradient text-navy-800 hover:brightness-105"
      )}
    >
      {children}
    </button>
  );
}

function Calculadora() {
  const [visor, setVisor] = useState("0");
  const [acumulado, setAcumulado] = useState<number | null>(null);
  const [operacao, setOperacao] = useState<string | null>(null);
  const [novoNumero, setNovoNumero] = useState(true);
  const [fita, setFita] = useState<string[]>([]);
  const fitaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fitaRef.current?.scrollTo({ top: fitaRef.current.scrollHeight });
  }, [fita]);

  const valor = () => Number(visor.replace(",", "."));

  const mostrar = (n: number) => {
    if (!Number.isFinite(n)) return "Erro";
    // Doze dígitos significativos: acima disso o número vira notação
    // científica e ninguém confere gabarito assim.
    const s = Number(n.toPrecision(12)).toString();
    return s.replace(".", ",");
  };

  const digitar = useCallback((d: string) => {
    setVisor((v) => {
      if (novoNumero) return d === "," ? "0," : d;
      if (d === "," && v.includes(",")) return v;
      if (v === "0" && d !== ",") return d;
      return v.length >= 15 ? v : v + d;
    });
    setNovoNumero(false);
  }, [novoNumero]);

  const aplicar = useCallback((a: number, b: number, op: string) => {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? NaN : a / b;
    return b;
  }, []);

  const operar = useCallback((op: string) => {
    const atual = valor();
    if (acumulado !== null && operacao && !novoNumero) {
      const r = aplicar(acumulado, atual, operacao);
      setFita((f) => [...f, `${mostrar(acumulado)} ${operacao} ${mostrar(atual)} = ${mostrar(r)}`]);
      setAcumulado(r);
      setVisor(mostrar(r));
    } else {
      setAcumulado(atual);
    }
    setOperacao(op);
    setNovoNumero(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acumulado, operacao, novoNumero, visor, aplicar]);

  const igual = useCallback(() => {
    if (acumulado === null || !operacao) return;
    const atual = valor();
    const r = aplicar(acumulado, atual, operacao);
    setFita((f) => [...f, `${mostrar(acumulado)} ${operacao} ${mostrar(atual)} = ${mostrar(r)}`]);
    setVisor(mostrar(r));
    setAcumulado(null);
    setOperacao(null);
    setNovoNumero(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acumulado, operacao, visor, aplicar]);

  /** Porcentagem de escritório: 200 + 10% = 220; 200 × 10% = 20. */
  const porcento = useCallback(() => {
    const atual = valor();
    if (acumulado !== null && (operacao === "+" || operacao === "−")) {
      setVisor(mostrar((acumulado * atual) / 100));
    } else {
      setVisor(mostrar(atual / 100));
    }
    setNovoNumero(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acumulado, operacao, visor]);

  const limpar = () => {
    setVisor("0"); setAcumulado(null); setOperacao(null); setNovoNumero(true);
  };

  const apagar = () =>
    setVisor((v) => (v.length <= 1 || (v.length === 2 && v.startsWith("-")) ? "0" : v.slice(0, -1)));

  const inverter = () => setVisor((v) => (v.startsWith("-") ? v.slice(1) : v === "0" ? v : `-${v}`));

  // Teclado: quem calcula rápido calcula no teclado numérico.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) { digitar(k); e.preventDefault(); }
      else if (k === "," || k === ".") { digitar(","); e.preventDefault(); }
      else if (k === "+") { operar("+"); e.preventDefault(); }
      else if (k === "-") { operar("−"); e.preventDefault(); }
      else if (k === "*") { operar("×"); e.preventDefault(); }
      else if (k === "/") { operar("÷"); e.preventDefault(); }
      else if (k === "%") { porcento(); e.preventDefault(); }
      else if (k === "Enter" || k === "=") { igual(); e.preventDefault(); }
      else if (k === "Backspace") { apagar(); e.preventDefault(); }
      else if (k === "Escape") { limpar(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [digitar, operar, porcento, igual]);

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,280px)_1fr]">
      <div className="rounded-xl border border-navy-100 bg-cream/60 p-3">
        <div className="mb-3 rounded-lg bg-navy-800 px-4 py-3 text-right">
          <p className="h-4 text-[11px] tabular-nums text-navy-100/50">
            {acumulado !== null ? `${mostrar(acumulado)} ${operacao ?? ""}` : ""}
          </p>
          <p className="truncate text-2xl font-bold tabular-nums text-white">{visor}</p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <T tom="acao" onClick={limpar}><Eraser size={15} /></T>
          <T tom="acao" onClick={apagar}><Delete size={15} /></T>
          <T tom="acao" onClick={porcento}>%</T>
          <T tom="op" onClick={() => operar("÷")}>÷</T>

          <T onClick={() => digitar("7")}>7</T>
          <T onClick={() => digitar("8")}>8</T>
          <T onClick={() => digitar("9")}>9</T>
          <T tom="op" onClick={() => operar("×")}>×</T>

          <T onClick={() => digitar("4")}>4</T>
          <T onClick={() => digitar("5")}>5</T>
          <T onClick={() => digitar("6")}>6</T>
          <T tom="op" onClick={() => operar("−")}>−</T>

          <T onClick={() => digitar("1")}>1</T>
          <T onClick={() => digitar("2")}>2</T>
          <T onClick={() => digitar("3")}>3</T>
          <T tom="op" onClick={() => operar("+")}>+</T>

          <T tom="acao" onClick={inverter}>±</T>
          <T onClick={() => digitar("0")}>0</T>
          <T onClick={() => digitar(",")}>,</T>
          <T tom="igual" onClick={igual}>=</T>
        </div>
      </div>

      <div className="flex min-h-[220px] flex-col rounded-xl border border-navy-100 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy-600">
            <Sigma size={12} className="text-gold-500" /> Fita de cálculo
          </p>
          {fita.length > 0 && (
            <button
              onClick={() => setFita([])}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted transition hover:text-red-600"
            >
              <X size={11} /> Limpar
            </button>
          )}
        </div>

        {fita.length === 0 ? (
          <p className="my-auto text-center text-xs leading-relaxed text-muted">
            Cada conta fechada aparece aqui.<br />
            Serve para conferir a base antes de aplicar a alíquota — e para
            não refazer tudo quando a última tecla sai errada.
          </p>
        ) : (
          <div ref={fitaRef} className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {fita.map((l, i) => (
              <p
                key={i}
                className="rounded-md bg-cream/70 px-2.5 py-1.5 text-right font-mono text-xs tabular-nums text-navy-700"
              >
                {l}
              </p>
            ))}
          </div>
        )}

        <p className="mt-auto pt-2 text-[10px] leading-relaxed text-muted">
          Teclado numérico funciona: <strong>+ − * /</strong>, <strong>Enter</strong> para
          igual, <strong>Esc</strong> para limpar.
        </p>
      </div>
    </div>
  );
}

/* ==================================================================== 2 ===
   TABELAS OFICIAIS

   A questão de folha traz o salário e cobra o desconto; a tabela do INSS fica
   pressuposta. Quem decorou responde, quem não decorou erra sem saber por quê.
   Consultar aqui é o que um contador faria no escritório.
   ========================================================================== */
function TabelasOficiais() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TabelaCard titulo="INSS — contribuição progressiva" nota={VIGENCIA.inss}>
        <Linhas
          cabecalho={["Faixa do salário", "Alíquota"]}
          linhas={FAIXAS_INSS.map((f, i) => [
            `${brl(i === 0 ? 0 : FAIXAS_INSS[i - 1].ate + 0.01)} a ${brl(f.ate)}`,
            `${(f.aliquota * 100).toFixed(1).replace(".", ",")}%`,
          ])}
        />
        <Rodape>
          Teto de {brl(TETO_INSS)} · salário mínimo de {brl(SALARIO_MINIMO)}.
          A alíquota incide por faixa, não sobre o total.
        </Rodape>
      </TabelaCard>

      <TabelaCard titulo="IRRF — tabela mensal" nota={VIGENCIA.irrf}>
        <Linhas
          cabecalho={["Base de cálculo", "Alíquota", "Dedução"]}
          linhas={FAIXAS_IRRF.map((f, i) => [
            f.ate === Infinity
              ? `acima de ${brl(FAIXAS_IRRF[i - 1].ate)}`
              : `até ${brl(f.ate)}`,
            f.aliquota === 0 ? "isento" : `${(f.aliquota * 100).toFixed(1).replace(".", ",")}%`,
            brl(f.deducao),
          ])}
        />
        <Rodape>
          Dependente: {brl(DEDUCAO_DEPENDENTE)} cada. Desconto simplificado
          de {brl(DESCONTO_SIMPLIFICADO)} quando for mais vantajoso que as
          deduções legais.
        </Rodape>
      </TabelaCard>
    </div>
  );
}

function TabelaCard({
  titulo, nota, children,
}: {
  titulo: string; nota?: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
      <div className="flex items-baseline justify-between gap-2 border-b border-navy-100 bg-cream/50 px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-600">{titulo}</p>
        {nota && <span className="shrink-0 text-[10px] text-muted">{nota}</span>}
      </div>
      {children}
    </div>
  );
}

function Linhas({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-xs">
        <thead>
          <tr className="border-b border-navy-100 text-left text-[10px] uppercase tracking-wide text-muted">
            {cabecalho.map((c, i) => (
              <th key={c} className={cn("px-4 py-2 font-semibold", i > 0 && "text-right")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {linhas.map((l, i) => (
            <tr key={i} className="text-navy-700">
              {l.map((c, j) => (
                <td
                  key={j}
                  className={cn("px-4 py-2 tabular-nums", j > 0 && "text-right font-semibold")}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Rodape = ({ children }: { children: React.ReactNode }) => (
  <p className="border-t border-navy-100 bg-cream/40 px-4 py-2.5 text-[11px] leading-relaxed text-muted">
    {children}
  </p>
);
