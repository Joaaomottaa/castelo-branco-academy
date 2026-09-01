"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Info } from "lucide-react";
import { Badge, Card, cn } from "@/components/ui";
import {
  faltamEmTexto, porExtenso, proximosVencimentos, type Vencimento,
} from "@/lib/agenda-fiscal";

/* ==========================================================================
   PRÓXIMAS OBRIGAÇÕES

   A comunidade não precisava de mais um lugar para conversar — precisava de um
   motivo para ser aberta todo dia. Para escritório contábil esse motivo tem
   nome: prazo.

   O que dá utilidade real ao quadro é a cadeia de dependência da folha
   (eSocial → EFD-Reinf → DCTFWeb): é o erro que mais custa a quem está
   começando, porque sem fechar a primeira a última não gera o DARF.

   As ressalvas ficam escritas na tela. Um calendário fiscal em que o
   profissional não sabe o que foi considerado é um calendário que ele não usa.
   ========================================================================== */

const TOM_URGENCIA = (dias: number) =>
  dias <= 2 ? "red" : dias <= 7 ? "gold" : "muted";

export function AgendaDeObrigacoes({
  quantos = 5,
  className,
}: {
  quantos?: number;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);

  // `hoje` é fixado no primeiro render: a lista não deve mudar sozinha no meio
  // da leitura, e o cálculo é puro o suficiente para não precisar de efeito.
  const vencimentos = useMemo<Vencimento[]>(
    () => proximosVencimentos(new Date(), quantos),
    [quantos]
  );

  return (
    <Card className={className}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
        <CalendarClock size={16} className="text-gold-500" /> Próximas obrigações
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Federais e do Simples, pela regra de vencimento de cada uma.
      </p>

      <div className="mt-4 space-y-2.5">
        {vencimentos.map((v) => (
          <div key={`${v.obrigacao.sigla}-${v.data.toISOString()}`} className="flex gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg",
                v.faltam <= 2
                  ? "bg-red-50 text-red-600"
                  : v.faltam <= 7
                    ? "bg-gold-50 text-gold-600"
                    : "bg-navy-50 text-navy-600"
              )}
            >
              <span className="text-[13px] font-bold leading-none tabular-nums">
                {v.data.getDate()}
              </span>
              <span className="text-[8px] uppercase tracking-wider">
                {v.data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-snug text-navy-700">
                {v.obrigacao.sigla}
                <Badge tone={TOM_URGENCIA(v.faltam)}>{faltamEmTexto(v.faltam)}</Badge>
              </p>
              <p className="text-[11px] leading-snug text-muted">
                {v.obrigacao.nome} · {v.competencia}
              </p>
              {v.obrigacao.depende && (
                <p className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-gold-600">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  depende de {v.obrigacao.depende} fechada
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setAberta((a) => !a)}
        className="mt-3 flex w-full items-start gap-1.5 border-t border-navy-100 pt-3 text-left text-[11px] leading-relaxed text-muted transition hover:text-navy-700"
      >
        <Info size={12} className="mt-0.5 shrink-0" />
        {aberta ? (
          <span>
            As datas saem da regra de cada obrigação — dia fixo, décimo dia útil ou último
            dia útil do mês. <strong>Feriado não entra na conta</strong>: só fim de semana é
            empurrado para o dia útil seguinte. O prazo da EFD ICMS/IPI é definido por cada
            estado, então confira o da sua UF. Confirme sempre na agenda tributária da
            Receita antes de transmitir.
          </span>
        ) : (
          <span>Como estas datas são calculadas</span>
        )}
      </button>
    </Card>
  );
}

/** Uma linha só, para caber no painel do aluno sem competir com o resto. */
export function ProximaObrigacao() {
  const proxima = useMemo(() => proximosVencimentos(new Date(), 1)[0], []);
  if (!proxima) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <CalendarClock size={13} className="shrink-0 text-gold-500" />
      <strong className="text-navy-700">{proxima.obrigacao.sigla}</strong>
      {porExtenso(proxima.data)} — {faltamEmTexto(proxima.faltam)}
    </p>
  );
}
