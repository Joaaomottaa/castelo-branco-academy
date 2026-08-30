"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, History, RotateCcw,
  Sparkles, Target,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Progress, cn } from "@/components/ui";
import { Carregando } from "@/components/ui";
import { QuestaoCard } from "@/components/questao-card";
import { useSession } from "@/lib/session";
import {
  adicionarAoCaderno, carregarCadernos, carregarQuestoes, criarCaderno,
  questoesParaRevisar, registrarResposta,
} from "@/lib/repo-questoes";
import { avancarMissao, registrarEstudo, registrarXP } from "@/lib/repo-gamificacao";
import { ehPago } from "@/lib/planos";
import type { Caderno, QuestaoBanco, QuestaoParaRevisar } from "@/lib/types";

/* ==========================================================================
   REVISAR HOJE — REVISÃO ESPAÇADA

   A ideia é velha e bem documentada: a memória some depressa nos primeiros
   dias e devagar depois. Rever no momento em que a lembrança está quase
   apagando é o que a fixa — e as caixas de Leitner são a forma mais simples
   de decidir esse momento sem pedir nada à pessoa.

   Aqui o intervalo cresce com a sequência de acertos: 1, 3, 7, 14 e 30 dias.
   Errar joga a questão de volta para a primeira caixa, e ela reaparece
   amanhã. Quem acertou de primeira e nunca errou não é lembrado de nada:
   revisar o que já se sabe é o desperdício que o método existe para evitar.

   Nada disso mora numa tabela nova. A fila sai de `respostas_questoes`, que
   já guarda toda tentativa — ver `questoes_para_revisar` no banco.
   ========================================================================== */

/** O intervalo de cada caixa, em dias. Espelha `questoes_para_revisar`. */
const CAIXAS = [1, 3, 7, 14, 30];

function proximoIntervalo(sequencia: number) {
  return CAIXAS[Math.min(sequencia, CAIXAS.length - 1)];
}

export default function RevisarPage() {
  const { user, modoDemo } = useSession();
  const pago = ehPago(user?.plano);

  const [fila, setFila] = useState<QuestaoParaRevisar[] | null>(null);
  const [banco, setBanco] = useState<QuestaoBanco[]>([]);
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [acertos, setAcertos] = useState(0);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    let ativo = true;
    if (!user?.id || modoDemo) {
      setFila([]);
      return;
    }
    Promise.all([
      questoesParaRevisar(20),
      carregarQuestoes(),
      carregarCadernos(user.id),
    ]).then(([f, q, c]) => {
      if (!ativo) return;
      // A fila vem do banco só com id e estatística; o enunciado completo está
      // no catálogo que a tela de questões já carrega. Cruzar aqui evita uma
      // segunda consulta que traria as mesmas colunas.
      const ids = new Set(q.map((x) => x.id));
      setFila(f.filter((x) => ids.has(x.questaoId)));
      setBanco(q);
      setCadernos(c);
    });
    return () => { ativo = false; };
  }, [user?.id, modoDemo]);

  const porId = useMemo(
    () => new Map(banco.map((q) => [q.id, q])),
    [banco]
  );

  if (!fila) return <Carregando texto="Montando a sua revisão…" />;

  const total = fila.length;
  const item = fila[i];
  const questao = item ? porId.get(item.questaoId) : undefined;

  async function responder(q: QuestaoBanco, escolha: string) {
    if (!user || confirmadas.has(q.id)) return;
    const certo = escolha === q.correta;

    setRespostas((r) => ({ ...r, [q.id]: escolha }));
    setConfirmadas((s) => new Set(s).add(q.id));
    if (certo) setAcertos((n) => n + 1);

    if (!modoDemo) {
      // A resposta da revisão é uma tentativa como qualquer outra: é ela que
      // recalcula a sequência e adia (ou antecipa) a próxima aparição.
      void registrarResposta(user.id, q.id, escolha, certo);
      void registrarEstudo(user.id, { minutos: 1 });
      void avancarMissao(user.id, "diaria-questoes");
      if (certo) void registrarXP(user.id, "questao", 10, `Revisão certa: ${q.assunto}`);
    }
  }

  function avancar() {
    if (i + 1 >= total) setFim(true);
    else setI((n) => n + 1);
  }

  /* ------------------------------------------------------------- cabeçalho */
  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link
          href="/app/questoes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-gold-600"
        >
          <ArrowLeft size={14} /> Banco de questões
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-3xl font-bold tracking-tight text-navy-700">
          <RotateCcw size={26} className="text-gold-500" /> Revisar hoje
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          As questões que você errou voltam em intervalos crescentes — 1, 3, 7, 14 e
          30 dias. É o espaçamento que transforma o acerto de hoje em memória de
          longo prazo.
        </p>
      </div>
    </div>
  );

  /* --------------------------------------------------------- nada a revisar */
  if (total === 0) {
    return (
      <div className="space-y-7">
        {cabecalho}
        <EmptyState
          icon={<CheckCircle2 size={34} />}
          title="Nada para revisar hoje"
          description={
            modoDemo
              ? "A revisão espaçada usa o seu histórico real de respostas. Entre com uma conta do Supabase para vê-la funcionando."
              : "Sua fila está em dia. Responda questões novas e as que você errar voltam aqui amanhã, depois em 3 dias, depois em 7 — e assim por diante."
          }
          action={<Button href="/app/questoes" variant="gold">Praticar questões novas</Button>}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------- terminou */
  if (fim || !questao || !item) {
    const pct = total ? Math.round((acertos / total) * 100) : 0;
    return (
      <div className="space-y-7">
        {cabecalho}
        <Card className="text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50 text-gold-500">
            <Sparkles size={26} />
          </span>
          <h2 className="mt-4 text-xl font-bold text-navy-700">Revisão concluída</h2>
          <p className="mt-1.5 text-sm text-muted">
            {acertos} de {total} {total === 1 ? "acerto" : "acertos"} · {pct}% de aproveitamento
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            O que você acertou volta mais tarde; o que errou volta amanhã. Não
            precisa marcar nada: a fila se refaz sozinha a cada resposta.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/app/questoes" variant="gold">Praticar questões novas</Button>
            <Button href="/app" variant="outline">Voltar ao painel</Button>
          </div>
        </Card>
      </div>
    );
  }

  const respondida = confirmadas.has(questao.id);
  const intervalo = proximoIntervalo(item.sequencia);

  return (
    <div className="space-y-7">
      {cabecalho}

      {/* Andamento da sessão */}
      <Card className="!py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-navy-700">
            Questão {i + 1} de {total}
          </p>
          <p className="text-xs text-muted">
            {acertos} {acertos === 1 ? "acerto" : "acertos"} até aqui
          </p>
        </div>
        <Progress value={Math.round(((i + (respondida ? 1 : 0)) / total) * 100)} className="mt-3" />
      </Card>

      {/* Por que esta questão está aqui — a régua do método, visível. */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">
          <CalendarClock size={12} />{" "}
          {item.diasDeAtraso <= 0
            ? "Vence hoje"
            : `Atrasada ${item.diasDeAtraso} ${item.diasDeAtraso === 1 ? "dia" : "dias"}`}
        </Badge>
        <Badge tone="muted">
          <History size={12} /> {item.tentativas}{" "}
          {item.tentativas === 1 ? "tentativa" : "tentativas"} · {item.acertos}{" "}
          {item.acertos === 1 ? "acerto" : "acertos"}
        </Badge>
        <Badge tone={item.sequencia > 0 ? "green" : "muted"}>
          <Target size={12} />{" "}
          {item.sequencia > 0
            ? `${item.sequencia} ${item.sequencia === 1 ? "acerto seguido" : "acertos seguidos"}`
            : "Última tentativa errada"}
        </Badge>
        <span className="text-xs text-muted">
          Acertando agora, volta em {intervalo} {intervalo === 1 ? "dia" : "dias"}.
        </span>
      </div>

      <QuestaoCard
        questao={questao}
        numero={i + 1}
        marcada={respostas[questao.id]}
        respondida={respondida}
        pago={pago}
        jaRespondida
        cadernos={cadernos}
        podeCriarCaderno={!modoDemo}
        aoResponder={(alt) => responder(questao, alt)}
        aoCriarCaderno={async (nome) => {
          if (!user || modoDemo) return null;
          const id = await criarCaderno(user.id, nome);
          if (!id) return null;
          setCadernos((c) => [
            { id, nome, cor: "#00204D", total: 0, criadoEm: new Date().toISOString() },
            ...c,
          ]);
          return id;
        }}
        aoVincular={async (cadernoId, questaoId) => {
          if (modoDemo) return;
          await adicionarAoCaderno(cadernoId, questaoId);
          setCadernos((c) =>
            c.map((x) => (x.id === cadernoId ? { ...x, total: x.total + 1 } : x))
          );
        }}
      />

      <div className={cn("flex justify-end", !respondida && "opacity-40")}>
        <Button variant="gold" size="lg" onClick={avancar} disabled={!respondida}>
          {i + 1 >= total ? "Encerrar revisão" : "Próxima questão"} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
