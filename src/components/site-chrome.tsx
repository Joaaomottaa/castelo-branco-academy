"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import { Avatar, Button, Logo, cn } from "./ui";
import { useSession } from "@/lib/session";
import { brand } from "@/lib/brand";

const nav = [
  { label: "Cursos", href: "/#cursos" },
  { label: "Trilhas", href: "/#trilhas" },
  { label: "Banco de Talentos", href: "/#talentos" },
  { label: "Para empresas", href: "/#empresas" },
  { label: "Planos", href: "/#planos" },
];

/* ==========================================================================
   O cabeçalho do site público precisa saber quem está logado.

   Antes ele mostrava "Entrar / Começar agora" para todo mundo, inclusive para
   quem tinha acabado de sair do painel — enquanto o Tino, no canto, continuava
   chamando a pessoa pelo nome. Duas partes da mesma tela discordando sobre se
   havia sessão.
   ========================================================================== */
export function SiteHeader() {
  const [aberto, setAberto] = useState(false);
  const { user, loading } = useSession();
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-700/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="Castelo Branco Academy">
          <Logo variant="light" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[13px] font-medium text-navy-100/85 transition hover:text-gold-300"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {/* Enquanto a sessão carrega não se mostra nem um nem outro: piscar
              "Entrar" e trocar por um nome meio segundo depois é pior do que
              esperar. */}
          {loading ? (
            <span className="h-9 w-32" aria-hidden="true" />
          ) : user ? (
            <>
              <Link
                href="/app"
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition hover:bg-white/10"
                title="Ir para o meu painel"
              >
                <Avatar nome={user.nome} url={user.avatar} size={30} />
                <span className="text-[13px] font-semibold text-white">
                  {user.nome.split(" ")[0]}
                </span>
              </Link>
              <Button href={user.role === "admin" ? "/admin" : "/app"} variant="gold" size="sm">
                <LayoutDashboard size={14} /> Meu painel
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-semibold text-white transition hover:text-gold-300"
              >
                Entrar
              </Link>
              <Button href="/cadastro" variant="gold" size="sm">
                Começar agora <ArrowRight size={14} />
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setAberto((a) => !a)}
          className="text-white lg:hidden"
          aria-label="Abrir menu"
        >
          {aberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-white/10 bg-navy-800 lg:hidden",
          aberto ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="space-y-1 px-5 py-4">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setAberto(false)}
              className="block rounded-lg px-3 py-2 text-sm text-navy-100 hover:bg-white/5"
            >
              {n.label}
            </Link>
          ))}
          {user ? (
            <div className="pt-3">
              <Link
                href="/app"
                onClick={() => setAberto(false)}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5"
              >
                <Avatar nome={user.nome} url={user.avatar} size={34} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {user.nome}
                  </span>
                  <span className="block text-[11px] text-navy-100/70">
                    Ir para o meu painel
                  </span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex gap-2 pt-3">
              <Button href="/login" variant="outline" size="sm" full>
                Entrar
              </Button>
              <Button href="/cadastro" variant="gold" size="sm" full>
                Criar conta
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="brand-gradient border-t border-white/10">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Logo variant="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-100/70">
            A escola do profissional contábil que decide. Formação prática em tributário,
            logística e comércio exterior, com certificação reconhecida e conexão direta
            com o mercado.
          </p>
          <div className="mt-6 flex gap-3">
            <Button href={brand.whatsapp} variant="gold" size="sm">
              Falar com a equipe
            </Button>
            <Button href={brand.site} variant="outline" size="sm" className="!border-white/25 !bg-transparent !text-white hover:!text-gold-300">
              Site institucional
            </Button>
          </div>
        </div>

        <FooterCol
          titulo="Plataforma"
          links={[
            ["Cursos", "/#cursos"],
            ["Trilhas de carreira", "/#trilhas"],
            ["Certificados", "/app/certificados"],
            ["Validar certificado", "/validar"],
            ["Planos", "/#planos"],
          ]}
        />
        <FooterCol
          titulo="Talentos"
          links={[
            ["Banco de talentos", "/app/talentos"],
            ["Vagas abertas", "/app/vagas"],
            ["Para empresas", "/#empresas"],
            ["Área administrativa", "/admin"],
          ]}
        />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-24 pt-5 text-xs text-navy-100/50 sm:flex-row sm:items-center sm:justify-between sm:pb-5 lg:px-8">
          <p>© {new Date().getFullYear()} Castelo Branco Contabilidade Avançada. Todos os direitos reservados.</p>
          <p>Protótipo de MVP · dados de demonstração</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ titulo, links }: { titulo: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-4 text-gold-300">{titulo}</p>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-navy-100/70 transition hover:text-gold-300">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
