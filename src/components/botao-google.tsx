"use client";

import { useSession } from "@/lib/session";

/* ==========================================================================
   ENTRAR COM GOOGLE

   Estava só no login. Passou a ser componente próprio quando a tela de criar
   conta também precisou dele — e são a mesma coisa: o Google não distingue
   "entrar" de "cadastrar", quem não tem conta ganha uma na volta.
   ========================================================================== */

function IconeGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

export function BotaoGoogle({
  aoErro, ocupado, setOcupado, rotulo = "Google",
}: {
  aoErro: (m: string) => void;
  ocupado: boolean;
  setOcupado: (v: boolean) => void;
  rotulo?: string;
}) {
  const { entrarComGoogle, modoDemo } = useSession();

  async function entrar() {
    aoErro("");
    setOcupado(true);
    const r = await entrarComGoogle();
    // Se deu certo, o navegador já está saindo para o Google — não desligue o
    // "ocupado", senão o botão pisca de volta antes do redirecionamento.
    if (r.error) {
      setOcupado(false);
      aoErro(r.error);
    }
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={ocupado || modoDemo}
      title={
        modoDemo
          ? "No modo demonstração, use uma das contas de teste"
          : "Continuar com a sua conta Google"
      }
      className="flex items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <IconeGoogle /> {ocupado ? "Abrindo…" : rotulo}
    </button>
  );
}

function IconeLinkedIn() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/**
 * Entrar com LinkedIn.
 *
 * Faz sentido especial aqui: o LinkedIn é onde o certificado desta plataforma
 * vai parar (ver "Adicionar ao perfil" em /app/certificados), e é de lá que
 * vem o perfil profissional que alimenta o banco de talentos.
 */
export function BotaoLinkedIn({
  aoErro, ocupado, setOcupado, rotulo = "LinkedIn",
}: {
  aoErro: (m: string) => void;
  ocupado: boolean;
  setOcupado: (v: boolean) => void;
  rotulo?: string;
}) {
  const { entrarComProvedor, modoDemo } = useSession();

  async function entrar() {
    aoErro("");
    setOcupado(true);
    const r = await entrarComProvedor("linkedin_oidc");
    // Deu certo: o navegador já está saindo para o LinkedIn. Desligar o
    // "ocupado" aqui faria o botão piscar de volta antes do redirecionamento.
    if (r.error) {
      setOcupado(false);
      aoErro(r.error);
    }
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={ocupado || modoDemo}
      title={
        modoDemo
          ? "No modo demonstração, use uma das contas de teste"
          : "Continuar com a sua conta LinkedIn"
      }
      className="flex items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <IconeLinkedIn /> {ocupado ? "Abrindo…" : rotulo}
    </button>
  );
}
