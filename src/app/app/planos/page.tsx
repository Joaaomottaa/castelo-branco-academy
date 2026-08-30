"use client";

import { useState } from "react";
import {
  ArrowRight, BadgeCheck, Check, HelpCircle, Minus, Sparkles, X,
} from "lucide-react";
import { Badge, Button, Card, cn } from "@/components/ui";
import { useSession } from "@/lib/session";
import { planos } from "@/lib/planos";
import { brand } from "@/lib/brand";
import { abrirTino } from "@/lib/tino-abrir";
import { cancelarPlano } from "@/lib/repo-cupons";

export default function PlanosPage() {
  const { user, atualizarPerfil } = useSession();
  const [anual, setAnual] = useState(false);
  const [voltandoAoFree, setVoltandoAoFree] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const meuPlano = (user?.plano ?? "Free").toLowerCase();

  async function confirmarCancelamento() {
    setCancelando(true);
    await cancelarPlano();
    await atualizarPerfil({ plano: "Free" });
    setCancelando(false);
    setVoltandoAoFree(false);
  }

  const ehMeuPlano = (slug: string) =>
    (slug === "free" && meuPlano === "free") ||
    (slug === "pro" && meuPlano === "pro") ||
    (slug === "empresarial" && meuPlano === "enterprise");

  return (
    <div className="space-y-9">
      <div className="text-center">
        <p className="eyebrow text-gold-500">Planos</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight text-navy-700 sm:text-4xl">
          Estude sem limite e prove no mercado o que você aprendeu
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
          O plano gratuito serve para conhecer o método. O Pro é para quem vai usar isso
          na carreira — certificado com validação, pontos de educação continuada e o Tino
          estudando junto.
        </p>

        {/* Alternância mensal/anual */}
        <div className="mt-7 inline-flex items-center rounded-full border border-navy-100 bg-cream p-1">
          <button
            onClick={() => setAnual(false)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              !anual ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:text-navy-700"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setAnual(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition",
              anual ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:text-navy-700"
            )}
          >
            Anual
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              anual ? "bg-gold-400 text-navy-800" : "bg-gold-100 text-gold-600"
            )}>
              −20%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {planos.map((p) => {
          const atual = ehMeuPlano(p.slug);
          return (
            <div
              key={p.slug}
              className={cn(
                "relative flex flex-col rounded-2xl p-7",
                p.destaque
                  ? "border-2 border-gold-400 bg-navy-700 shadow-2xl shadow-navy-700/25 lg:-my-3 lg:py-10"
                  : "border border-navy-100 bg-white"
              )}
            >
              {p.destaque && (
                <span className="gold-gradient absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy-800">
                  Recomendado
                </span>
              )}
              {atual && (
                <span className="absolute right-5 top-5">
                  <Badge tone={p.destaque ? "gold" : "green"}>
                    <BadgeCheck size={11} /> Seu plano
                  </Badge>
                </span>
              )}

              <p className={p.destaque ? "text-sm font-bold text-gold-300" : "text-sm font-bold text-gold-500"}>
                {p.nome}
              </p>

              <div className="mt-3 flex items-end gap-1.5">
                <span className={cn("text-4xl font-bold", p.destaque ? "text-white" : "text-navy-700")}>
                  {anual && p.slug === "pro" ? "R$ 71" : p.preco}
                </span>
                <span className={cn("pb-1 text-sm", p.destaque ? "text-navy-100/60" : "text-muted")}>
                  {p.periodo}
                </span>
              </div>
              {anual && p.slug === "pro" && (
                <p className="mt-1 text-xs text-gold-300">
                  cobrado R$ 852 por ano · economia de R$ 216
                </p>
              )}

              <p className={cn("mt-3 text-sm leading-relaxed", p.destaque ? "text-navy-100/70" : "text-muted")}>
                {p.chamada}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {p.recursos.map((r) => (
                  <li key={r.texto} className="flex items-start gap-2.5 text-sm">
                    {r.incluso ? (
                      <Check
                        size={16}
                        className={cn(
                          "mt-0.5 shrink-0",
                          r.destaque
                            ? p.destaque ? "text-gold-400" : "text-gold-500"
                            : p.destaque ? "text-navy-100/50" : "text-emerald-500"
                        )}
                      />
                    ) : (
                      <Minus size={16} className={cn("mt-0.5 shrink-0", p.destaque ? "text-navy-100/25" : "text-navy-200")} />
                    )}
                    <span
                      className={cn(
                        !r.incluso && "line-through opacity-50",
                        r.destaque && "font-semibold",
                        p.destaque ? "text-navy-100/85" : r.incluso ? "text-ink" : "text-muted"
                      )}
                    >
                      {r.texto}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <Button
                  href={
                    atual
                      ? undefined
                      : p.slug === "empresarial"
                        ? brand.whatsapp
                        : p.slug === "pro"
                          ? `/app/planos/assinar?plano=Pro&ciclo=${anual ? "anual" : "mensal"}`
                          : undefined
                  }
                  onClick={
                    !atual && p.slug === "free" ? () => setVoltandoAoFree(true) : undefined
                  }
                  variant={atual ? "outline" : p.destaque ? "gold" : "outline"}
                  full
                  disabled={atual}
                >
                  {atual ? "Seu plano atual" : p.slug === "free" ? "Voltar ao gratuito" : p.cta}
                  {!atual && <ArrowRight size={15} />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparativo detalhado */}
      <div>
        <h2 className="text-lg font-bold text-navy-700">Comparativo detalhado</h2>
        <div className="tbl mt-4 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-cream/60">
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Recurso
                </th>
                {planos.map((p) => (
                  <th key={p.slug} className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
                    {p.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {COMPARATIVO.map((linha) => (
                <tr key={linha.recurso} className="transition hover:bg-cream/40">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-navy-700">{linha.recurso}</span>
                    {linha.nota && (
                      <span className="mt-0.5 block text-xs text-muted">{linha.nota}</span>
                    )}
                  </td>
                  {linha.valores.map((v, i) => (
                    <td key={i} className="px-5 py-3.5 text-center">
                      {v === true ? (
                        <Check size={17} className="mx-auto text-emerald-500" />
                      ) : v === false ? (
                        <X size={17} className="mx-auto text-navy-200" />
                      ) : (
                        <span className="text-sm font-semibold text-navy-700">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* IA em destaque */}
      <Card className="!border-gold-200 !bg-gold-50">
        <div className="flex flex-wrap items-start gap-5">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-700 text-gold-300">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-navy-700">
              O que muda de verdade com o Tino
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gold-600/90">
              O assistente não é enfeite: ele lê a alternativa que você marcou, identifica
              o raciocínio que te levou ao erro e explica o caminho correto. Também responde
              dúvidas sobre qualquer aula citando a fonte, recomenda o próximo curso pela
              sua trilha e analisa seu currículo apontando as lacunas.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                "Explica por que você errou, não só qual era a certa",
                "Responde sobre as aulas com a fonte citada",
                "Recomenda o próximo curso pela sua trilha",
                "Aponta lacunas do currículo e o que estudar",
              ].map((t) => (
                <p key={t} className="flex items-start gap-2 text-sm text-navy-700">
                  <Check size={15} className="mt-0.5 shrink-0 text-gold-500" /> {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-bold text-navy-700">Perguntas frequentes</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((f) => (
            <Card key={f.p}>
              <p className="flex items-start gap-2.5 text-sm font-bold text-navy-700">
                <HelpCircle size={16} className="mt-0.5 shrink-0 text-gold-500" /> {f.p}
              </p>
              <p className="mt-2 pl-[26px] text-sm leading-relaxed text-muted">{f.r}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="!bg-navy-700 !border-navy-700 text-center">
        <h2 className="text-xl font-bold text-white">Ainda com dúvida sobre qual plano?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-100/70">
          Fale com a equipe pelo WhatsApp ou pergunte ao Tino aqui mesmo na plataforma.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button
            variant="gold"
            onClick={() =>
              abrirTino("Qual plano faz mais sentido para o meu momento? ")
            }
          >
            <Sparkles size={15} /> Perguntar ao Tino
          </Button>
          <Button
            href={brand.whatsapp}
            variant="outline"
            className="!border-white/25 !bg-white/5 !text-white hover:!border-gold-400"
          >
            Falar no WhatsApp
          </Button>
        </div>
      </Card>

      {voltandoAoFree && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm"
          onClick={() => setVoltandoAoFree(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-navy-700">Voltar para o plano gratuito</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Você perde o acesso aos cursos completos, aos certificados e ao Tino nas
              questões. O que você já concluiu — certificados emitidos e progresso —
              continua no seu perfil.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setVoltandoAoFree(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
              >
                Continuar no Pro
              </button>
              <button
                onClick={confirmarCancelamento}
                disabled={cancelando}
                className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {cancelando ? "Cancelando…" : "Voltar ao gratuito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const COMPARATIVO: Array<{ recurso: string; nota?: string; valores: (boolean | string)[] }> = [
  { recurso: "Aulas gratuitas dos cursos", valores: [true, true, true] },
  { recurso: "Cursos completos", valores: [false, true, true] },
  { recurso: "Trilhas de carreira", nota: "Sequência por cargo, com selo próprio", valores: [false, true, true] },
  { recurso: "Certificado com validação pública", valores: [false, true, true] },
  { recurso: "Pontos PEPC", nota: "Educação profissional continuada", valores: [false, true, true] },
  { recurso: "Questões por dia", valores: ["3", "Ilimitadas", "Ilimitadas"] },
  { recurso: "Cadernos de questões", valores: ["1", "Ilimitados", "Ilimitados"] },
  { recurso: "Simulados com nota", valores: [false, true, true] },
  { recurso: "Tino explica o erro na questão", valores: [false, true, true] },
  { recurso: "Assistente sobre as aulas", valores: [false, true, true] },
  { recurso: "Perfil no banco de talentos", valores: [true, true, true] },
  { recurso: "Selo verificado no perfil", valores: [false, true, true] },
  { recurso: "Feed da comunidade", valores: [true, true, true] },
  { recurso: "Mentorias ao vivo", valores: [false, true, true] },
  { recurso: "Licenças por colaborador", valores: [false, false, true] },
  { recurso: "Trilhas obrigatórias por cargo", valores: [false, false, true] },
  { recurso: "Relatórios de evolução do time", valores: [false, false, true] },
  { recurso: "Publicação de vagas", valores: [false, false, "Ilimitada"] },
  { recurso: "Busca avançada no banco de talentos", valores: [false, false, true] },
  { recurso: "Gestor de conta dedicado", valores: [false, false, true] },
];

const FAQ = [
  {
    p: "Posso cancelar quando quiser?",
    r: "Sim. O Pro não tem fidelidade — cancele a qualquer momento e o acesso continua até o fim do período já pago. Os certificados que você emitiu continuam válidos para sempre.",
  },
  {
    p: "O certificado vale pontos de educação continuada?",
    r: "Cada curso tem uma pontuação declarada e o painel acompanha seu total no ano. O credenciamento formal junto ao CFC está no roadmap da plataforma — enquanto isso, o certificado traz carga horária e código público de validação.",
  },
  {
    p: "O que acontece com meus cadernos se eu voltar para o gratuito?",
    r: "Nada é apagado. Você continua vendo tudo, mas só consegue editar o primeiro caderno até assinar de novo.",
  },
  {
    p: "A empresa pode pagar pelo meu plano?",
    r: "Pode. No plano Empresarial a empresa compra licenças e distribui para a equipe, com relatório de quem está evoluindo. Fale com a gente pelo WhatsApp.",
  },
  {
    p: "Esta tela já cobra de verdade?",
    r: "Ainda não. O meio de pagamento está sendo integrado — por enquanto esta página serve para você conhecer as diferenças entre os planos.",
  },
];
