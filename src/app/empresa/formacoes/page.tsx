"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CalendarClock, Check, ClipboardList, GraduationCap, Loader2,
  Plus, Route, Trash2, Users,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Field, Progress, cn, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useDados } from "@/lib/dados";
import {
  atribuirFormacao, carregarEquipe, carregarFormacoes, removerFormacao,
  type Formacao, type MembroEquipe,
} from "@/lib/repo-empresa";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   FORMAÇÕES

   Dar acesso é o começo; dizer o que estudar é o que muda o resultado. Aqui o
   gestor escolhe curso ou trilha, define prazo e diz se é obrigatória.

   Duas escolhas de produto que valem explicação:

   · "Para todo o time" não é um atalho para marcar todo mundo de uma vez —
     é uma regra permanente. Quem for contratado no mês que vem entra já com
     a formação pendente, sem ninguém ter de lembrar.

   · O prazo é opcional. Formação sem prazo continua sendo um recado claro
     ("a empresa espera isto de você") sem virar cobrança artificial.
   ========================================================================== */

export default function FormacoesPage() {
  const { empresa } = useEmpresa();
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");

  const atualizar = useCallback(async () => {
    const [f, e] = await Promise.all([carregarFormacoes(), carregarEquipe()]);
    setFormacoes(f);
    setEquipe(e);
    setCarregando(false);
  }, []);

  useEffect(() => { void atualizar(); }, [atualizar]);

  async function remover(id: string) {
    setErro("");
    const r = await removerFormacao(id);
    if (!r.ok) return setErro(r.erro ?? "Não consegui remover.");
    await atualizar();
  }

  const atrasadas = formacoes.reduce((a, f) => a + f.pessoas.filter((p) => p.atrasado).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <p className="eyebrow text-gold-500">Desenvolvimento</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Formações da equipe</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            O que a {empresa.nome} espera que cada pessoa conclua — e até quando.
            Quem recebe a atribuição é avisado na plataforma.
            {atrasadas > 0 && (
              <strong className="text-red-600"> {atrasadas} prazo(s) já venceram.</strong>
            )}
          </p>
        </div>
        <Button variant="gold" onClick={() => setAbrindo(true)} className="w-full sm:w-auto">
          <Plus size={16} /> Atribuir formação
        </Button>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      {carregando ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p></Card>
      ) : formacoes.length === 0 ? (
        <Card className="py-12 text-center">
          <ClipboardList size={26} className="mx-auto text-navy-300" />
          <p className="mt-3 font-semibold text-navy-700">Nenhuma formação atribuída</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            Uma trilha atribuída com prazo vira plano de desenvolvimento — e é o que
            você mostra na avaliação de desempenho no fim do ano.
          </p>
          <div className="mt-5">
            <Button variant="gold" onClick={() => setAbrindo(true)}>
              <Plus size={15} /> Atribuir a primeira
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {formacoes.map((f) => (
            <CartaoFormacao key={f.id} f={f} aoRemover={() => void remover(f.id)} />
          ))}
        </div>
      )}

      {abrindo && (
        <ModalAtribuir
          equipe={equipe}
          aoFechar={() => setAbrindo(false)}
          aoSalvar={atualizar}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- cartão -- */

function CartaoFormacao({ f, aoRemover }: { f: Formacao; aoRemover: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const total = f.pessoas.length;
  const feitos = f.pessoas.filter((p) => p.concluido).length;
  const atrasados = f.pessoas.filter((p) => p.atrasado).length;
  const media = total > 0 ? Math.round(f.pessoas.reduce((a, p) => a + p.pct, 0) / total) : 0;

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: f.cor || "#00204D" }}
        >
          {f.tipo === "trilha" ? <Route size={19} /> : <GraduationCap size={19} />}
        </span>

        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={f.tipo === "trilha" ? "teal" : "navy"}>
              {f.tipo === "trilha" ? "Trilha" : "Curso"}
            </Badge>
            {f.obrigatoria ? <Badge tone="gold">Obrigatória</Badge> : <Badge tone="muted">Recomendada</Badge>}
            {f.paraTime ? (
              <Badge tone="muted"><Users size={11} /> Todo o time</Badge>
            ) : (
              <Badge tone="muted">Individual</Badge>
            )}
            {f.prazo && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold",
                atrasados > 0 ? "text-red-600" : "text-muted"
              )}>
                <CalendarClock size={12} /> até {dataCurta(f.prazo)}
              </span>
            )}
          </div>

          <p className="mt-2 font-bold leading-snug text-navy-700">{f.titulo}</p>
          {f.observacao && (
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.observacao}</p>
          )}
        </div>

        <div className="w-full sm:w-56">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">{feitos}/{total} concluíram</span>
            <span className="font-semibold tabular-nums text-navy-700">{media}%</span>
          </div>
          <Progress value={media} className="mt-1.5" />
          {atrasados > 0 && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600">
              {atrasados} pessoa(s) fora do prazo
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => setAberto((v) => !v)}
            className="rounded-lg border border-navy-200 px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600"
          >
            {aberto ? "Ocultar" : "Ver pessoas"}
          </button>
          <button
            onClick={() => setConfirmar(true)}
            title="Remover atribuição"
            className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="divide-y divide-navy-100 border-t border-navy-100 bg-cream/40">
          {f.pessoas.map((p) => (
            <div key={p.perfilId} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar nome={p.nome} size={30} />
              <div className="min-w-[140px] flex-1">
                <p className="text-sm font-semibold text-navy-700">{p.nome}</p>
                {p.cargo && <p className="text-[11px] text-muted">{p.cargo}</p>}
              </div>
              <div className="w-40">
                <Progress
                  value={p.pct}
                  tone={p.concluido ? "green" : p.atrasado ? "navy" : "gold"}
                />
              </div>
              <span className="w-12 text-right text-xs font-semibold tabular-nums text-navy-700">
                {p.pct}%
              </span>
              {p.concluido ? (
                <Badge tone="green"><Check size={11} /> Concluído</Badge>
              ) : p.atrasado ? (
                <Badge tone="red">Atrasado</Badge>
              ) : (
                <Badge tone="muted">Em andamento</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmar && (
        <Modal
          titulo="Remover esta atribuição?"
          subtitulo="O progresso de quem já começou não se perde — o curso continua disponível, só deixa de ser cobrado pela empresa."
          largura="max-w-lg"
          aoFechar={() => setConfirmar(false)}
          rodape={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(false)}>Cancelar</Button>
              <Button onClick={() => { setConfirmar(false); aoRemover(); }}>
                <Trash2 size={15} /> Remover
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink">
            <strong>{f.titulo}</strong> sai da lista de {total} pessoa(s).
          </p>
        </Modal>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- modal --- */

function ModalAtribuir({
  equipe, aoFechar, aoSalvar,
}: {
  equipe: MembroEquipe[];
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const { cursos, trilhas } = useDados();
  const [tipo, setTipo] = useState<"curso" | "trilha">("trilha");
  const [alvo, setAlvo] = useState("");
  const [paraQuem, setParaQuem] = useState("time");
  const [prazo, setPrazo] = useState("");
  const [obrigatoria, setObrigatoria] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const opcoes = useMemo(
    () => (tipo === "curso"
      ? cursos.map((c) => ({ id: c.id ?? "", nome: c.titulo }))
      : trilhas.map((t) => ({ id: t.id, nome: t.nome }))
    ).filter((o) => o.id),
    [tipo, cursos, trilhas]
  );

  async function salvar() {
    setErro("");
    if (!alvo) return setErro("Escolha o curso ou a trilha.");
    setSalvando(true);
    const r = await atribuirFormacao({
      cursoId: tipo === "curso" ? alvo : undefined,
      trilhaId: tipo === "trilha" ? alvo : undefined,
      perfilId: paraQuem === "time" ? undefined : paraQuem,
      prazo: prazo || undefined,
      obrigatoria,
      observacao: observacao.trim() || undefined,
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui atribuir.");
    await aoSalvar();
    aoFechar();
  }

  return (
    <Modal
      titulo="Atribuir formação"
      subtitulo="Quem for atribuído recebe uma notificação com o prazo."
      largura="max-w-2xl"
      aoFechar={aoFechar}
      rodape={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Atribuir
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {erro && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <div className="flex gap-2">
          {(["trilha", "curso"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTipo(t); setAlvo(""); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                tipo === t
                  ? "border-gold-400 bg-gold-50/60 text-navy-700"
                  : "border-navy-200 text-muted hover:border-navy-300"
              )}
            >
              {t === "trilha" ? <Route size={16} /> : <GraduationCap size={16} />}
              {t === "trilha" ? "Trilha de carreira" : "Curso avulso"}
            </button>
          ))}
        </div>

        <Field
          label={tipo === "trilha" ? "Qual trilha" : "Qual curso"}
          hint={tipo === "trilha"
            ? "A trilha cobre vários cursos e fecha com certificado próprio."
            : "Use para um tema específico, sem a sequência inteira."}
        >
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className={inputCls}>
            <option value="">Selecione…</option>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Para quem"
            hint={paraQuem === "time"
              ? "Vale também para quem entrar depois."
              : "Só para esta pessoa."}
          >
            <select
              value={paraQuem}
              onChange={(e) => setParaQuem(e.target.value)}
              className={inputCls}
            >
              <option value="time">Todo o time ({equipe.length} pessoas)</option>
              {equipe.map((m) => (
                <option key={m.perfilId} value={m.perfilId}>
                  {m.nome}{m.cargo ? ` — ${m.cargo}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prazo" hint="Opcional. Sem prazo, nada fica marcado como atrasado.">
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-cream/50 p-4">
          <input
            type="checkbox"
            checked={obrigatoria}
            onChange={(e) => setObrigatoria(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-gold-500"
          />
          <span>
            <span className="block text-sm font-semibold text-navy-700">Formação obrigatória</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Aparece em destaque no painel da pessoa e entra na contagem de pendências
              do relatório. Desmarque para deixar como recomendação.
            </span>
          </span>
        </label>

        <Field label="Recado para a equipe" hint="Opcional — explica o porquê. Vai junto com a notificação.">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Todo mundo precisa saber responder cliente sobre CBS e IBS até a virada."
            className={cn(inputCls, "resize-none")}
          />
        </Field>
      </div>
    </Modal>
  );
}

function dataCurta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}
