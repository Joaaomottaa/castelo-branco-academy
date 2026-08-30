"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const sb = getSupabase();
    if (sb) {
      await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
    } else {
      await new Promise((r) => setTimeout(r, 700));
    }
    setCarregando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={26} />
        </span>
        <h1 className="text-2xl font-bold text-navy-700">Verifique seu e-mail</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Se existir uma conta para <strong className="text-navy-700">{email}</strong>,
          enviamos um link de redefinição de senha. O link expira em 60 minutos.
        </p>
        <div className="mt-8">
          <Button href="/login" variant="outline" full>
            <ArrowLeft size={15} /> Voltar para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Voltar
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
        Recuperar senha
      </h1>
      <p className="mt-2 text-sm text-muted">
        Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-5">
        <Field label="E-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className={inputCls}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" full disabled={carregando}>
          {carregando ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Mail size={16} /> Enviar link de recuperação
            </>
          )}
        </Button>
      </form>
    </>
  );
}
