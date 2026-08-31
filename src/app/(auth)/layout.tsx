import Link from "next/link";
import { Award, BadgeCheck, Briefcase, Quote } from "lucide-react";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Painel de marca */}
      <aside className="brand-gradient relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-lines absolute inset-0" />
        <div
          className="absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #C89F50 0%, transparent 70%)" }}
        />

        <Link href="/" className="relative">
          <Logo variant="light" />
        </Link>

        <div className="relative max-w-md">
          <Quote size={34} className="text-gold-400/50" />
          <p className="mt-5 text-2xl font-semibold leading-snug text-white">
            Da dívida ao plano de caixa com governança — e agora, também, com
            formação.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-navy-100/65">
            A Castelo Branco Academy nasce de 20 anos resolvendo operações
            tributárias complexas em transporte, logística e comércio exterior.
            O que era método interno virou escola.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              [BadgeCheck, "Certificado com código público de validação"],
              [Award, "Pontuação para educação profissional continuada"],
              [Briefcase, "Banco de talentos conectado a empresas do setor"],
            ].map(([Icon, txt]) => {
              const I = Icon as typeof Award;
              return (
                <div key={txt as string} className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gold-400/25 bg-gold-400/10 text-gold-300">
                    <I size={16} />
                  </span>
                  <span className="text-sm text-navy-100/80">{txt as string}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative text-xs text-navy-100/40">
          © {new Date().getFullYear()} Castelo Branco Contabilidade Avançada
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-10 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
