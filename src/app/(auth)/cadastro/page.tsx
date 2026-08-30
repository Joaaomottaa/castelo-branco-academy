"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowRight, BadgePercent, Building2, Check, Eye, EyeOff,
  FlaskConical, GraduationCap, KeyRound, Loader2, MailCheck,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { Button, Field, cn, inputCls } from "@/components/ui";
import { BotaoGoogle, BotaoLinkedIn } from "@/components/botao-google";
import { lerConvite, type ConvitePublico } from "@/lib/repo-empresa";
import type { Role } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CadastroPage />
    </Suspense>
  );
}

function CadastroPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { cadastrar, modoDemo, supabaseDisponivel } = useSession();

  // Quem chega por um link de convite entra como profissional: a conta de
  // empresa é do contrato, não de quem foi convidado para o time dela.
  const codigoConvite = params.get("convite") ?? "";
  const [convite, setConvite] = useState<ConvitePublico | null>(null);

  const [role, setRole] = useState<Role>(
    params.get("perfil") === "empresa" && !codigoConvite ? "empresa" : "aluno"
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [social, setSocial] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (!codigoConvite) return;
    let ativo = true;
    lerConvite(codigoConvite).then((c) => { if (ativo && c.valido) setConvite(c); });
    return () => { ativo = false; };
  }, [codigoConvite]);

  const forca = medirForca(senha);
  // Só reclama quando já dá para comparar: apontar "não conferem" na primeira
  // tecla do segundo campo é ruído, não ajuda.
  const divergem = confirmarSenha.length > 0 && senha !== confirmarSenha;
  const conferem = confirmarSenha.length > 0 && senha === confirmarSenha;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    if (senha !== confirmarSenha) return setErro("As duas senhas não conferem.");
    if (!aceite) return setErro("É preciso aceitar os termos e a política de privacidade.");
    setCarregando(true);
    const r = await cadastrar({ nome, email, senha, role });
    setCarregando(false);

    if (r.error) return setErro(r.error);

    // O projeto exige confirmação de e-mail: não há sessão, então navegar para
    // /app só devolveria a pessoa ao login sem explicação nenhuma.
    if (r.confirmarEmail) return setConfirmar(true);

    // Não vai direto para o painel: falta telefone, cidade e o momento de
    // carreira. É a mesma tela por onde passa quem entrou pelo Google — o
    // formulário daqui fica curto de propósito.
    // Com convite, a pessoa volta para a tela dele depois de completar o
    // cadastro — e vê de quem é a empresa antes de entrar no time.
    router.push(
      codigoConvite
        ? `/completar-cadastro?destino=${encodeURIComponent(`/convite/${codigoConvite}`)}`
        : "/completar-cadastro"
    );
  }

  if (confirmar) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <MailCheck size={26} />
        </span>
        <h1 className="text-2xl font-bold text-navy-700">Confirme seu e-mail</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A conta de <strong className="text-navy-700">{email}</strong> foi criada, mas o
          projeto exige confirmação. Abra o link que enviamos e depois faça login.
        </p>
        <p className="mt-4 rounded-xl border border-gold-200 bg-gold-50 p-3 text-xs leading-relaxed text-gold-600/90">
          Em desenvolvimento, desative isso em <strong>Authentication › Sign In /
          Providers › Email › Confirm email</strong> e cadastre de novo.
        </p>
        <div className="mt-6">
          <Button href="/login" variant="outline" full>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Criar conta</h1>
      <p className="mt-2 text-sm text-muted">
        Leva menos de um minuto. Comece pelas aulas gratuitas.
      </p>

      {convite && (
        <div
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: `${convite.empresaCor ?? "#00204D"}33` }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: convite.empresaCor ?? "#00204D" }}
            >
              <Building2 size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-navy-700">
                {convite.empresa} convidou você para a equipe
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs leading-relaxed text-muted">
                {convite.tipo === "licenca" ? (
                  <>
                    <KeyRound size={12} className="text-gold-500" />
                    Plano Pro liberado pela empresa assim que a conta estiver pronta.
                  </>
                ) : (
                  <>
                    <BadgePercent size={12} className="text-teal" />
                    {convite.descontoPct}% de desconto no plano Pro.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {modoDemo && supabaseDisponivel && (
        <p className="mt-6 flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50 p-4 text-xs leading-relaxed text-gold-600/90">
          <FlaskConical size={15} className="mt-0.5 shrink-0 text-gold-500" />
          <span>
            <strong className="text-gold-600">Modo demonstração.</strong> A conta será
            criada só neste navegador e <strong>não vai para o banco</strong>. Para criar
            uma conta real, mude a chave para <strong>Supabase</strong> na tela de login.
          </span>
        </p>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <BotaoGoogle
          aoErro={setErro}
          ocupado={social}
          setOcupado={setSocial}
          rotulo="Criar com Google"
        />
        <BotaoLinkedIn aoErro={setErro} ocupado={social} setOcupado={setSocial} rotulo="Criar com LinkedIn" />
      </div>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-navy-100" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          ou com e-mail
        </span>
        <span className="h-px flex-1 bg-navy-100" />
      </div>

      {!convite && (
      <div className="grid gap-3 sm:grid-cols-2">
        <TipoConta
          ativo={role === "aluno"}
          onClick={() => setRole("aluno")}
          icon={<GraduationCap size={18} />}
          titulo="Sou profissional"
          desc="Estudar e entrar no banco de talentos"
        />
        <TipoConta
          ativo={role === "empresa"}
          onClick={() => setRole("empresa")}
          icon={<Building2 size={18} />}
          titulo="Sou empresa"
          desc="Treinar o time e contratar"
        />
      </div>
      )}

      <form onSubmit={onSubmit} className="mt-7 space-y-5">
        <Field label={role === "empresa" ? "Razão social" : "Nome completo"}>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={role === "empresa" ? "TransLog Brasil Ltda" : "Maria Silva"}
            className={inputCls}
          />
        </Field>

        {/* Pedir "e-mail corporativo" de um profissional afasta quem ainda
            está entre empregos ou trabalha por conta — exatamente o público
            do banco de talentos. Para a empresa, o corporativo faz sentido. */}
        <Field label={role === "empresa" ? "E-mail corporativo" : "E-mail"}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={role === "empresa" ? "contato@empresa.com.br" : "voce@email.com"}
            className={inputCls}
          />
        </Field>

        <Field label="Senha" hint="Mínimo de 6 caracteres.">
          <div className="relative">
            <input
              type={verSenha ? "text" : "password"}
              required
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className={`${inputCls} pr-11`}
            />
            {/* Ver a senha resolve metade dos erros de digitação — e é o que
                evita transformar a confirmação em um segundo obstáculo. */}
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-navy-700"
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {senha && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition",
                      i < forca.nivel
                        ? ["bg-red-400", "bg-amber-400", "bg-emerald-500"][forca.nivel - 1]
                        : "bg-navy-100"
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] font-semibold text-muted">{forca.rotulo}</span>
            </div>
          )}
        </Field>

        <Field label="Confirmar senha">
          <input
            type={verSenha ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="••••••••"
            className={cn(
              inputCls,
              divergem && "!border-red-300 focus:!border-red-400",
              conferem && "!border-emerald-300"
            )}
          />
          {divergem && (
            <p className="mt-2 text-xs font-semibold text-red-500">
              As duas senhas não conferem.
            </p>
          )}
          {conferem && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Check size={13} /> As senhas conferem.
            </p>
          )}
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
          />
          <span>
            Li e aceito os{" "}
            <span className="font-semibold text-navy-700">Termos de Uso</span> e a{" "}
            <span className="font-semibold text-navy-700">Política de Privacidade</span>,
            incluindo o tratamento dos meus dados conforme a LGPD.
          </span>
        </label>

        {erro && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <Button type="submit" variant="gold" size="lg" full disabled={carregando || divergem}>
          {carregando ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Criando conta…
            </>
          ) : (
            <>
              Criar minha conta <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>

      <ul className="mt-7 space-y-2">
        {[
          "Acesso imediato às aulas gratuitas de todos os cursos",
          "Perfil no banco de talentos sem custo",
          "Cancele quando quiser, sem multa",
        ].map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm text-muted">
            <Check size={15} className="text-gold-500" /> {t}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-navy-700 hover:text-gold-600">
          Entrar
        </Link>
      </p>
    </>
  );
}

function TipoConta({
  ativo, onClick, icon, titulo, desc,
}: {
  ativo: boolean; onClick: () => void; icon: React.ReactNode; titulo: string; desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-4 text-left transition",
        ativo
          ? "border-gold-400 bg-gold-50"
          : "border-navy-100 bg-white hover:border-navy-200"
      )}
    >
      <span className={ativo ? "text-gold-500" : "text-navy-400"}>{icon}</span>
      <p className="mt-2 text-sm font-bold text-navy-700">{titulo}</p>
      <p className="mt-0.5 text-xs text-muted">{desc}</p>
    </button>
  );
}

function medirForca(s: string) {
  let n = 0;
  if (s.length >= 6) n++;
  if (s.length >= 10 && /[0-9]/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s) && /[A-Z]/.test(s)) n++;
  return { nivel: n, rotulo: ["Fraca", "Fraca", "Média", "Forte"][n] };
}
