"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Award, CheckCircle2, Medal, PartyPopper, Star, X,
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { ChipSelo, SeloTrilha } from "@/components/selos";
import {
  avaliarCurso, avaliarTrilha, idDaTrilha, resumoConclusao,
} from "@/lib/repo-conclusao";
import type { ResumoConclusao } from "@/lib/types";

/* ==========================================================================
   CONCLUSÃO DO CURSO

   O certificado sempre nasceu no banco, no trigger que observa a última aula.
   O que faltava era alguém contar isso para a pessoa: ela terminava o curso e
   a tela seguia igual, como se nada tivesse acontecido.

   Esta é a única tela que pede avaliação, e ela pede uma vez só — no fim do
   curso inteiro. Nota e comentário são opcionais dos dois lados: quem quer só
   o certificado fecha e segue.
   ========================================================================== */

export function ConclusaoCurso({
  cursoId,
  cursoTitulo,
  aoFechar,
}: {
  cursoId: string;
  cursoTitulo: string;
  aoFechar: () => void;
}) {
  const [resumo, setResumo] = useState<ResumoConclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avaliado, setAvaliado] = useState(false);

  const carregar = useCallback(async () => {
    const { resumo: r, erro: e } = await resumoConclusao(cursoId);
    if (e) setErro(e);
    if (r) {
      setResumo(r);
      setAvaliado(r.avaliado);
    }
  }, [cursoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aoFechar]);

  async function enviarAvaliacao() {
    setEnviando(true);
    await avaliarCurso(cursoId, nota, comentario);

    // A trilha fechada junto com o curso também merece a pergunta — mas uma
    // vez só, e com a mesma nota que a pessoa acabou de dar.
    for (const t of trilhasNovas) {
      if (t.avaliada) continue;
      const id = await idDaTrilha(t.slug);
      if (id) await avaliarTrilha(id, nota, comentario);
    }

    setEnviando(false);
    setAvaliado(true);
  }

  const cert = resumo?.certificado;
  const selos = (resumo?.habilidades ?? []).filter((h) => h.selo);

  // Só as trilhas fechadas AGORA. As antigas também incluem este curso, e
  // anunciá-las de novo transformaria a comemoração em repetição.
  const trilhasNovas = (resumo?.trilhas ?? []).filter((t) => t.nova);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/75 p-3 backdrop-blur-sm sm:p-4"
      onClick={aoFechar}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa de parabéns */}
        <div
          className="relative shrink-0 overflow-hidden px-5 py-6 text-center sm:px-7 sm:py-7"
          style={{ background: "linear-gradient(135deg, #00204D 0%, #001838 100%)" }}
        >
          <div className="grid-lines absolute inset-0" />
          <button
            onClick={aoFechar}
            className="absolute right-4 top-4 text-white/60 transition hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          <span className="gold-gradient relative mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl text-navy-800">
            <PartyPopper size={30} />
          </span>
          <h2 className="relative mt-4 text-2xl font-bold text-white">
            Curso concluído
          </h2>
          <p className="relative mt-1 text-sm text-navy-100/70">{cursoTitulo}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {erro && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          {!resumo && !erro && (
            <p className="py-6 text-center text-sm text-muted">Emitindo certificado…</p>
          )}

          {/* Certificado */}
          {cert && (
            <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4 sm:p-5">
              {/* O botão dividia a linha com o brasão e os dados do
                  certificado: em 360px sobravam uns 50px para "40h · 12
                  pontos PEPC". No celular ele desce para a linha de baixo. */}
              <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                <span className="gold-gradient inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-navy-800">
                  <Award size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold-600">
                    Certificado emitido
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy-700">
                    {cert.cargaHoraria}h · {cert.pontosPEPC} pontos PEPC
                  </p>
                  <p className="mt-0.5 break-all font-mono text-xs text-gold-600">{cert.codigo}</p>
                </div>
                <Button
                  href="/app/certificados"
                  variant="gold"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Ver certificado
                </Button>
              </div>
            </div>
          )}

          {resumo && !cert && (
            <p className="rounded-xl border border-navy-100 bg-cream/60 p-4 text-sm text-muted">
              O certificado é liberado quando todas as {resumo.totalAulas} aulas estão
              concluídas — você está em {resumo.aulasFeitas}.
            </p>
          )}

          {/* Selos de habilidade ganhos */}
          {selos.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-600">
                <Medal size={13} className="text-gold-500" /> Habilidades conquistadas
              </p>
              <p className="mt-1 text-xs text-muted">
                Aparecem no seu perfil e no banco de talentos — as empresas veem que
                vieram de curso concluído.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selos.map((h) => (
                  <ChipSelo
                    key={h.nome}
                    habilidade={{
                      nome: h.nome,
                      selo: h.selo,
                      origem: "curso",
                      nivel: 0,
                      cursoTitulo,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Selo dourado de trilha */}
          {trilhasNovas.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-600">
                <Award size={13} />{" "}
                {trilhasNovas.length === 1
                  ? "Você fechou uma trilha completa"
                  : `Você fechou ${trilhasNovas.length} trilhas completas`}
              </p>
              <div className="mt-3 space-y-3">
                {trilhasNovas.map((t) => (
                  <SeloTrilha key={t.slug} selo={t} />
                ))}
              </div>
            </div>
          )}

          {/* Avaliação */}
          <div className="rounded-2xl border border-navy-100 bg-cream/50 p-4 sm:p-5">
            {avaliado ? (
              <p className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-emerald-600">
                <CheckCircle2 size={16} /> Obrigado pela avaliação
              </p>
            ) : (
              <>
                <p className="text-sm font-bold text-navy-700">Como foi o curso?</p>
                <p className="mt-0.5 text-xs text-muted">
                  Tudo é opcional e leva dez segundos. A nota entra na média que
                  aparece no catálogo.
                </p>

                <div className="mt-4 flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNota(n === nota ? null : n)}
                      aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                      className="transition hover:scale-110"
                    >
                      <Star
                        size={30}
                        className={cn(
                          "transition",
                          nota !== null && n <= nota
                            ? "fill-gold-400 text-gold-400"
                            : "text-navy-200"
                        )}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="O que ajudou de verdade? O que faltou? (opcional)"
                  className="mt-4 w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-gold-400"
                />

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={aoFechar}
                    className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:text-navy-700 sm:min-w-0 sm:flex-none"
                  >
                    Agora não
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={enviarAvaliacao}
                    disabled={enviando || (nota === null && !comentario.trim())}
                    className="min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none"
                  >
                    {enviando ? "Enviando…" : "Enviar avaliação"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-navy-100 px-5 py-4 sm:gap-3 sm:px-6">
          <Link
            href="/app/cursos"
            className="text-sm font-semibold text-muted transition hover:text-navy-700"
          >
            Ver outros cursos
          </Link>
          <Button variant="gold" onClick={aoFechar}>
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
