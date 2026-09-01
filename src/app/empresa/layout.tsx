"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { esquecerEmpresaEmCache } from "@/lib/empresa-sessao";
import { Button, Card, Carregando } from "@/components/ui";
import { useSession } from "@/lib/session";
import { carregarEmpresa, type Empresa } from "@/lib/repo-empresa";
import { EmpresaContext } from "./contexto";
import { brand } from "@/lib/brand";

/* ==========================================================================
   ÁREA DA EMPRESA

   A guarda mora aqui, e não no AppShell, porque ser gestor não é papel de
   usuário — é vínculo. Uma pessoa com `role = 'aluno'` pode ser a gestora do
   escritório dela, e a dona da conta `role = 'empresa'` pode ter sido rebaixada
   a membro. Quem responde é `empresa_membros`, e quem lê isso é o banco.

   A empresa carregada vai para o contexto de `contexto.tsx` — que mora em
   arquivo separado porque uma rota do App Router só pode exportar `default`.
   As telas leem de lá com `useEmpresa()` em vez de repetir o RPC.
   ========================================================================== */

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, modoDemo } = useSession();
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [buscando, setBuscando] = useState(true);

  const recarregar = useCallback(async () => {
    esquecerEmpresaEmCache();
    setEmpresa(await carregarEmpresa());
  }, []);

  useEffect(() => {
    if (loading || !user || modoDemo) {
      if (!loading && (modoDemo || !user)) setBuscando(false);
      return;
    }
    let ativo = true;
    carregarEmpresa().then((e) => {
      if (!ativo) return;
      setEmpresa(e);
      setBuscando(false);
    });
    return () => { ativo = false; };
  }, [loading, user, modoDemo]);

  // Membro sem cargo de gestão não tem o que fazer aqui: o que interessa a ele
  // (as formações atribuídas) aparece no painel do aluno. Conta cujo papel é
  // `empresa` fica de fora dessa regra — ela não tem painel de aluno para onde
  // ir (o AppShell a manda de volta para cá), e mandar uma para a outra é um
  // ping-pong de redirecionamento.
  const contaEmpresa = user?.role === "empresa";
  useEffect(() => {
    if (!buscando && empresa && !empresa.gestor && !contaEmpresa) router.replace("/app");
  }, [buscando, empresa, router, contaEmpresa]);

  if (buscando || loading) {
    return (
      <AppShell area="empresa">
        <Carregando texto="Abrindo o painel da empresa…" />
      </AppShell>
    );
  }

  if (modoDemo) {
    return (
      <AppShell area="empresa">
        <Aviso
          titulo="A área da empresa precisa do banco"
          texto="No modo demonstração não há contrato, assentos nem equipe — e inventar um time falso num painel de gestão seria pior do que não mostrar nada. Troque para Supabase no seletor do topo."
        />
      </AppShell>
    );
  }

  if (!empresa) {
    return (
      <AppShell area="empresa">
        <Aviso
          titulo="Sua conta não está vinculada a nenhuma empresa"
          texto="Se a sua empresa contratou a Academy, peça ao gestor o link do convite. Se você é o gestor e ainda não tem contrato, fale com a gente."
          acao={
            <div className="flex flex-wrap justify-center gap-3">
              {/* Conta de empresa não tem painel de aluno para onde voltar. */}
              {!contaEmpresa && <Button href="/app">Voltar ao meu painel</Button>}
              <Button href={brand.whatsapp} variant={contaEmpresa ? "gold" : "ghost"}>
                Falar com a equipe
              </Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  // Membro sem gestão numa conta `empresa`: sem painel de aluno para onde ir,
  // a tela precisa dizer o que aconteceu em vez de ficar em branco.
  if (!empresa.gestor) {
    if (!contaEmpresa) return null;
    return (
      <AppShell area="empresa">
        <Aviso
          titulo="Sua conta não administra esta empresa"
          texto={`Você está vinculado a ${empresa.nome}, mas sem cargo de gestão. Peça a quem administra a conta para promover o seu acesso.`}
        />
      </AppShell>
    );
  }

  return (
    <AppShell area="empresa">
      <EmpresaContext.Provider value={{ empresa, recarregar }}>
        {children}
      </EmpresaContext.Provider>
    </AppShell>
  );
}

function Aviso({
  titulo, texto, acao,
}: {
  titulo: string; texto: string; acao?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
        <Building2 size={22} />
      </span>
      <h1 className="text-lg font-bold text-navy-700">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{texto}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </Card>
  );
}
