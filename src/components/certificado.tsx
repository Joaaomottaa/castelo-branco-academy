"use client";

import { Award, QrCode, ShieldCheck } from "lucide-react";
import { Logo, cn } from "@/components/ui";

/* ==========================================================================
   O DOCUMENTO

   Existia em dois lugares — na área do aluno e na página pública de validação
   — desenhado duas vezes. Duas cópias do mesmo diploma divergem na primeira
   mudança, e um certificado que muda de cara entre quem o recebeu e quem o
   confere é exatamente o que destrói a confiança nele.

   Agora é um componente só, em duas variantes:

   · curso  — o diploma de conclusão, sóbrio.
   · trilha — a certificação de percurso. É a peça que as empresas procuram no
              banco de talentos, então ela é deliberadamente mais imponente:
              moldura dupla, medalha e as habilidades listadas logo abaixo do
              nome da trilha.
   ========================================================================== */

export interface DadosDiploma {
  aluno: string;
  titulo: string;
  cargaHoraria: number;
  pontosPEPC: number;
  emitidoEm: string;
  codigo: string;
  area?: string;
  nivel?: string;
  /** Só na trilha: o que aquele percurso comprova. */
  habilidades?: string[];
}

function dataPorExtenso(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const FUNDO_NAVY = "linear-gradient(135deg, #00204D 0%, #001838 100%)";

export function Diploma({
  dados,
  tipo = "curso",
  grande,
  className,
}: {
  dados: DadosDiploma;
  tipo?: "curso" | "trilha";
  grande?: boolean;
  className?: string;
}) {
  return tipo === "trilha" ? (
    <DiplomaTrilha dados={dados} grande={grande} className={className} />
  ) : (
    <DiplomaCurso dados={dados} grande={grande} className={className} />
  );
}

/* ------------------------------------------------------------- curso ----- */

function DiplomaCurso({
  dados, grande, className,
}: {
  dados: DadosDiploma; grande?: boolean; className?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", grande ? "p-10 sm:p-12" : "p-7", className)}
      style={{ background: FUNDO_NAVY }}
    >
      <div className="grid-lines absolute inset-0" />
      <div
        className="absolute inset-3 rounded-xl border"
        style={{ borderColor: "rgba(200,159,80,0.35)" }}
      />

      <div className="relative text-center">
        <Logo variant="light" size={grande ? "lg" : "md"} completa className="justify-center" />

        <p className={cn("eyebrow text-gold-300", grande ? "mt-7" : "mt-4")}>
          Certificado de conclusão
        </p>

        <p className={cn("text-navy-100/60", grande ? "mt-7 text-sm" : "mt-4 text-xs")}>
          Certificamos que
        </p>
        <p className={cn("mt-1 font-bold text-white", grande ? "text-3xl" : "text-lg")}>
          {dados.aluno}
        </p>
        <p className={cn("text-navy-100/60", grande ? "mt-4 text-sm" : "mt-2.5 text-xs")}>
          concluiu com aproveitamento o curso
        </p>
        <p
          className={cn(
            "gold-text mt-1 font-semibold",
            grande ? "text-xl sm:text-2xl" : "text-sm"
          )}
        >
          {dados.titulo}
        </p>

        <Numeros dados={dados} grande={grande} />
        <CodigoValidacao codigo={dados.codigo} grande={grande} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ trilha ----- */

function DiplomaTrilha({
  dados, grande, className,
}: {
  dados: DadosDiploma; grande?: boolean; className?: string;
}) {
  const habilidades = dados.habilidades ?? [];

  return (
    <div
      className={cn("relative overflow-hidden", grande ? "p-10 sm:p-12" : "p-7", className)}
      style={{ background: FUNDO_NAVY }}
    >
      <div className="grid-lines absolute inset-0 opacity-70" />

      {/* Brilho dourado atrás da medalha. Só na trilha: é o que separa esta
          peça do certificado de curso à primeira olhada. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #C89F50 0%, transparent 70%)" }}
      />

      {/* Moldura dupla — o detalhe que faz o documento parecer impresso. */}
      <div className="absolute inset-2.5 rounded-xl border-2" style={{ borderColor: "rgba(200,159,80,0.55)" }} />
      <div className="absolute inset-[13px] rounded-lg border" style={{ borderColor: "rgba(200,159,80,0.22)" }} />

      <div className="relative text-center">
        <Logo variant="light" size={grande ? "lg" : "md"} completa className="justify-center" />

        {/* Medalha */}
        <span
          className={cn(
            "gold-gradient mx-auto flex items-center justify-center rounded-full text-navy-800 shadow-lg shadow-gold-400/25",
            grande ? "mt-7 h-16 w-16" : "mt-5 h-12 w-12"
          )}
        >
          <Award size={grande ? 30 : 22} />
        </span>

        <p className={cn("eyebrow text-gold-300", grande ? "mt-5" : "mt-3.5")}>
          Certificação de trilha
        </p>

        <p className={cn("text-navy-100/60", grande ? "mt-6 text-sm" : "mt-4 text-xs")}>
          Certificamos que
        </p>
        <p className={cn("mt-1 font-bold text-white", grande ? "text-3xl" : "text-lg")}>
          {dados.aluno}
        </p>
        <p className={cn("text-navy-100/60", grande ? "mt-4 text-sm" : "mt-2.5 text-xs")}>
          concluiu integralmente a trilha de carreira
        </p>
        <p
          className={cn(
            "gold-text mt-1 font-bold leading-tight",
            grande ? "text-2xl sm:text-3xl" : "text-base"
          )}
        >
          {dados.titulo}
        </p>

        {/* As habilidades vêm logo abaixo do nome, menores: é a resposta à
            pergunta que o RH faz em seguida — "isso comprova o quê?". */}
        {habilidades.length > 0 && (
          <div className={cn("mx-auto max-w-lg", grande ? "mt-5" : "mt-3.5")}>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-navy-100/40">
              Habilidades desenvolvidas
            </p>
            <div className={cn("flex flex-wrap justify-center gap-1.5", grande ? "mt-2.5" : "mt-2")}>
              {habilidades.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "rounded-full border border-gold-400/35 bg-gold-400/10 font-semibold text-gold-200",
                    grande ? "px-3 py-1 text-[11px]" : "px-2.5 py-0.5 text-[10px]"
                  )}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        <Numeros dados={dados} grande={grande} trilha />
        <CodigoValidacao codigo={dados.codigo} grande={grande} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ peças ------ */

function Numeros({
  dados, grande, trilha,
}: {
  dados: DadosDiploma; grande?: boolean; trilha?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center text-navy-100/55",
        grande
          ? "mt-8 gap-x-8 gap-y-2 text-xs"
          : "mt-5 gap-x-5 gap-y-1.5 text-[11px]"
      )}
    >
      <span>{dados.cargaHoraria} horas</span>
      <span>{dados.pontosPEPC} pontos PEPC</span>
      {trilha && dados.nivel && <span>Nível {dados.nivel}</span>}
      <span>Emitido em {dataPorExtenso(dados.emitidoEm)}</span>
    </div>
  );
}

function CodigoValidacao({ codigo, grande }: { codigo: string; grande?: boolean }) {
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-center",
          grande ? "mt-8 gap-3" : "mt-5 gap-2.5"
        )}
      >
        <QrCode size={grande ? 34 : 24} className="text-gold-400/70" />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-navy-100/40">
            Código de validação
          </p>
          <p className={cn("font-mono text-gold-300", grande ? "text-sm" : "text-[11px]")}>
            {codigo}
          </p>
        </div>
      </div>

      {grande && (
        <p className="mt-7 flex items-center justify-center gap-1.5 text-[11px] text-navy-100/35">
          <ShieldCheck size={12} /> Confira a autenticidade em /validar/{codigo}
        </p>
      )}
    </>
  );
}
