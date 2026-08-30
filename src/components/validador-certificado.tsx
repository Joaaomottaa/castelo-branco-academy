"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, BadgeCheck, CalendarDays, Clock, Loader2, Search,
  ShieldCheck, Target,
} from "lucide-react";
import { Button, Logo, inputCls } from "@/components/ui";
import { Diploma } from "@/components/certificado";
import { limparCodigo, validarCertificado } from "@/lib/repo-certificados";
import type { CertificadoValidado } from "@/lib/types";

/* ==========================================================================
   PÁGINA PÚBLICA DE VALIDAÇÃO

   Duas portas para o mesmo lugar:

   - `/validar` — o RH digita o código impresso no certificado;
   - `/validar/CBA-2026-XXXX-XXXX` — o link do próprio certificado, que já
     chega validado.

   Quem abre isto normalmente não tem conta. Nada aqui pede login, e a consulta
   passa pela função `validar_certificado`, que devolve só o que o documento já
   mostra no papel.
   ========================================================================== */

function formatarData(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export function ValidadorCertificado({ codigoInicial }: { codigoInicial?: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(codigoInicial ?? "");
  const [estado, setEstado] = useState<"parado" | "consultando" | "pronto">("parado");
  const [resultado, setResultado] = useState<CertificadoValidado | null>(null);

  const consultar = useCallback(async (bruto: string) => {
    const limpo = limparCodigo(bruto);
    if (!limpo) {
      setResultado({ valido: false, motivo: "sem-codigo" });
      setEstado("pronto");
      return;
    }
    setEstado("consultando");
    const r = await validarCertificado(limpo);
    setResultado(r);
    setEstado("pronto");
  }, []);

  // Link direto: valida sozinho, sem a pessoa clicar em nada.
  useEffect(() => {
    if (codigoInicial) void consultar(codigoInicial);
  }, [codigoInicial, consultar]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = limparCodigo(codigo);
    // Sobe o código para a URL: o resultado passa a ser compartilhável, que é
    // exatamente o que se faz com ele em seguida.
    if (limpo && limpo !== codigoInicial) {
      router.push(`/validar/${encodeURIComponent(limpo)}`);
      return;
    }
    void consultar(codigo);
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Cabeçalho próprio, mais enxuto que o do site: quem chega aqui veio
          conferir um documento, não navegar pelo catálogo. */}
      <header className="border-b border-white/10 bg-navy-700">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" aria-label="Castelo Branco Academy">
            <Logo variant="light" />
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-semibold text-navy-100/85 transition hover:text-gold-300"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-700 text-gold-400">
            <ShieldCheck size={26} />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-navy-700">
            Validação de certificado
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Todo certificado emitido pela Castelo Branco Academy tem um código único.
            Digite o código abaixo para conferir a autenticidade, a carga horária e a
            data de conclusão.
          </p>
        </div>

        <form onSubmit={enviar} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CBA-2026-0000-0000"
              aria-label="Código do certificado"
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} pl-10 font-mono tracking-wide`}
            />
          </div>
          <Button type="submit" variant="gold" size="lg" disabled={estado === "consultando"}>
            {estado === "consultando" ? (
              <><Loader2 size={16} className="animate-spin" /> Consultando…</>
            ) : (
              <><ShieldCheck size={16} /> Validar</>
            )}
          </Button>
        </form>

        <div className="mt-9">
          {estado === "consultando" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Consultando o registro…
            </div>
          )}

          {estado === "pronto" && resultado && (
            resultado.valido
              ? <CertificadoAutentico dados={resultado} />
              : <NaoEncontrado motivo={resultado.motivo} codigo={resultado.codigo} />
          )}
        </div>

        <p className="mt-12 text-center text-xs text-muted">
          Dúvidas sobre um certificado?{" "}
          <a
            href="mailto:contato@castelobrancocontabilidade.com.br"
            className="font-semibold text-gold-600 hover:underline"
          >
            Fale com a Castelo Branco
          </a>
        </p>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CertificadoAutentico({ dados }: { dados: CertificadoValidado }) {
  const trilha = dados.tipo === "trilha";
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
        <BadgeCheck size={22} />
        <p className="text-sm font-bold">
          Certificado válido e emitido pela Castelo Branco Academy
        </p>
      </div>

      {/* O mesmo componente que o aluno vê em /app/certificados. Ver a peça
          idêntica dos dois lados é metade da confiança. */}
      <div className="overflow-hidden rounded-2xl">
        <Diploma
          tipo={trilha ? "trilha" : "curso"}
          grande
          dados={{
            aluno: dados.aluno ?? "",
            titulo: dados.titulo ?? "",
            cargaHoraria: dados.cargaHoraria ?? 0,
            pontosPEPC: dados.pontosPEPC ?? 0,
            emitidoEm: dados.emitidoEm ?? "",
            codigo: dados.codigo ?? "",
            nivel: dados.nivel,
            habilidades: dados.habilidades,
          }}
        />
      </div>

      {/* Os mesmos dados em texto: o cartão acima é o documento, esta lista é a
          que se copia para o processo seletivo. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Linha rotulo="Concluinte" valor={dados.aluno} />
        <Linha rotulo={trilha ? "Trilha" : "Curso"} valor={dados.titulo} />
        <Linha rotulo="Área" valor={dados.area} icone={<Target size={15} />} />
        <Linha rotulo="Nível" valor={dados.nivel} />
        <Linha
          rotulo="Carga horária"
          valor={`${dados.cargaHoraria} horas`}
          icone={<Clock size={15} />}
        />
        <Linha
          rotulo="Data de conclusão"
          valor={formatarData(dados.emitidoEm)}
          icone={<CalendarDays size={15} />}
        />
      </div>

    </div>
  );
}

function Linha({
  rotulo, valor, icone,
}: {
  rotulo: string; valor?: string; icone?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        {icone} {rotulo}
      </p>
      <p className="mt-1 text-sm font-semibold text-navy-700">{valor || "—"}</p>
    </div>
  );
}

function NaoEncontrado({ motivo, codigo }: { motivo?: string; codigo?: string }) {
  const vazio = motivo === "sem-codigo";
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
        <AlertCircle size={22} />
      </span>
      <p className="mt-4 text-sm font-bold text-amber-800">
        {vazio ? "Digite um código para consultar" : "Não encontramos esse código"}
      </p>
      <p className="mt-1.5 text-sm text-amber-700/80">
        {vazio
          ? "O código está impresso no rodapé do certificado, no formato CBA-2026-0000-0000."
          : "Confira se o código foi copiado por inteiro, incluindo os hífens. Se ele veio de um PDF, pode ter perdido um caractere na cópia."}
      </p>
      {!vazio && codigo && (
        <p className="mt-3 font-mono text-xs text-amber-700/70">Consultado: {codigo}</p>
      )}
      <div className="mt-5">
        <Button href="/" variant="outline" size="sm">
          Conhecer a Academy <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
