"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BookMarked, Lock, NotebookPen, Plus, TrendingUp, X,
} from "lucide-react";
import { Badge, Button, Card, Carregando, EmptyState, inputCls } from "@/components/ui";
import { useSession } from "@/lib/session";
import { ehPago, limitesDoPlano } from "@/lib/planos";
import { carregarCadernos, carregarSimulados, criarCaderno } from "@/lib/repo-questoes";
import type { Caderno, ResultadoSimulado } from "@/lib/types";

const CORES = ["#00204D", "#B88A45", "#2F6E75", "#0D3563", "#1F4A7A"];

export default function CadernosPage() {
  const { user, modoDemo } = useSession();
  const pago = ehPago(user?.plano);
  const limite = limitesDoPlano(user?.plano).cadernos;

  const [cadernos, setCadernos] = useState<Caderno[] | null>(null);
  const [simulados, setSimulados] = useState<ResultadoSimulado[]>([]);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      user?.id && !modoDemo ? carregarCadernos(user.id) : Promise.resolve(cadernosDemo),
      user?.id && !modoDemo ? carregarSimulados(user.id) : Promise.resolve(simuladosDemo),
    ]).then(([c, s]) => {
      if (!ativo) return;
      setCadernos(c);
      setSimulados(s);
    });
    return () => { ativo = false; };
  }, [user?.id, modoDemo]);

  const podeeCriar = limite === "ilimitado" || (cadernos?.length ?? 0) < limite;

  async function criar() {
    if (!nome.trim() || !user) return;
    const id = await criarCaderno(user.id, nome.trim(), cor);
    setCadernos((c) => [
      { id: id ?? `local-${Date.now()}`, nome: nome.trim(), cor, total: 0, criadoEm: new Date().toISOString() },
      ...(c ?? []),
    ]);
    setNome("");
    setModal(false);
  }

  if (!cadernos) return <Carregando texto="Carregando seus cadernos…" />;

  return (
    <div className="space-y-7">
      <Link
        href="/app/questoes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Banco de questões
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-500">Organização</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Meus cadernos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Separe as questões que você quer revisar depois — por assunto, por prova ou
            simplesmente pelas que você errou.
          </p>
        </div>
        <Button variant="gold" onClick={() => setModal(true)} disabled={!podeeCriar}>
          <Plus size={15} /> Novo caderno
        </Button>
      </div>

      {!pago && (
        <Card className="!border-gold-200 !bg-gold-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-gold-500" />
              <div>
                <p className="text-sm font-bold text-navy-700">
                  Plano gratuito: {limite} caderno
                </p>
                <p className="mt-1 text-xs text-gold-600/90">
                  No Pro você cria quantos quiser e organiza por trilha, prova ou cliente.
                </p>
              </div>
            </div>
            <Button href="/app/planos" variant="gold" size="sm">Ver planos</Button>
          </div>
        </Card>
      )}

      {cadernos.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={34} />}
          title="Nenhum caderno ainda"
          description="Enquanto pratica, use o botão “Salvar em caderno” para separar as questões que valem revisão."
          action={<Button variant="gold" onClick={() => setModal(true)}>Criar o primeiro caderno</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cadernos.map((c) => (
            <Link key={c.id} href={`/app/questoes?caderno=${c.id}`}>
              <Card hover className="flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ background: c.cor }}
                  >
                    <BookMarked size={19} />
                  </span>
                  <Badge tone="muted">{c.total} questõe{c.total === 1 ? "m" : "s"}</Badge>
                </div>
                <h3 className="mt-4 text-base font-bold text-navy-700">{c.nome}</h3>
                {c.descricao && <p className="mt-1 text-sm text-muted">{c.descricao}</p>}
                <p className="mt-auto pt-4 text-xs text-muted">
                  Criado em {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* O histórico completo mora em Meus simulados; aqui fica o atalho. */}
      <Card className="!border-navy-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <TrendingUp size={16} className="text-gold-500" /> Meus simulados
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {simulados.length === 0
                ? "Você ainda não guardou nenhum simulado."
                : `${simulados.length} ${simulados.length === 1 ? "simulado guardado" : "simulados guardados"}, com as questões que você errou e a análise do Tino.`}
            </p>
          </div>
          <Button href="/app/questoes/simulados" variant="outline" size="sm">
            Abrir <ArrowRight size={13} />
          </Button>
        </div>
      </Card>

    </div>
  );
}

const cadernosDemo: Caderno[] = [
  { id: "cd1", nome: "Revisar antes da prova", cor: "#B88A45", total: 3, criadoEm: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "cd2", nome: "Reforma Tributária", cor: "#00204D", total: 2, criadoEm: new Date(Date.now() - 12 * 86400000).toISOString() },
];

const simuladosDemo: ResultadoSimulado[] = [
  { id: "s1", nome: "Simulado Tributário · Reforma Tributária", total: 8, acertos: 7, nota: 87.5, finalizadoEm: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "s2", nome: "Simulado geral", total: 12, acertos: 7, nota: 58.3, finalizadoEm: new Date(Date.now() - 9 * 86400000).toISOString() },
];
