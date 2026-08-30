"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock, BadgeCheck, Calculator, CreditCard, FileX, GitCompare, Gift,
  Info, Palmtree, Receipt, Scale, Ship, Tag, TrendingDown, TrendingUp, Truck,
  UserCog, Wallet, Clock, type LucideIcon,
} from "lucide-react";
import { Badge, Card, cn, inputCls } from "@/components/ui";
import { registrarUsoFerramenta } from "@/lib/repo-ferramentas";
import type { Campo, Ferramenta } from "@/lib/ferramentas/nucleo";

/* ==========================================================================
   Formulário genérico das ferramentas.

   A ferramenta declara seus campos e a função de cálculo; esta tela renderiza
   qualquer uma. Ferramenta nova é um objeto novo no catálogo — nenhum
   componente precisa mudar.

   O cálculo roda no navegador, a cada tecla. Nada é enviado ao servidor: o que
   trafega para o banco é só o slug, para o painel saber o que a base usa.
   ========================================================================== */

const ICONES: Record<string, LucideIcon> = {
  wallet: Wallet, "file-x": FileX, palmtree: Palmtree, gift: Gift, clock: Clock,
  receipt: Receipt, "git-compare": GitCompare, calculator: Calculator,
  "user-cog": UserCog, "alarm-clock": AlarmClock, "trending-up": TrendingUp,
  truck: Truck, ship: Ship, tag: Tag, scale: Scale, "trending-down": TrendingDown,
  "credit-card": CreditCard, "badge-check": BadgeCheck,
};

export function IconeFerramenta({ nome, size = 18 }: { nome: string; size?: number }) {
  const I = ICONES[nome] ?? Calculator;
  return <I size={size} />;
}

export function FerramentaForm({ ferramenta }: { ferramenta: Ferramenta }) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(ferramenta.campos.map((c) => [c.nome, c.padrao ?? ""]))
  );

  // Um registro por abertura, não por tecla digitada — senão o painel mede
  // digitação em vez de uso.
  useEffect(() => {
    void registrarUsoFerramenta(ferramenta.slug);
  }, [ferramenta.slug]);

  const resultado = useMemo(() => {
    try {
      return ferramenta.calcular(valores);
    } catch (e) {
      return {
        linhas: [],
        erro: e instanceof Error ? e.message : "Não foi possível calcular com esses valores.",
      };
    }
  }, [ferramenta, valores]);

  const grupos = useMemo(() => {
    const m = new Map<string, Campo[]>();
    for (const c of ferramenta.campos) {
      const g = c.grupo ?? "";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return [...m.entries()];
  }, [ferramenta]);

  function definir(nome: string, valor: string) {
    setValores((v) => ({ ...v, [nome]: valor }));
  }

  function limpar() {
    setValores(Object.fromEntries(ferramenta.campos.map((c) => [c.nome, c.padrao ?? ""])));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.05fr]">
      {/* -------------------------------------------------------- entrada -- */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 bg-cream/50 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-600">Dados</p>
          <button
            onClick={limpar}
            className="text-xs font-semibold text-gold-600 transition hover:text-gold-500"
          >
            Restaurar exemplo
          </button>
        </div>

        <div className="space-y-6 p-6">
          {grupos.map(([grupo, campos]) => (
            <div key={grupo}>
              {grupo && (
                <p className="mb-3 border-b border-navy-100 pb-2 text-[11px] font-bold uppercase tracking-wider text-gold-600">
                  {grupo}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {campos.map((c) => (
                  <div key={c.nome} className={cn(c.largo && "sm:col-span-2")}>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
                        {c.rotulo}
                      </span>
                      {c.tipo === "select" ? (
                        <select
                          value={valores[c.nome] ?? ""}
                          onChange={(e) => definir(c.nome, e.target.value)}
                          className={inputCls}
                        >
                          {c.opcoes?.map((o) => (
                            <option key={o.v} value={o.v}>{o.rotulo}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="relative">
                          {c.tipo === "moeda" && (
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              R$
                            </span>
                          )}
                          <input
                            type={c.tipo === "data" ? "date" : "text"}
                            inputMode={
                              c.tipo === "texto" || c.tipo === "data" ? undefined : "decimal"
                            }
                            value={valores[c.nome] ?? ""}
                            onChange={(e) => definir(c.nome, e.target.value)}
                            className={cn(inputCls, c.tipo === "moeda" && "pl-10", c.tipo === "percentual" && "pr-9")}
                          />
                          {c.tipo === "percentual" && (
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              %
                            </span>
                          )}
                        </div>
                      )}
                      {c.dica && <span className="mt-1 block text-xs text-muted">{c.dica}</span>}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------ resultado -- */}
      <div className="space-y-4">
        {resultado.erro ? (
          <Card className="!border-amber-200 !bg-amber-50">
            <p className="flex items-start gap-2.5 text-sm text-amber-800">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>{resultado.erro}</span>
            </p>
          </Card>
        ) : (
          <>
            {resultado.destaque && (
              <Card className="!border-navy-200 !bg-navy-700">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold-300">
                  {resultado.destaque.rotulo}
                </p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                  {resultado.destaque.valor}
                </p>
                {resultado.destaque.detalhe && (
                  <p className="mt-1.5 text-sm text-navy-100/70">{resultado.destaque.detalhe}</p>
                )}
              </Card>
            )}

            <Card className="!p-0 overflow-hidden">
              <div className="border-b border-navy-100 bg-cream/50 px-6 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
                  Memória de cálculo
                </p>
              </div>
              <ul className="divide-y divide-navy-100">
                {resultado.linhas.map((l, i) => (
                  <li
                    key={`${l.rotulo}-${i}`}
                    className={cn(
                      "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 py-3",
                      l.estilo === "total" && "bg-gold-50",
                      l.estilo === "subtotal" && "bg-cream/60",
                      l.estilo === "info" && "bg-navy-50/40"
                    )}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm",
                          l.estilo === "total" || l.estilo === "subtotal"
                            ? "font-bold text-navy-700"
                            : l.estilo === "info"
                              ? "text-muted"
                              : "text-ink"
                        )}
                      >
                        {l.rotulo}
                      </p>
                      {l.detalhe && (
                        <p className="mt-0.5 text-xs text-muted">{l.detalhe}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        l.estilo === "total"
                          ? "text-base font-bold text-navy-700"
                          : l.estilo === "subtotal"
                            ? "text-sm font-bold text-navy-700"
                            : l.estilo === "desconto"
                              ? "text-sm font-semibold text-red-600"
                              : l.estilo === "info"
                                ? "text-sm text-muted"
                                : "text-sm font-semibold text-navy-700"
                      )}
                    >
                      {l.valor}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {resultado.avisos?.length ? (
              <Card className="!bg-cream/60">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                  <Info size={13} className="text-gold-500" /> O que observar
                </p>
                <ul className="space-y-2.5">
                  {resultado.avisos.map((a) => (
                    <li key={a} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}

        {ferramenta.vigencia && (
          <p className="flex items-center gap-2 px-1 text-xs text-muted">
            <Badge tone="muted">Tabela</Badge> {ferramenta.vigencia}
          </p>
        )}
      </div>
    </div>
  );
}
