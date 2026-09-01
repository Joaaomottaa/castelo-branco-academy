"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Building2, CalendarClock, CheckCircle2,
  GraduationCap, Route,
} from "lucide-react";
import { Badge, Card, Progress, cn } from "@/components/ui";
import { carregarMinhasFormacoes, type MinhaFormacao } from "@/lib/repo-empresa";

/* ==========================================================================
   O QUE A MINHA EMPRESA ESPERA DE MIM

   O outro lado da tela de formações do gestor. Aparece no painel do aluno e
   some sozinho quando não há nada atribuído — a maioria das pessoas não tem
   empresa, e um cartão vazio dizendo "nenhuma formação da empresa" seria
   ruído permanente para elas.

   O que está atrasado vem primeiro e em vermelho. Não é dramatização: o prazo
   foi combinado com o gestor, e descobrir que venceu na conversa de avaliação
   é pior do que ver aqui.
   ========================================================================== */

export function CartaoFormacoesDaEmpresa() {
  const [itens, setItens] = useState<MinhaFormacao[] | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarMinhasFormacoes().then((f) => { if (ativo) setItens(f); });
    return () => { ativo = false; };
  }, []);

  if (!itens || itens.length === 0) return null;

  const pendentes = itens.filter((f) => !f.concluido);
  const atrasadas = pendentes.filter((f) => (f.diasRestantes ?? 1) < 0);
  const feitas = itens.length - pendentes.length;

  // Atrasadas primeiro, depois as de prazo mais curto.
  const ordenadas = [...pendentes].sort(
    (a, b) => (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999)
  );

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-100 bg-cream/50 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-gold-300">
            <Building2 size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-navy-700">Formações da sua empresa</p>
            <p className="mt-0.5 text-xs text-muted">
              {atrasadas.length > 0 ? (
                <span className="font-semibold text-red-600">
                  {atrasadas.length} com prazo vencido
                </span>
              ) : pendentes.length > 0 ? (
                `${pendentes.length} em andamento`
              ) : (
                "Tudo em dia"
              )}
              {feitas > 0 && ` · ${feitas} concluída(s)`}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-navy-100">
        {ordenadas.slice(0, 4).map((f) => (
          <Link
            key={f.id}
            href={f.tipo === "curso" ? `/app/cursos/${f.slug}` : `/app/trilhas/${f.slug}`}
            className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-cream/40"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: f.cor || "#00204D" }}
            >
              {f.tipo === "trilha" ? <Route size={16} /> : <GraduationCap size={16} />}
            </span>

            <div className="min-w-[160px] flex-1">
              <p className="text-sm font-semibold text-navy-700">{f.titulo}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                {f.obrigatoria ? (
                  <Badge tone="gold">Obrigatória</Badge>
                ) : (
                  <Badge tone="muted">Recomendada</Badge>
                )}
                <Prazo dias={f.diasRestantes} />
              </p>
            </div>

            <div className="w-28">
              <Progress
                value={f.pct}
                tone={(f.diasRestantes ?? 1) < 0 ? "navy" : "gold"}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-navy-700">
              {f.pct}%
            </span>
            <ArrowRight size={14} className="shrink-0 text-muted" />
          </Link>
        ))}

        {ordenadas.length === 0 && (
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-600">
            <CheckCircle2 size={16} />
            Você concluiu todas as formações indicadas pela empresa.
          </p>
        )}
      </div>

      {ordenadas.length > 4 && (
        <p className="border-t border-navy-100 px-5 py-2.5 text-xs text-muted">
          E mais {ordenadas.length - 4} formação(ões) atribuída(s).
        </p>
      )}
    </Card>
  );
}

function Prazo({ dias }: { dias?: number | null }) {
  if (dias === null || dias === undefined) {
    return <span className="text-muted">sem prazo</span>;
  }
  if (dias < 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-semibold text-red-600")}>
        <AlertTriangle size={11} /> venceu há {Math.abs(dias)} dia(s)
      </span>
    );
  }
  return (
    <span className={cn(
      "inline-flex items-center gap-1",
      dias <= 7 ? "font-semibold text-amber-600" : "text-muted"
    )}>
      <CalendarClock size={11} />
      {dias === 0 ? "vence hoje" : `faltam ${dias} dia(s)`}
    </span>
  );
}
