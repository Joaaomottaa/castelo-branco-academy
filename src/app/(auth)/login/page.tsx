"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useSession } from "@/lib/session";
import { BotaoGoogle, BotaoLinkedIn } from "@/components/botao-google";
import { Button, Field, inputCls } from "@/components/ui";
import { SeletorDeModo } from "@/components/seletor-modo";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Quem chegou aqui por um link de convite volta para ele depois de entrar.
  // Só caminho interno: `?destino=https://…` viraria redirecionamento aberto.
  const bruto = params.get("destino") ?? "";
  const destino = bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : "";
  const { entrar, modoDemo, supabaseDisponivel } = useSession();
  const [social, setSocial] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const r = await entrar(email, senha);
    setCarregando(false);
    if (r.error) return setErro(r.error);
    router.push(destino || (r.user?.role === "admin" ? "/admin" : "/app"));
  }

  function preencher(tipo: "aluno" | "empresa" | "admin") {
    setEmail(`${tipo}@castelobranco.com.br`);
    setSenha("123456");
    setErro("");
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-navy-700">
        Bem-vindo de volta
      </h1>
      <p className="mt-2 text-sm text-muted">
        Entre para continuar sua trilha e acompanhar suas oportunidades.
      </p>

      <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold-600">
              <Info size={14} /> Contas de demonstração
            </p>
            <SeletorDeModo compacto />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gold-600/85">
            {modoDemo
              ? supabaseDisponivel
                ? "Rodando com os dados locais — o banco não é tocado. Senha 123456:"
                : "O Supabase ainda não está conectado. Use uma das contas abaixo (senha 123456):"
              : "As mesmas contas existem no banco, criadas pelo 03_usuarios_demo.sql (senha 123456):"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["aluno", "empresa", "admin"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => preencher(t)}
                className="rounded-full border border-gold-300 bg-white px-3 py-1 text-[11px] font-semibold capitalize text-gold-600 transition hover:bg-gold-100"
              >
                {t}
              </button>
            ))}
          </div>
      </div>

      <form onSubmit={onSubmit} className="mt-7 space-y-5">
        <Field label="E-mail">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className={inputCls}
          />
        </Field>

        <Field label="Senha">
          <div className="relative">
            <input
              type={verSenha ? "text" : "password"}
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className={inputCls + " pr-11"}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-navy-600"
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="h-4 w-4 rounded border-navy-200 accent-[#C89F50]" />
            Lembrar de mim
          </label>
          <Link href="/recuperar-senha" className="text-sm font-semibold text-gold-600 hover:underline">
            Esqueci a senha
          </Link>
        </div>

        {erro && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" full disabled={carregando}>
          {carregando ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Entrando…
            </>
          ) : (
            <>
              Entrar <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-navy-100" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">ou</span>
        <span className="h-px flex-1 bg-navy-100" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BotaoGoogle aoErro={setErro} ocupado={social} setOcupado={setSocial} />
        <BotaoLinkedIn />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-navy-700 hover:text-gold-600">
          Criar conta gratuita
        </Link>
      </p>
    </>
  );
}

