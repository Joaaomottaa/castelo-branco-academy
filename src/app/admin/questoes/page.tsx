"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Eye, EyeOff, Filter, Flag, ListChecks, Pencil,
  Plus, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro, ConfirmarExclusao, Modal } from "@/components/modal";
import { Paginacao } from "@/components/paginacao";
import { useSession } from "@/lib/session";
import {
  alternarQuestaoAtiva, apagarQuestao, estatisticasPorQuestao,
  listarQuestoesAdmin, reportesAbertos, salvarQuestao, type EntradaQuestao,
} from "@/lib/repo-questoes";
import type { QuestaoBanco } from "@/lib/types";

/* ==========================================================================
   BANCO DE QUESTÕES — administração

   O banco existia desde o primeiro schema e só podia ser mexido pelo painel
   do Supabase. Gabarito errado é o defeito mais caro deste produto: o aluno
   estuda a resposta errada e só descobre na prova de verdade. Esta tela
   existe para isso ser corrigido em trinta segundos, por quem sabe contabilidade
   e não sabe SQL.

   O percentual de acerto ao lado de cada questão é o alarme: questão que
   quase todo mundo erra costuma ser questão errada, não turma fraca.
   ========================================================================== */

const NIVEIS = ["Iniciante", "Intermediário", "Avançado"];

/**
 * Cinco por página. A questão do admin ocupa espaço — enunciado, gabarito,
 * percentual de acerto e alerta — e dez delas já viram rolagem longa.
 */
const POR_PAGINA = 5;
const LETRAS = ["a", "b", "c", "d"];

/**
 * O filtro que o administrador realmente usa não é "área": é "onde a turma
 * está errando". Uma questão com 15% de acerto ou é muito difícil ou está com
 * o gabarito trocado — e as duas coisas exigem ação.
 */
const DESEMPENHOS = [
  ["", "Todo desempenho"],
  ["criticas", "Críticas — até 30% de acerto"],
  ["dificeis", "Difíceis — 31% a 60%"],
  ["tranquilas", "Tranquilas — acima de 80%"],
  ["sem", "Ainda sem resposta"],
  ["reportadas", "Com erro reportado"],
] as const;

type Desempenho = (typeof DESEMPENHOS)[number][0];

const ORDENS = [
  ["recentes", "Mais recentes"],
  ["erradas", "Mais erradas primeiro"],
  ["respondidas", "Mais respondidas"],
] as const;

type Ordem = (typeof ORDENS)[number][0];

const ROTULO_ORIGEM: Record<string, string> = {
  manual: "Escrita à mão",
  ia: "Gerada por IA",
  prova: "Estilo de prova",
};

export default function AdminQuestoesPage() {
  const { modoDemo } = useSession();
  const [lista, setLista] = useState<QuestaoBanco[]>([]);
  const [stats, setStats] = useState<Map<string, { respostas: number; acertos: number }>>(
    new Map()
  );
  const [reportes, setReportes] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [assunto, setAssunto] = useState("");
  const [nivel, setNivel] = useState("");
  const [origem, setOrigem] = useState("");
  const [situacao, setSituacao] = useState<"" | "ativa" | "inativa">("");
  const [desempenho, setDesempenho] = useState<Desempenho>("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<QuestaoBanco | "nova" | null>(null);
  const [excluindo, setExcluindo] = useState<QuestaoBanco | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [qs, st, rp] = await Promise.all([
      listarQuestoesAdmin(),
      estatisticasPorQuestao(),
      reportesAbertos(),
    ]);
    setLista(qs);
    setStats(st);
    setReportes(rp);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // As listas de filtro saem do próprio banco. Fixar no código faria o filtro
  // esconder questão de uma área nova — falha silenciosa, a pior de todas.
  const areas = useMemo(
    () => [...new Set(lista.map((q) => q.area))].sort(),
    [lista]
  );
  const assuntos = useMemo(
    () =>
      [...new Set(lista.filter((q) => !area || q.area === area).map((q) => q.assunto))].sort(),
    [lista, area]
  );

  /** Percentual de acerto da questão, ou `null` quando ninguém respondeu. */
  const acertoDe = useCallback(
    (id: string) => {
      const s = stats.get(id);
      if (!s || s.respostas === 0) return null;
      return Math.round((s.acertos / s.respostas) * 100);
    },
    [stats]
  );

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = lista.filter((q) => {
      if (area && q.area !== area) return false;
      if (assunto && q.assunto !== assunto) return false;
      if (nivel && q.nivel !== nivel) return false;
      if (origem && (q.origem ?? "manual") !== origem) return false;
      if (situacao === "ativa" && q.ativa === false) return false;
      if (situacao === "inativa" && q.ativa !== false) return false;

      if (desempenho) {
        const pct = acertoDe(q.id);
        if (desempenho === "sem" && pct !== null) return false;
        if (desempenho === "criticas" && (pct === null || pct > 30)) return false;
        if (desempenho === "dificeis" && (pct === null || pct <= 30 || pct > 60)) return false;
        if (desempenho === "tranquilas" && (pct === null || pct <= 80)) return false;
        if (desempenho === "reportadas" && !reportes.get(q.id)) return false;
      }

      if (!t) return true;
      return (
        q.enunciado.toLowerCase().includes(t) ||
        q.assunto.toLowerCase().includes(t) ||
        (q.banca ?? "").toLowerCase().includes(t) ||
        (q.prova ?? "").toLowerCase().includes(t)
      );
    });

    if (ordem === "erradas") {
      // Sem resposta vai para o fim: não dá para chamar de "errada" o que
      // ninguém respondeu ainda.
      return [...base].sort((a, b) => (acertoDe(a.id) ?? 999) - (acertoDe(b.id) ?? 999));
    }
    if (ordem === "respondidas") {
      return [...base].sort(
        (a, b) => (stats.get(b.id)?.respostas ?? 0) - (stats.get(a.id)?.respostas ?? 0)
      );
    }
    return base;
  }, [lista, busca, area, assunto, nivel, origem, situacao, desempenho, ordem, acertoDe, reportes, stats]);

  const ativas = lista.filter((q) => q.ativa !== false).length;
  const filtroLigado = Boolean(
    busca || area || assunto || nivel || origem || situacao || desempenho
  );
  const totalReportes = [...reportes.values()].reduce((a, n) => a + n, 0);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Mexer no filtro sem voltar para a primeira página deixa a pessoa olhando
  // uma tela vazia na página 7 de um resultado que agora tem 2.
  useEffect(() => {
    setPagina(1);
  }, [busca, area, assunto, nivel, origem, situacao, desempenho, ordem]);

  async function alternar(q: QuestaoBanco) {
    const nova = q.ativa === false;
    await alternarQuestaoAtiva(q.id, nova);
    setLista((l) => l.map((x) => (x.id === q.id ? { ...x, ativa: nova } : x)));
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const r = await apagarQuestao(excluindo.id);
    setExcluindo(null);
    if (r.erro) {
      setAviso(r.erro);
      return;
    }
    if (!r.apagada) {
      setAviso(
        "Esta questão já foi respondida por alunos, então foi desativada em vez de apagada — apagar levaria junto o desempenho de quem respondeu."
      );
    }
    void carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">
            Banco de questões
          </h1>
          <p className="mt-1 text-sm text-muted">
            {ativas} ativas de {lista.length} · o que o aluno usa em{" "}
            <Link href="/app/questoes" className="text-gold-600 hover:underline">
              Questões
            </Link>{" "}
            e nos simulados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button href="/admin/questoes/gerar" variant="outline" size="sm">
            <Sparkles size={15} /> Gerar questões com IA
          </Button>
          <Button variant="gold" size="sm" onClick={() => setEditando("nova")}>
            <Plus size={15} /> Nova questão
          </Button>
        </div>
      </div>

      {modoDemo && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-600">
          Modo demonstração: a lista vem do seed local e as alterações não são
          gravadas. Troque a chave para Supabase para administrar de verdade.
        </p>
      )}

      {totalReportes > 0 && desempenho !== "reportadas" && (
        <button
          onClick={() => setDesempenho("reportadas")}
          className="flex w-full items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 transition hover:border-amber-300"
        >
          <Flag size={16} className="shrink-0" />
          <span>
            <strong>
              {totalReportes} {totalReportes === 1 ? "aviso de erro" : "avisos de erro"}
            </strong>{" "}
            {totalReportes === 1 ? "enviado" : "enviados"} por alunos.
            Clique para ver só essas questões.
          </span>
        </button>
      )}

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {aviso}
          </span>
          <button onClick={() => setAviso(null)} className="shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filtros */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por enunciado, assunto ou banca"
              className={cn(inputCls, "!py-2 pl-9 text-sm")}
            />
          </div>

          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setAssunto("");
            }}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <select
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todos os assuntos</option>
            {assuntos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Todos os níveis</option>
            {NIVEIS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>

          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Toda origem</option>
            {Object.entries(ROTULO_ORIGEM).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as typeof situacao)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            <option value="">Ativas e inativas</option>
            <option value="ativa">Só ativas</option>
            <option value="inativa">Só inativas</option>
          </select>

          <select
            value={desempenho}
            onChange={(e) => setDesempenho(e.target.value as Desempenho)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            {DESEMPENHOS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className={cn(inputCls, "!w-auto !py-2 text-sm")}
          >
            {ORDENS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {filtroLigado && (
            <button
              onClick={() => {
                setBusca("");
                setArea("");
                setAssunto("");
                setNivel("");
                setOrigem("");
                setSituacao("");
                setDesempenho("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted transition hover:text-navy-700"
            >
              <X size={13} /> Limpar
            </button>
          )}
        </div>

        {filtroLigado && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-navy-100 pt-3 text-xs text-muted">
            <Filter size={12} /> {filtradas.length} de {lista.length} questões
          </p>
        )}
      </Card>

      {/* Lista */}
      {carregando ? (
        <p className="py-10 text-center text-sm text-muted">Carregando questões…</p>
      ) : filtradas.length === 0 ? (
        <Card className="text-center">
          <ListChecks size={30} className="mx-auto text-navy-200" />
          <p className="mt-3 text-sm font-semibold text-navy-700">
            {lista.length === 0 ? "O banco está vazio" : "Nenhuma questão com esses filtros"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lista.length === 0
              ? "Crie a primeira à mão ou gere um lote com IA."
              : "Ajuste os filtros ou limpe a busca."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visiveis.map((q) => {
            const st = stats.get(q.id);
            const avisos = reportes.get(q.id) ?? 0;
            const pct = st && st.respostas > 0
              ? Math.round((st.acertos / st.respostas) * 100)
              : null;
            const suspeita = pct !== null && st!.respostas >= 5 && pct <= 20;

            return (
              <Card key={q.id} className={cn("!p-4", q.ativa === false && "opacity-60")}>
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="navy">{q.area}</Badge>
                      <Badge tone="muted">{q.assunto}</Badge>
                      <Badge tone={q.nivel === "Avançado" ? "gold" : "muted"}>{q.nivel}</Badge>
                      {q.origem && q.origem !== "manual" && (
                        <Badge tone="teal">{ROTULO_ORIGEM[q.origem]}</Badge>
                      )}
                      {q.ativa === false && <Badge tone="muted">Inativa</Badge>}
                      {avisos > 0 && (
                        <Badge tone="red">
                          {avisos} {avisos === 1 ? "aviso de erro" : "avisos de erro"}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2.5 text-sm font-medium leading-relaxed text-navy-700">
                      {q.enunciado}
                    </p>

                    <p className="mt-2 text-xs text-muted">
                      Gabarito{" "}
                      <strong className="text-emerald-600">{q.correta.toUpperCase()}</strong>
                      {q.prova && ` · ${q.prova}`}
                      {!q.prova && q.banca && ` · ${q.banca}`}
                      {q.ano ? ` · ${q.ano}` : ""}
                      {pct !== null && (
                        <>
                          {" · "}
                          <span className={suspeita ? "font-bold text-red-600" : ""}>
                            {pct}% de acerto em {st!.respostas}{" "}
                            {st!.respostas === 1 ? "resposta" : "respostas"}
                          </span>
                        </>
                      )}
                    </p>

                    {suspeita && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        Quase todo mundo erra esta questão. Confira o gabarito antes de
                        supor que o assunto é difícil.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <BotaoIcone
                      titulo={q.ativa === false ? "Ativar" : "Desativar"}
                      onClick={() => alternar(q)}
                    >
                      {q.ativa === false ? <EyeOff size={15} /> : <Eye size={15} />}
                    </BotaoIcone>
                    <BotaoIcone titulo="Editar" onClick={() => setEditando(q)}>
                      <Pencil size={15} />
                    </BotaoIcone>
                    <BotaoIcone titulo="Excluir" onClick={() => setExcluindo(q)} perigo>
                      <Trash2 size={15} />
                    </BotaoIcone>
                  </div>
                </div>
              </Card>
            );
          })}

          <Paginacao
            pagina={paginaAtual}
            total={totalPaginas}
            primeiro={(paginaAtual - 1) * POR_PAGINA + 1}
            ultimo={Math.min(paginaAtual * POR_PAGINA, filtradas.length)}
            itens={filtradas.length}
            rotulo={filtradas.length === 1 ? "questão" : "questões"}
            aoIr={setPagina}
          />
        </div>
      )}

      {editando && (
        <ModalQuestao
          questao={editando === "nova" ? null : editando}
          areas={areas}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            void carregar();
          }}
        />
      )}

      {excluindo && (
        <ConfirmarExclusao
          titulo="Excluir questão"
          descricao={`"${excluindo.enunciado.slice(0, 120)}${
            excluindo.enunciado.length > 120 ? "…" : ""
          }" será removida do banco. Se alguém já respondeu, ela é apenas desativada — o histórico de desempenho não pode ser apagado junto.`}
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluindo(null)}
        />
      )}
    </div>
  );
}

function BotaoIcone({
  children, titulo, onClick, perigo,
}: {
  children: React.ReactNode; titulo: string; onClick: () => void; perigo?: boolean;
}) {
  return (
    <button
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 transition",
        perigo
          ? "text-muted hover:bg-red-50 hover:text-red-600"
          : "text-muted hover:bg-navy-50 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- edição --- */
function ModalQuestao({
  questao, areas, aoFechar, aoSalvar,
}: {
  questao: QuestaoBanco | null;
  areas: string[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [form, setForm] = useState<EntradaQuestao>(() => ({
    id: questao?.id,
    enunciado: questao?.enunciado ?? "",
    alternativas: LETRAS.map((id) => ({
      id,
      texto: questao?.alternativas.find((a) => a.id === id)?.texto ?? "",
    })),
    correta: questao?.correta ?? "",
    explicacao: questao?.explicacao ?? "",
    area: questao?.area ?? areas[0] ?? "",
    assunto: questao?.assunto ?? "",
    nivel: questao?.nivel ?? "Intermediário",
    banca: questao?.banca ?? "",
    ano: questao?.ano,
    prova: questao?.prova ?? "",
    origem: questao?.origem ?? "manual",
    tags: questao?.tags ?? [],
    ativa: questao?.ativa ?? true,
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof EntradaQuestao>(k: K, v: EntradaQuestao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarQuestao(form);
    setSalvando(false);
    if (r.erro) setErro(r.erro);
    else aoSalvar();
  }

  return (
    <Modal
      titulo={questao ? "Editar questão" : "Nova questão"}
      subtitulo="O gabarito só vive no banco — o aluno recebe as alternativas sem ele."
      aoFechar={aoFechar}
      largura="max-w-3xl"
      rodape={
        <div className="flex justify-end gap-2">
          <button
            onClick={aoFechar}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
          >
            Cancelar
          </button>
          <Button variant="gold" size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar questão"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {erro && <AvisoErro>{erro}</AvisoErro>}

        <Field label="Enunciado">
          <textarea
            rows={3}
            value={form.enunciado}
            onChange={(e) => set("enunciado", e.target.value)}
            placeholder="O que a questão pergunta?"
            className={inputCls}
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
            Alternativas · clique na letra para marcar a correta
          </p>
          <div className="space-y-2">
            {form.alternativas.map((alt, i) => {
              const correta = form.correta === alt.id;
              return (
                <div key={alt.id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => set("correta", alt.id)}
                    title={correta ? "Esta é a correta" : "Marcar como correta"}
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase transition",
                      correta
                        ? "bg-emerald-500 text-white"
                        : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                    )}
                  >
                    {correta ? <CheckCircle2 size={16} /> : alt.id}
                  </button>
                  <input
                    value={alt.texto}
                    onChange={(e) => {
                      const novas = [...form.alternativas];
                      novas[i] = { ...alt, texto: e.target.value };
                      set("alternativas", novas);
                    }}
                    placeholder={`Alternativa ${alt.id.toUpperCase()}`}
                    className={cn(inputCls, "!py-2 text-sm")}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Field
          label="Explicação"
          hint="Aparece para o aluno depois da resposta. Diga por que a correta está certa e por que o erro mais provável está errado."
        >
          <textarea
            rows={3}
            value={form.explicacao ?? ""}
            onChange={(e) => set("explicacao", e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Área">
            <input
              list="areas-banco"
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="Tributário"
              className={inputCls}
            />
            <datalist id="areas-banco">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Assunto">
            <input
              value={form.assunto}
              onChange={(e) => set("assunto", e.target.value)}
              placeholder="Reforma Tributária"
              className={inputCls}
            />
          </Field>
          <Field label="Nível">
            <select
              value={form.nivel}
              onChange={(e) => set("nivel", e.target.value)}
              className={inputCls}
            >
              {NIVEIS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Banca" hint="Opcional">
            <input
              value={form.banca ?? ""}
              onChange={(e) => set("banca", e.target.value)}
              placeholder="CFC"
              className={inputCls}
            />
          </Field>
          <Field label="Ano" hint="Opcional">
            <input
              type="number"
              value={form.ano ?? ""}
              onChange={(e) =>
                set("ano", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="2024"
              className={inputCls}
            />
          </Field>
          <Field label="Prova de referência" hint="Opcional">
            <input
              value={form.prova ?? ""}
              onChange={(e) => set("prova", e.target.value)}
              placeholder="Exame de Suficiência 2024.1"
              className={inputCls}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-100 p-3.5">
          <input
            type="checkbox"
            checked={form.ativa ?? true}
            onChange={(e) => set("ativa", e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
          />
          <span className="text-sm font-semibold text-navy-700">
            Disponível para os alunos
          </span>
        </label>
      </div>
    </Modal>
  );
}
