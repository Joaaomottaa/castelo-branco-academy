"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, BadgePercent, Building2, CheckCircle2, KeyRound,
  Loader2, LogIn, Sparkles, UserPlus,
} from "lucide-react";
import { Button, Card, Logo, cn } from "@/components/ui";
import { useSession } from "@/lib/session";
import { aceitarConvite, lerConvite, type ConvitePublico } from "@/lib/repo-empresa";
import { esquecerEmpresaEmCache } from "@/lib/empresa-sessao";

/* ==========================================================================
   A TELA DO CONVITE

   Três estados possíveis para quem abre o link:

   1. Sem conta  → precisa se cadastrar, e o código viaja junto na URL para
                   ser aceito assim que a conta existir.
   2. Com conta  → um clique e pronto.
   3. Já é do time → não faz nada, só avisa.

   O convite é mostrado antes de qualquer pedido de login. Pedir a senha para
   depois revelar de quem era o convite é o jeito mais rápido de a pessoa
   fechar a aba.
   ========================================================================== */

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  "nao-encontrado": {
    titulo: "Convite não encontrado",
    texto: "Confira se o código foi copiado inteiro. Ele tem o formato CB-0000-0000.",
  },
  "ja-usado": {
    titulo: "Este convite já foi usado",
    texto: "Cada código vale para uma pessoa. Peça um novo ao gestor da sua empresa.",
  },
  cancelado: {
    titulo: "Convite cancelado",
    texto: "O gestor cancelou este convite. Fale com ele para receber outro.",
  },
  expirado: {
    titulo: "Convite expirado",
    texto: "Os convites valem 30 dias. Peça ao gestor para gerar um novo — leva um minuto.",
  },
};

export function TelaDoConvite({ codigo }: { codigo: string }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    lerConvite(codigo).then((c) => { if (ativo) setConvite(c); });
    return () => { ativo = false; };
  }, [codigo]);

  async function aceitar() {
    setErro("");
    setAceitando(true);
    const r = await aceitarConvite(codigo);
    setAceitando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui aceitar o convite.");
    // A barra lateral mostra a empresa; sem limpar o cache ela só apareceria
    // no próximo carregamento completo da aplicação.
    esquecerEmpresaEmCache();
    setPronto(true);
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-navy-700">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" aria-label="Castelo Branco Academy">
            <Logo variant="light" />
          </Link>
          {!user && (
            <Link
              href="/login"
              className="text-[13px] font-semibold text-navy-100/85 transition hover:text-gold-300"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        {convite === null ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Abrindo o convite…
          </p>
        ) : !convite.valido ? (
          <Card className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertCircle size={24} />
            </span>
            <h1 className="mt-4 text-xl font-bold text-navy-700">
              {MOTIVOS[convite.motivo ?? "nao-encontrado"].titulo}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {MOTIVOS[convite.motivo ?? "nao-encontrado"].texto}
            </p>
            <p className="mt-4 font-mono text-xs text-muted">{codigo.toUpperCase()}</p>
            <div className="mt-6">
              <Button href="/">Ir para a página inicial</Button>
            </div>
          </Card>
        ) : pronto ? (
          <Card className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </span>
            <h1 className="mt-4 text-xl font-bold text-navy-700">
              Você agora faz parte da {convite.empresa}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              {convite.tipo === "licenca" ? (
                <>
                  O plano <strong className="text-navy-700">Pro</strong> foi liberado pela
                  empresa: cursos e trilhas completos, certificados com validação e o Tino
                  explicando cada questão. As formações que a empresa indicar aparecem no
                  seu painel.
                </>
              ) : (
                <>
                  Seu desconto de <strong className="text-navy-700">{convite.descontoPct}%</strong> no
                  plano Pro já está valendo, e as formações indicadas pela empresa aparecem
                  no seu painel.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button href="/app" variant="gold" className="w-full sm:w-auto">
                Ir para o meu painel <ArrowRight size={15} />
              </Button>
              {convite.tipo === "desconto" && (
                <Button href="/app/planos" variant="ghost" className="w-full sm:w-auto">
                  Ver o plano Pro
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-center">
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                style={{ background: `linear-gradient(135deg, ${convite.empresaCor ?? "#00204D"}, #0d3563)` }}
              >
                <Building2 size={26} />
              </span>
              <p className="eyebrow mt-4 text-gold-500">Convite de equipe</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-700">
                {convite.empresa} convidou você
              </h1>
              {convite.cidade && (
                <p className="mt-1 text-sm text-muted">{convite.cidade}/{convite.uf}</p>
              )}
            </div>

            <div className={cn(
              "mt-6 rounded-2xl border p-4 sm:p-5",
              convite.tipo === "licenca"
                ? "border-gold-200 bg-gold-50/60"
                : "border-teal/25 bg-teal/5"
            )}>
              <p className="flex items-start gap-2 text-sm font-bold leading-snug text-navy-700">
                {convite.tipo === "licenca"
                  ? <><KeyRound size={16} className="mt-0.5 shrink-0 text-gold-500" /> Licença Pro por conta da empresa</>
                  : <><BadgePercent size={16} className="mt-0.5 shrink-0 text-teal" /> {convite.descontoPct}% de desconto no plano Pro</>}
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
                {(convite.tipo === "licenca"
                  ? [
                      "Todos os cursos e trilhas de carreira, sem custo para você",
                      "Certificados com código público de validação e pontos PEPC",
                      "O Tino explicando por que você errou cada questão",
                      "As formações que a empresa indicar aparecem no seu painel",
                    ]
                  : [
                      `Plano Pro com ${convite.descontoPct}% de desconto enquanto você estiver no time`,
                      "Vínculo com a empresa no seu perfil",
                      "As formações que a empresa indicar aparecem no seu painel",
                    ]
                ).map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Sparkles size={13} className="mt-1 shrink-0 text-gold-500" />
                    {t}
                  </li>
                ))}
              </ul>
              {convite.cargo && (
                <p className="mt-3 text-xs text-muted">
                  Cargo indicado pelo gestor: <strong className="text-navy-700">{convite.cargo}</strong>
                  {convite.papel === "gestor" && " · com permissão de gestor da equipe"}
                </p>
              )}
            </div>

            {erro && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
              </p>
            )}

            <div className="mt-6">
              {loading ? (
                <p className="flex items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Verificando a sua sessão…
                </p>
              ) : user ? (
                <>
                  <Button
                    variant="gold"
                    full
                    onClick={() => void aceitar()}
                    disabled={aceitando}
                  >
                    {aceitando
                      ? <Loader2 size={16} className="animate-spin" />
                      : <CheckCircle2 size={16} />}
                    Aceitar convite como {user.nome.split(" ")[0]}
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted">
                    Não é você?{" "}
                    <button
                      onClick={() => router.push("/login")}
                      className="font-semibold text-gold-600 underline underline-offset-2"
                    >
                      Entrar com outra conta
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <Button
                    href={`/cadastro?convite=${encodeURIComponent(codigo)}${
                      convite.email ? `&email=${encodeURIComponent(convite.email)}` : ""
                    }`}
                    variant="gold"
                    full
                  >
                    <UserPlus size={16} /> Criar minha conta e entrar no time
                  </Button>
                  <Button
                    href={`/login?destino=${encodeURIComponent(`/convite/${codigo}`)}`}
                    variant="ghost"
                    full
                  >
                    <LogIn size={16} /> Já tenho conta
                  </Button>
                </div>
              )}
            </div>

            <p className="mt-5 text-center font-mono text-[11px] text-muted">
              {convite.codigo}
              {convite.expiraEm && (
                <> · válido até {new Date(convite.expiraEm).toLocaleDateString("pt-BR")}</>
              )}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
