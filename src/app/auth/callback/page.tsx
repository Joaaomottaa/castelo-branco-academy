"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui";
import { useSession } from "@/lib/session";

/* ==========================================================================
   VOLTA DO LOGIN SOCIAL

   O Google devolve a pessoa aqui com `?code=` na URL. O cliente do Supabase
   troca esse código por sessão sozinho — mas leva um instante, e é esse
   instante que esta tela cobre.

   Não há redirecionamento cego: se o provedor recusar, o Google devolve
   `error_description` e a mensagem aparece aqui em vez de a pessoa cair no
   login sem entender o que houve.
   ========================================================================== */

export default function Page() {
  return (
    <Suspense fallback={<Espera />}>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useSession();
  const [demorou, setDemorou] = useState(false);

  const erroProvedor =
    params.get("error_description") ?? params.get("error") ?? null;
  const destino = params.get("destino") || "/app";

  useEffect(() => {
    if (erroProvedor || loading || !user) return;
    // Admin cai no painel dele; o resto vai para onde pediu.
    if (user.role === "admin") {
      router.replace("/admin");
      return;
    }
    // Primeira entrada pelo Google: o perfil tem nome e foto, e mais nada.
    // Terminar o cadastro vem antes do painel — e o destino original é levado
    // junto, para a pessoa chegar onde queria depois de finalizar.
    if (user.cadastroCompleto === false) {
      router.replace(`/completar-cadastro?destino=${encodeURIComponent(destino)}`);
      return;
    }
    router.replace(destino);
  }, [user, loading, erroProvedor, destino, router]);

  // Se em 12 segundos não houve sessão, algo travou no caminho — melhor
  // oferecer uma saída que deixar a pessoa olhando um spinner eterno.
  useEffect(() => {
    const t = setTimeout(() => setDemorou(true), 12000);
    return () => clearTimeout(t);
  }, []);

  if (erroProvedor) {
    return (
      <Moldura>
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle size={24} />
        </span>
        <h1 className="mt-4 text-lg font-bold text-navy-700">
          Não deu para entrar com o Google
        </h1>
        {/* A mensagem do provedor vem como um bloco só, sem espaço para
            quebrar — no celular ela empurrava a tela para o lado. */}
        <p className="mx-auto mt-2 max-w-sm break-words text-sm leading-relaxed text-muted">
          {erroProvedor}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-600"
        >
          Voltar para o login
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <Loader2 size={28} className="mx-auto animate-spin text-gold-500" />
      <h1 className="mt-4 text-lg font-bold text-navy-700">Entrando…</h1>
      <p className="mt-1.5 text-sm text-muted">
        Confirmando sua conta com o Google.
      </p>
      {demorou && (
        <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-muted">
          Está demorando mais que o normal.{" "}
          <Link href="/login" className="font-semibold text-gold-600 hover:underline">
            Voltar ao login
          </Link>{" "}
          e tentar de novo costuma resolver.
        </p>
      )}
    </Moldura>
  );
}

function Espera() {
  return (
    <Moldura>
      <Loader2 size={28} className="mx-auto animate-spin text-gold-500" />
      <h1 className="mt-4 text-lg font-bold text-navy-700">Entrando…</h1>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center">
      <Logo className="mb-8" />
      {children}
    </div>
  );
}
