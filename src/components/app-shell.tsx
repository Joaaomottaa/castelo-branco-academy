"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award, BarChart3, Briefcase, Building2, Calculator, ChevronDown, ClipboardList,
  CreditCard, FileBarChart, GraduationCap, LayoutDashboard, ListChecks, LogOut,
  Megaphone, Menu, MessagesSquare, Route, Search, Settings, ShieldCheck,
  Sparkles, Ticket, Trophy, UserCog, Users, X,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { useDados } from "@/lib/dados";
import { type Empresa } from "@/lib/repo-empresa";
import { useEmpresaDaSessao } from "@/lib/empresa-sessao";
import { Avatar, Logo, cn } from "./ui";
import { SeletorDeModo } from "./seletor-modo";
import { SinoDeNotificacoes } from "./notificacoes";

/** O menu do aluno cresceu; agrupar por objetivo evita uma lista de 10 itens. */
const navAluno = [
  {
    secao: "Aprender",
    itens: [
      { href: "/app", label: "Meu painel", icon: LayoutDashboard },
      { href: "/app/cursos", label: "Cursos", icon: GraduationCap },
      { href: "/app/trilhas", label: "Trilhas de carreira", icon: Route },
      { href: "/app/questoes", label: "Questões", icon: ListChecks },
      { href: "/app/ferramentas", label: "Ferramentas", icon: Calculator },
    ],
  },
  {
    secao: "Comunidade",
    itens: [
      { href: "/app/comunidade", label: "Feed", icon: MessagesSquare },
      { href: "/app/talentos", label: "Banco de talentos", icon: Users },
      { href: "/app/vagas", label: "Vagas", icon: Briefcase },
    ],
  },
  {
    secao: "Você",
    itens: [
      { href: "/app/conquistas", label: "Conquistas", icon: Trophy },
      { href: "/app/certificados", label: "Certificados", icon: Award },
      { href: "/app/perfil", label: "Meu perfil", icon: Settings },
    ],
  },
];

/**
 * O menu da empresa.
 *
 * A ordem é a do trabalho de um gestor: primeiro ele olha se o time está
 * estudando, depois cobra quem não está, e só então presta contas. Contratar
 * vem por último porque é o que acontece com menos frequência.
 */
const navEmpresa = [
  {
    secao: "Minha equipe",
    itens: [
      { href: "/empresa", label: "Painel", icon: LayoutDashboard },
      { href: "/empresa/equipe", label: "Pessoas e licenças", icon: Users },
      { href: "/empresa/formacoes", label: "Formações", icon: ClipboardList },
      { href: "/empresa/relatorios", label: "Relatório PEPC", icon: FileBarChart },
    ],
  },
  {
    secao: "Contratar",
    itens: [
      { href: "/empresa/vagas", label: "Minhas vagas", icon: Briefcase },
      { href: "/app/talentos", label: "Banco de talentos", icon: Users },
    ],
  },
  {
    secao: "Empresa",
    itens: [
      { href: "/empresa/perfil", label: "Cadastro", icon: Building2 },
    ],
  },
];

const navAdmin = [
  {
    secao: "Gestão",
    itens: [
      { href: "/admin", label: "Visão geral", icon: BarChart3 },
      { href: "/admin/cursos", label: "Cursos", icon: GraduationCap },
      { href: "/admin/trilhas", label: "Trilhas", icon: Route },
      { href: "/admin/questoes", label: "Questões", icon: ListChecks },
    ],
  },
  {
    secao: "Pessoas",
    itens: [
      { href: "/admin/alunos", label: "Alunos", icon: Users },
      { href: "/admin/comunicacao", label: "Comunicação", icon: Megaphone },
      { href: "/admin/vagas", label: "Vagas & empresas", icon: Building2 },
    ],
  },
  {
    secao: "Receita",
    itens: [
      { href: "/admin/cupons", label: "Cupons", icon: Ticket },
    ],
  },
];

export function AppShell({
  children,
  area = "aluno",
}: {
  children: React.ReactNode;
  area?: "aluno" | "admin" | "empresa";
}) {
  const { user, loading, sair, modoDemo } = useSession();
  const { meusCertificados } = useDados();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const { empresa, podeVerTalentos } = useEmpresaDaSessao();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Conta recém-criada (Google ou e-mail) ainda não tem telefone, cidade nem
    // aceite de termos. Uma tela só, antes de qualquer outra — inclusive antes
    // do painel, senão ela nunca é vista.
    if (user.cadastroCompleto === false && user.role !== "admin") {
      const destino = pathname && pathname !== "/app" ? `?destino=${encodeURIComponent(pathname)}` : "";
      router.replace(`/completar-cadastro${destino}`);
      return;
    }
    // O RLS já barra os dados, mas a área administrativa não deve nem abrir
    // para quem não é admin: só entregaria telas com erro e a falsa impressão
    // de que existe algo ali para ver.
    if (area === "admin" && user.role !== "admin") router.replace("/app");
  }, [loading, user, router, area, pathname]);

  useEffect(() => setMenuAberto(false), [pathname]);

  if (
    loading
    || !user
    || (user.cadastroCompleto === false && user.role !== "admin")
    || (area === "admin" && user.role !== "admin")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-200 border-t-gold-400" />
      </div>
    );
  }

  // O banco de talentos é benefício da conta empresarial: quem estuda é
  // procurado, não procura. Some do menu de quem não recruta — a página em si
  // tem a própria guarda, esta parte é só não oferecer o que não abre.
  const nav = (
    area === "admin" ? navAdmin
    : area === "empresa" ? navEmpresa
    : navAluno
  ).map((g) => ({
    ...g,
    itens: g.itens.filter(
      (i) => i.href !== "/app/talentos" || podeVerTalentos
    ),
  })).filter((g) => g.itens.length > 0);
  const pontosPEPC = meusCertificados.reduce((a, c) => a + c.pontosPEPC, 0);

  return (
    <div className="min-h-screen bg-cream">
      {/* Sidebar */}
      <aside
        className={cn(
          "brand-gradient fixed inset-y-0 left-0 z-50 flex w-16 flex-col overflow-hidden border-r border-white/10 transition-[width,box-shadow] duration-300 lg:w-64",
          menuAberto && "w-64 shadow-2xl shadow-navy-900/40"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-3 lg:justify-between lg:px-5">
          <Link href="/" aria-label="Ir para a página inicial" className="shrink-0">
            <Logo variant="light" size="sm" className="lg:hidden" />
            <Logo variant="light" className="hidden lg:inline-flex" />
          </Link>
          <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="ml-auto hidden text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-2.5 lg:p-3">
          {nav.map((grupo) => (
            <div key={grupo.secao}>
              <p className={cn("mb-1.5 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-100/35", !menuAberto && "hidden lg:block")}>
                {grupo.secao}
              </p>
              <div className="space-y-0.5">
                {grupo.itens.map((n) => {
                  const ativo =
                    n.href === "/app" || n.href === "/admin"
                      ? pathname === n.href
                      : pathname.startsWith(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      title={n.label}
                      className={cn(
                        "flex items-center rounded-xl py-2.5 text-sm font-medium transition",
                        menuAberto ? "gap-3 px-3.5" : "justify-center px-0 lg:justify-start lg:gap-3 lg:px-3.5",
                        ativo
                          ? "bg-gold-400/15 text-gold-300 shadow-[inset_2px_0_0_0_#C89F50]"
                          : "text-navy-100/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <n.icon size={17} />
                      <span className={cn(!menuAberto && "hidden lg:block")}>{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn(!menuAberto && "hidden lg:block")}>
          {area === "aluno" && user.role !== "empresa" && <MetaPEPC pontos={pontosPEPC} />}

        {/* A empresa fica a um clique da área do aluno, e vice-versa: o gestor
            também estuda, e obrigá-lo a digitar a URL para trocar de chapéu
            seria o mesmo erro que a área administrativa tinha antes. */}
        {area === "aluno" && empresa?.gestor && (
          <Link
            href="/empresa"
            className="m-3 flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 p-3 text-center text-xs font-semibold text-gold-300 transition hover:bg-white/10"
          >
            <Building2 size={14} /> Painel da {empresa.nome.split(" ")[0]}
          </Link>
        )}
        {area === "empresa" && (
          <>
            <LicencasNaBarra empresa={empresa} />
            <Link
              href="/app"
              className="m-3 rounded-xl border border-white/12 bg-white/5 p-3 text-center text-xs font-semibold text-gold-300 transition hover:bg-white/10"
            >
              Voltar para a área do aluno
            </Link>
          </>
        )}

        {user.role === "admin" && area === "aluno" && (
          <Link
            href="/admin"
            className="m-3 rounded-xl border border-white/12 bg-white/5 p-3 text-center text-xs font-semibold text-gold-300 transition hover:bg-white/10"
          >
            Ir para a área administrativa
          </Link>
        )}
        {area === "admin" && (
          <Link
            href="/app"
            className="m-3 rounded-xl border border-white/12 bg-white/5 p-3 text-center text-xs font-semibold text-gold-300 transition hover:bg-white/10"
          >
            Voltar para a área do aluno
          </Link>
        )}
        </div>
      </aside>

      {menuAberto && (
        <div
          className="fixed inset-y-0 left-16 right-0 z-40 bg-navy-900/50 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Conteúdo */}
      <div className="min-w-0 pl-16 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center gap-3 border-b border-navy-100 bg-white/85 px-3 backdrop-blur-xl sm:px-5 lg:px-8">
          <button onClick={() => setMenuAberto(true)} aria-label="Expandir menu" className="shrink-0 text-navy-700 lg:hidden">
            <Menu size={21} />
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar cursos, aulas, talentos…"
              className="w-full rounded-full border border-navy-100 bg-cream/70 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-gold-400 focus:bg-white"
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden md:inline">
              <SeletorDeModo compacto />
            </span>
            {modoDemo && (
              <span className="hidden rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-600 lg:inline">
                Dados locais
              </span>
            )}
            <SinoDeNotificacoes />

            <div className="relative">
              <button
                onClick={() => setPerfilAberto((p) => !p)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-cream"
              >
                <Avatar nome={user.nome} size={32} />
                <span className="hidden text-sm font-semibold text-navy-700 sm:block">
                  {user.nome.split(" ")[0]}
                </span>
                <ChevronDown size={14} className="text-muted" />
              </button>

              {perfilAberto && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPerfilAberto(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl">
                    <div className="border-b border-navy-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-navy-700">{user.nome}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                      <span className="mt-2 inline-block rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-600">
                        Plano {user.plano ?? "Free"}
                      </span>
                    </div>
                    {/* Administrador precisa circular pelas duas áreas: é
                        assim que ele testa o que publicou. Antes, sair do
                        /admin era um caminho sem volta visível. */}
                    {user.role === "admin" && (
                      <Link
                        href={area === "admin" ? "/app" : "/admin"}
                        onClick={() => setPerfilAberto(false)}
                        className="flex items-center gap-2.5 border-b border-navy-100 px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
                      >
                        {area === "admin" ? (
                          <>
                            <UserCog size={15} /> Ver como aluno
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={15} /> Voltar ao painel admin
                          </>
                        )}
                      </Link>
                    )}

                    {empresa?.gestor && area !== "empresa" && (
                      <Link
                        href="/empresa"
                        onClick={() => setPerfilAberto(false)}
                        className="flex items-center gap-2.5 border-b border-navy-100 px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
                      >
                        <Building2 size={15} /> Painel da empresa
                      </Link>
                    )}

                    {user.role !== "admin" && (
                      <Link
                        href="/app/planos"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gold-600 transition hover:bg-gold-50"
                      >
                        <CreditCard size={15} /> Atualizar plano
                      </Link>
                    )}
                    <Link
                      href="/app/conquistas"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition hover:bg-cream"
                    >
                      <Trophy size={15} /> Conquistas
                    </Link>
                    <Link
                      href="/app/perfil"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition hover:bg-cream"
                    >
                      <Settings size={15} /> Configurações
                    </Link>
                    <button
                      onClick={async () => {
                        await sair();
                        router.push("/login");
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <LogOut size={15} /> Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-clip px-3 py-5 sm:px-5 sm:py-8 lg:px-8">{children}</main>
      </div>

    </div>
  );
}

/** Assentos do contrato, sempre à vista: é a conta que o gestor mais consulta. */
function LicencasNaBarra({ empresa }: { empresa: Empresa | null }) {
  if (!empresa) return null;
  const { contratadas, usadas } = empresa.licencas;
  const pct = contratadas > 0 ? Math.round((usadas / contratadas) * 100) : 0;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-gold-400/25 bg-gold-400/10 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold-300">
          <Sparkles size={10} /> Licenças
        </p>
        <p className="text-sm font-bold tabular-nums text-white">
          {usadas}
          <span className="text-[10px] font-normal text-navy-100/50">/{contratadas}</span>
        </p>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/12">
        <div className="gold-gradient h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] leading-tight text-navy-100/55">
        {contratadas === 0
          ? "Nenhum assento contratado"
          : usadas >= contratadas
            ? "Todos os assentos em uso"
            : `${contratadas - usadas} assento(s) livre(s)`}
      </p>
    </div>
  );
}

/**
 * Pontos de educação continuada (meta anual do CFC: 40).
 * Compacta de propósito: fica fixa no rodapé da barra lateral e não pode
 * comer o espaço dos itens de menu.
 */
function MetaPEPC({ pontos }: { pontos: number }) {
  const META = 40;
  const pct = Math.min(100, Math.round((pontos / META) * 100));
  const cumprida = pontos >= META;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-gold-400/25 bg-gold-400/10 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold-300">
          <Sparkles size={10} /> PEPC {new Date().getFullYear()}
        </p>
        <p className="text-sm font-bold tabular-nums text-white">
          {pontos}
          <span className="text-[10px] font-normal text-navy-100/50">/{META}</span>
        </p>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/12">
        <div className="gold-gradient h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] leading-tight text-navy-100/55">
        {cumprida ? "Meta anual cumprida" : `Faltam ${META - pontos} pts`}
      </p>
    </div>
  );
}
