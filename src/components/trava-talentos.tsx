"use client";

import { ArrowRight, Building2, Lock, Search, ShieldCheck, Users } from "lucide-react";
import { Button, Card, Carregando } from "@/components/ui";
import { useEmpresaDaSessao } from "@/lib/empresa-sessao";

/* ==========================================================================
   QUEM PODE ABRIR O BANCO DE TALENTOS

   Estava aberto para qualquer pessoa logada, e isso errava dos dois lados.

   Do lado do negócio: "busca avançada no banco de talentos" é o argumento do
   plano Empresarial. Entregá-lo a toda conta gratuita esvazia a conta que
   paga.

   Do lado de quem estuda: ao marcar "quero aparecer no banco de talentos", a
   pessoa imagina que está se expondo a *empresas* — não aos nove mil colegas
   de plataforma. Telefone e e-mail de quem topou ser procurado não deviam
   circular numa plateia dessa.

   A guarda mora aqui, e não só no menu: esconder o link é cortesia, o que
   impede o acesso é a página.
   ========================================================================== */

export function TravaBancoDeTalentos({ children }: { children: React.ReactNode }) {
  const { podeVerTalentos, carregando } = useEmpresaDaSessao();

  if (carregando) return <Carregando texto="Verificando o seu acesso…" />;
  if (podeVerTalentos) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-700 text-gold-300">
          <Lock size={24} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-navy-700">
          O banco de talentos é de quem contrata
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Aqui é onde empresas procuram profissionais. Você está do outro lado do
          balcão — e é uma boa notícia: com o perfil publicado, são elas que chegam
          até você.
        </p>

        <div className="mt-7 grid gap-3 text-left sm:grid-cols-2">
          <Item
            icone={<Users size={16} />}
            titulo="Apareça para elas"
            texto="Ligue “Quero aparecer no banco de talentos” no seu perfil e entre na busca das empresas parceiras."
          />
          <Item
            icone={<ShieldCheck size={16} />}
            titulo="Com procedência"
            texto="Seus certificados e selos de habilidade viajam junto, com código público de validação."
          />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="/app/perfil" variant="gold">
            Ajustar meu perfil <ArrowRight size={15} />
          </Button>
          <Button href="/app/vagas" variant="outline">
            <Search size={15} /> Ver vagas abertas
          </Button>
        </div>

        <p className="mt-7 flex flex-wrap items-center justify-center gap-1.5 border-t border-navy-100 pt-5 text-xs text-muted">
          <Building2 size={13} className="text-gold-500" />
          Você contrata para a sua empresa?
          <a
            href="/app/planos"
            className="font-semibold text-gold-600 underline underline-offset-2 hover:text-gold-500"
          >
            O plano Empresarial abre a busca
          </a>
          — e dá licenças para o time estudar.
        </p>
      </Card>
    </div>
  );
}

function Item({
  icone, titulo, texto,
}: {
  icone: React.ReactNode; titulo: string; texto: string;
}) {
  return (
    <div className="rounded-xl border border-navy-100 bg-cream/40 p-4">
      <span className="flex items-center gap-2 text-sm font-bold text-navy-700">
        <span className="text-gold-500">{icone}</span>
        {titulo}
      </span>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{texto}</p>
    </div>
  );
}
