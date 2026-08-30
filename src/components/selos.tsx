"use client";

import { Award, Lock, Medal, ShieldCheck } from "lucide-react";
import { cn } from "./ui";
import type { HabilidadeSelo, Selo, SeloTrilhaDados } from "@/lib/types";

/* ==========================================================================
   SELOS DE HABILIDADE E DE TRILHA

   Antes a pessoa escolhia as próprias habilidades numa lista. O recrutador
   lia "SPED" e não tinha como saber se aquilo veio de cinco anos de prática
   ou de trinta segundos clicando em chips.

   Agora a habilidade é consequência: sai do certificado, e o metal do selo é
   o nível do curso que a concedeu. A trilha completa promove tudo que ela
   cobre para ouro, porque terminar a formação inteira é outra afirmação.

   Os tons de bronze e prata foram escolhidos dentro da paleta da casa — o
   bronze puxa para o dourado da marca, a prata para o azul. Um cinza e um
   marrom genéricos fariam o perfil parecer de outra empresa.
   ========================================================================== */

export const ESTILO_SELO: Record<
  Selo,
  { nome: string; texto: string; fundo: string; borda: string; hex: string }
> = {
  ouro: {
    nome: "Ouro",
    texto: "text-gold-600",
    fundo: "bg-gold-50",
    borda: "border-gold-300",
    hex: "#C89F50",
  },
  prata: {
    nome: "Prata",
    texto: "text-[#5C6B80]",
    fundo: "bg-[#EEF2F7]",
    borda: "border-[#B9C4D2]",
    hex: "#7E8CA0",
  },
  bronze: {
    nome: "Bronze",
    texto: "text-[#8A5A2B]",
    fundo: "bg-[#F8EFE5]",
    borda: "border-[#DCBE9C]",
    hex: "#A8703C",
  },
};

/** Explica o metal sem precisar de legenda em cada tela. */
export const ORIGEM_DO_SELO: Record<Selo, string> = {
  bronze: "Curso de nível Iniciante concluído",
  prata: "Curso de nível Intermediário concluído",
  ouro: "Curso avançado ou trilha completa",
};

/* ------------------------------------------------------- chip individual -- */
export function ChipSelo({
  habilidade,
  tamanho = "md",
}: {
  habilidade: HabilidadeSelo;
  tamanho?: "sm" | "md";
}) {
  const s = habilidade.selo;

  // Sem selo é habilidade declarada no cadastro antigo. Ela continua visível,
  // mas em cinza e sem medalha: a diferença precisa ser óbvia à distância.
  if (!s) {
    return (
      <span
        title="Informada pelo profissional — sem verificação da Academy"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-200 bg-white font-semibold text-muted",
          tamanho === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
        )}
      >
        {habilidade.nome}
      </span>
    );
  }

  const e = ESTILO_SELO[s];
  const de = habilidade.trilhaNome
    ? `Trilha ${habilidade.trilhaNome}`
    : habilidade.cursoTitulo ?? ORIGEM_DO_SELO[s];

  return (
    <span
      title={`Selo ${e.nome} · ${de}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold",
        e.fundo,
        e.borda,
        e.texto,
        tamanho === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      )}
    >
      <Medal size={tamanho === "sm" ? 11 : 13} />
      {habilidade.nome}
    </span>
  );
}

/* --------------------------------------------------- painel de conquista -- */
export function PainelDeSelos({
  selos,
  vazio = "Ainda não há selos. Eles aparecem sozinhos quando um curso é concluído.",
  compacto,
}: {
  selos: HabilidadeSelo[];
  vazio?: string;
  compacto?: boolean;
}) {
  const conquistados = selos.filter((s) => s.selo);
  const declarados = selos.filter((s) => !s.selo);

  if (selos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy-200 bg-cream/60 p-4 text-sm text-muted">
        {vazio}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {conquistados.length > 0 && (
        <div>
          {!compacto && (
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              <ShieldCheck size={12} /> Conquistadas em curso — {conquistados.length}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {conquistados.map((h) => (
              <ChipSelo key={h.nome} habilidade={h} tamanho={compacto ? "sm" : "md"} />
            ))}
          </div>
        </div>
      )}

      {declarados.length > 0 && (
        <div>
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Informadas pelo profissional
          </p>
          <div className="flex flex-wrap gap-2">
            {declarados.map((h) => (
              <ChipSelo key={h.nome} habilidade={h} tamanho={compacto ? "sm" : "md"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Legenda dos três metais. Uma vez por tela basta. */
export function LegendaSelos({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {(["bronze", "prata", "ouro"] as Selo[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <Medal size={12} style={{ color: ESTILO_SELO[s].hex }} />
          <strong className="font-semibold text-navy-700">{ESTILO_SELO[s].nome}</strong>
          · {ORIGEM_DO_SELO[s]}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- selo dourado -- */
/**
 * O selo da trilha é o objeto que a pessoa mostra para o recrutador. Por isso
 * ele carrega o brasão da casa, o código de validação e — a parte que importa
 * para quem contrata — a lista do que aquela trilha efetivamente formou.
 */
export function SeloTrilha({
  selo,
  compacto,
}: {
  selo: SeloTrilhaDados;
  compacto?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-gold-300 p-5"
      style={{ background: "linear-gradient(135deg, #00204D 0%, #001838 100%)" }}
    >
      <div className="grid-lines absolute inset-0 opacity-40" />

      <div className="relative flex items-start gap-4">
        <span className="gold-gradient inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoCastelo.png" alt="" className="h-9 w-auto" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
            <Award size={12} /> Certificação de trilha
          </p>
          <h3 className="mt-1 text-lg font-bold leading-tight text-white">{selo.nome}</h3>
          <p className="mt-1 text-[11px] text-navy-100/60">
            {selo.cargaHoraria}h · {selo.pontosPEPC} pts PEPC · código {selo.codigo}
          </p>
        </div>
      </div>

      {!compacto && selo.habilidades.length > 0 && (
        <div className="relative mt-4 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-navy-100/45">
            Habilidades desenvolvidas
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selo.habilidades.map((h) => (
              <span
                key={h}
                className="rounded-full border border-gold-400/35 bg-gold-400/10 px-2.5 py-1 text-[11px] font-semibold text-gold-200"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Placeholder para trilha ainda não conquistada — mostra o que está em jogo. */
export function SeloTrilhaBloqueado({
  nome,
  faltam,
}: {
  nome: string;
  faltam: number;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-navy-200 bg-cream/50 p-5">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-300">
          <Lock size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            Certificação de trilha
          </p>
          <h3 className="mt-1 text-base font-bold leading-tight text-navy-700">{nome}</h3>
          <p className="mt-1 text-xs text-muted">
            {faltam === 1 ? "Falta 1 curso obrigatório" : `Faltam ${faltam} cursos obrigatórios`}
          </p>
        </div>
      </div>
    </div>
  );
}
