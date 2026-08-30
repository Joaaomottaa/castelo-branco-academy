"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, FileSearch, Info, Loader2, Save,
  Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro } from "@/components/modal";
import {
  listarQuestoesAdmin, salvarQuestoesEmLote, type EntradaQuestao,
} from "@/lib/repo-questoes";

/* ==========================================================================
   GERAR QUESTÕES COM IA

   Fluxo em três passos: escolher o escopo, revisar o lote, gravar.

   A revisão no meio não é burocracia. Modelo de linguagem erra alíquota e
   prazo com a mesma segurança com que acerta conceito — e no banco de questões
   o erro vira estudo errado. Nada entra sem alguém que sabe contabilidade
   ter lido.

   Área, assunto e nível são clicáveis porque são as três colunas que o aluno
   usa para filtrar. Digitados livremente, cada lote inventaria uma grafia
   nova ("Reforma tributária", "Reforma Tributaria") e o filtro passaria a
   esconder questão que existe.
   ========================================================================== */

const NIVEIS = [
  ["Iniciante", "Definição, finalidade, o passo básico"],
  ["Intermediário", "Aplicação em caso concreto do escritório"],
  ["Avançado", "Exceção, conflito de regra, consequência"],
] as const;

const BANCAS = [
  "CFC — Exame de Suficiência",
  "FGV",
  "CESPE/Cebraspe",
  "FCC",
  "Receita Federal",
  "Sefaz estadual",
];

const LETRAS = ["a", "b", "c", "d"];

interface QuestaoGerada {
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  explicacao?: string;
  banca?: string;
  ano?: number;
  prova?: string;
}

export default function GerarQuestoesPage() {
  const router = useRouter();

  const [catalogo, setCatalogo] = useState<{ areas: string[]; porArea: Map<string, string[]> }>({
    areas: [],
    porArea: new Map(),
  });

  const [area, setArea] = useState("");
  const [areaLivre, setAreaLivre] = useState("");
  const [assunto, setAssunto] = useState("");
  const [assuntoLivre, setAssuntoLivre] = useState("");
  const [nivel, setNivel] = useState<string>("Intermediário");
  const [modo, setModo] = useState<"ia" | "prova">("ia");
  const [banca, setBanca] = useState(BANCAS[0]);
  const [quantidade, setQuantidade] = useState(5);
  const [observacoes, setObservacoes] = useState("");

  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fonte, setFonte] = useState<string | null>(null);
  const [avisoFonte, setAvisoFonte] = useState<string | null>(null);
  const [lote, setLote] = useState<QuestaoGerada[] | null>(null);
  const [descartadas, setDescartadas] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [salvas, setSalvas] = useState(0);

  const carregarCatalogo = useCallback(async () => {
    const qs = await listarQuestoesAdmin();
    const porArea = new Map<string, string[]>();
    for (const q of qs) {
      const atual = porArea.get(q.area) ?? [];
      if (!atual.includes(q.assunto)) atual.push(q.assunto);
      porArea.set(q.area, atual.sort());
    }
    const areas = [...porArea.keys()].sort();
    setCatalogo({ areas, porArea });
    if (areas.length && !area) setArea(areas[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregarCatalogo();
  }, [carregarCatalogo]);

  const areaFinal = area === "__outra" ? areaLivre.trim() : area;
  const assuntoFinal = assunto === "__outro" ? assuntoLivre.trim() : assunto;
  const assuntos = useMemo(
    () => catalogo.porArea.get(area) ?? [],
    [catalogo, area]
  );

  const podeGerar = Boolean(areaFinal && assuntoFinal) && !gerando;

  async function gerar() {
    setGerando(true);
    setErro(null);
    setLote(null);
    setSalvas(0);
    setDescartadas(new Set());

    try {
      const r = await fetch("/api/gerar-questoes-banco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: areaFinal,
          assunto: assuntoFinal,
          nivel,
          modo,
          banca: modo === "prova" ? banca : undefined,
          quantidade,
          observacoes: observacoes.trim() || undefined,
        }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados?.erro ?? "Falha ao gerar as questões.");
      setLote(dados.questoes ?? []);
      setFonte(dados.fonte ?? null);
      setAvisoFonte(dados.aviso ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar as questões.");
    } finally {
      setGerando(false);
    }
  }

  async function gravar() {
    if (!lote) return;
    setSalvando(true);
    setErro(null);

    const entradas: EntradaQuestao[] = lote
      .map((q, i) => ({ q, i }))
      .filter(({ i }) => !descartadas.has(i))
      .map(({ q }) => ({
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        correta: q.correta,
        explicacao: q.explicacao,
        area: areaFinal,
        assunto: assuntoFinal,
        nivel,
        origem: modo,
        banca: modo === "prova" ? q.banca ?? banca : undefined,
        ano: modo === "prova" ? q.ano : undefined,
        prova: modo === "prova" ? q.prova : undefined,
        ativa: true,
      }));

    const r = await salvarQuestoesEmLote(entradas);
    setSalvando(false);

    if (r.erro) {
      setErro(`${r.salvas} gravadas antes do erro: ${r.erro}`);
      return;
    }
    setSalvas(r.salvas);
    setLote(null);
  }

  function editarQuestao(i: number, patch: Partial<QuestaoGerada>) {
    setLote((l) => l && l.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  const mantidas = lote ? lote.length - descartadas.size : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/questoes"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
        >
          <ArrowLeft size={15} /> Banco de questões
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-700">
          Gerar questões com IA
        </h1>
        <p className="mt-1 text-sm text-muted">
          Você escolhe o escopo, a IA escreve o lote, você revisa e grava. Nada
          entra no banco sem a sua confirmação.
        </p>
      </div>

      {salvas > 0 && (
        <Card className="!border-emerald-200 !bg-emerald-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={18} /> {salvas}{" "}
              {salvas === 1 ? "questão gravada" : "questões gravadas"} em {areaFinal} ·{" "}
              {assuntoFinal}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSalvas(0)}>
                Gerar outro lote
              </Button>
              <Button variant="gold" size="sm" onClick={() => router.push("/admin/questoes")}>
                Ver no banco
              </Button>
            </div>
          </div>
        </Card>
      )}

      {erro && <AvisoErro>{erro}</AvisoErro>}

      {/* ------------------------------------------------ passo 1: escopo -- */}
      {!lote && salvas === 0 && (
        <>
          <Card className="space-y-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
                Passo 1 · Escopo
              </p>
              <h2 className="mt-1 text-base font-bold text-navy-700">
                Sobre o que são as questões?
              </h2>
            </div>

            {/* Área */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                Área
              </p>
              <div className="flex flex-wrap gap-2">
                {catalogo.areas.map((a) => (
                  <Chip
                    key={a}
                    ativo={area === a}
                    onClick={() => {
                      setArea(a);
                      setAssunto("");
                    }}
                  >
                    {a}
                  </Chip>
                ))}
                <Chip ativo={area === "__outra"} onClick={() => setArea("__outra")}>
                  Outra…
                </Chip>
              </div>
              {area === "__outra" && (
                <input
                  value={areaLivre}
                  onChange={(e) => setAreaLivre(e.target.value)}
                  placeholder="Nome da nova área"
                  className={cn(inputCls, "mt-3 !py-2 text-sm")}
                />
              )}
            </div>

            {/* Assunto */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                Assunto
              </p>
              {assuntos.length === 0 && area !== "__outra" && (
                <p className="mb-2 text-xs text-muted">
                  Ainda não há assunto cadastrado nesta área. Use “Outro”.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {assuntos.map((a) => (
                  <Chip key={a} ativo={assunto === a} onClick={() => setAssunto(a)}>
                    {a}
                  </Chip>
                ))}
                <Chip ativo={assunto === "__outro"} onClick={() => setAssunto("__outro")}>
                  Outro…
                </Chip>
              </div>
              {assunto === "__outro" && (
                <input
                  value={assuntoLivre}
                  onChange={(e) => setAssuntoLivre(e.target.value)}
                  placeholder="Ex.: Split payment, PER/DCOMP, Fator R"
                  className={cn(inputCls, "mt-3 !py-2 text-sm")}
                />
              )}
            </div>

            {/* Nível */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                Nível
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {NIVEIS.map(([n, desc]) => (
                  <button
                    key={n}
                    onClick={() => setNivel(n)}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition",
                      nivel === n
                        ? "border-gold-400 bg-gold-50 ring-1 ring-gold-300"
                        : "border-navy-100 hover:border-navy-200"
                    )}
                  >
                    <p className="text-sm font-bold text-navy-700">{n}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* ---------------------------------------------- passo 2: modo -- */}
          <Card className="space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
                Passo 2 · Como gerar
              </p>
              <h2 className="mt-1 text-base font-bold text-navy-700">
                Questão autoral ou no estilo de prova?
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => setModo("ia")}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  modo === "ia"
                    ? "border-gold-400 bg-gold-50 ring-1 ring-gold-300"
                    : "border-navy-100 hover:border-navy-200"
                )}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <Wand2 size={16} className="text-gold-500" /> Gerar 100% com IA
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Questão nova, escrita para a realidade contábil brasileira de hoje —
                  inclusive a transição da Reforma Tributária.
                </p>
              </button>

              <button
                onClick={() => setModo("prova")}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  modo === "prova"
                    ? "border-gold-400 bg-gold-50 ring-1 ring-gold-300"
                    : "border-navy-100 hover:border-navy-200"
                )}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <FileSearch size={16} className="text-gold-500" /> No estilo de provas
                  anteriores
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Imita o recorte e o nível de cobrança da banca, e já preenche banca,
                  ano e prova de referência.
                </p>
              </button>
            </div>

            {modo === "prova" && (
              <>
                <div className="flex items-start gap-2.5 rounded-xl border border-navy-100 bg-cream/60 px-4 py-3 text-xs leading-relaxed text-ink">
                  <Info size={14} className="mt-0.5 shrink-0 text-navy-500" />
                  <span>
                    A IA <strong>não copia</strong> enunciado de prova real — ela escreve
                    questão nova imitando o formato da banca. Copiar prova de terceiro
                    seria uso de material que não é nosso; treinar no formato dela, não.
                    Confira a referência antes de publicar.
                  </span>
                </div>

                <Field label="Banca de referência">
                  <select
                    value={banca}
                    onChange={(e) => setBanca(e.target.value)}
                    className={inputCls}
                  >
                    {BANCAS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantas questões">
                <select
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  className={inputCls}
                >
                  {[3, 5, 8, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} questões
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Instruções extras" hint="Opcional">
                <input
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex.: focar em transportadoras do Simples"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-4">
              <p className="text-xs text-muted">
                {areaFinal && assuntoFinal ? (
                  <>
                    {quantidade} questões de <strong className="text-navy-700">{nivel}</strong>{" "}
                    sobre <strong className="text-navy-700">{assuntoFinal}</strong> em{" "}
                    {areaFinal}
                  </>
                ) : (
                  "Escolha a área e o assunto para continuar."
                )}
              </p>
              <Button variant="gold" onClick={gerar} disabled={!podeGerar}>
                {gerando ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Gerando…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Gerar questões
                  </>
                )}
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* ------------------------------------------------ passo 3: revisão -- */}
      {lote && (
        <>
          <Card className="!border-gold-200 !bg-gold-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <Sparkles size={16} className="text-gold-500" /> Passo 3 · Revise antes
                  de gravar
                </p>
                <p className="mt-1 text-xs text-gold-600">
                  {mantidas} de {lote.length} serão gravadas em {areaFinal} · {assuntoFinal} ·{" "}
                  {nivel}
                  {fonte === "rascunho" && " · rascunho local, sem IA"}
                  {fonte === "anthropic" && " · geradas por IA"}
                  {fonte === "n8n" && " · geradas pelo fluxo do n8n"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setLote(null)}>
                  <X size={14} /> Descartar lote
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={gravar}
                  disabled={salvando || mantidas === 0}
                >
                  <Save size={14} />{" "}
                  {salvando ? "Gravando…" : `Gravar ${mantidas} no banco`}
                </Button>
              </div>
            </div>
          </Card>

          {avisoFonte && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {avisoFonte}
            </p>
          )}

          <div className="space-y-3">
            {lote.map((q, i) => (
              <QuestaoRevisao
                key={i}
                indice={i}
                questao={q}
                descartada={descartadas.has(i)}
                modo={modo}
                aoAlternarDescarte={() =>
                  setDescartadas((d) => {
                    const nova = new Set(d);
                    if (nova.has(i)) nova.delete(i);
                    else nova.add(i);
                    return nova;
                  })
                }
                aoEditar={(patch) => editarQuestao(i, patch)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- peças -- */
function Chip({
  children, ativo, onClick,
}: {
  children: React.ReactNode; ativo: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-navy-100 text-muted hover:border-navy-200 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

function QuestaoRevisao({
  indice, questao, descartada, modo, aoAlternarDescarte, aoEditar,
}: {
  indice: number;
  questao: QuestaoGerada;
  descartada: boolean;
  modo: "ia" | "prova";
  aoAlternarDescarte: () => void;
  aoEditar: (patch: Partial<QuestaoGerada>) => void;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <Card className={cn("!p-4", descartada && "opacity-40")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-xs font-bold text-navy-600">
          {indice + 1}
        </span>

        <div className="min-w-0 flex-1">
          {editando ? (
            <textarea
              rows={3}
              value={questao.enunciado}
              onChange={(e) => aoEditar({ enunciado: e.target.value })}
              className={cn(inputCls, "text-sm")}
            />
          ) : (
            <p className="text-sm font-medium leading-relaxed text-navy-700">
              {questao.enunciado}
            </p>
          )}

          <div className="mt-3 space-y-1.5">
            {questao.alternativas.map((alt, ai) => {
              const correta = questao.correta === alt.id;
              return (
                <div key={alt.id} className="flex items-start gap-2.5">
                  <button
                    onClick={() => aoEditar({ correta: alt.id })}
                    title={correta ? "Correta" : "Marcar como correta"}
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase transition",
                      correta
                        ? "bg-emerald-500 text-white"
                        : "bg-navy-50 text-navy-500 hover:bg-navy-100"
                    )}
                  >
                    {alt.id}
                  </button>
                  {editando ? (
                    <input
                      value={alt.texto}
                      onChange={(e) => {
                        const novas = [...questao.alternativas];
                        novas[ai] = { ...alt, texto: e.target.value };
                        aoEditar({ alternativas: novas });
                      }}
                      className={cn(inputCls, "!py-1.5 text-xs")}
                    />
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-xs leading-relaxed",
                        correta ? "font-semibold text-emerald-700" : "text-ink"
                      )}
                    >
                      {alt.texto}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {editando ? (
            <textarea
              rows={2}
              value={questao.explicacao ?? ""}
              onChange={(e) => aoEditar({ explicacao: e.target.value })}
              placeholder="Explicação"
              className={cn(inputCls, "mt-3 text-xs")}
            />
          ) : (
            questao.explicacao && (
              <p className="mt-3 rounded-lg bg-cream/70 p-3 text-xs leading-relaxed text-ink">
                {questao.explicacao}
              </p>
            )
          )}

          {modo === "prova" && (questao.banca || questao.prova) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {questao.banca && <Badge tone="teal">{questao.banca}</Badge>}
              {questao.prova && <Badge tone="muted">{questao.prova}</Badge>}
              {questao.ano && <Badge tone="muted">{questao.ano}</Badge>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={() => setEditando((e) => !e)}
            title={editando ? "Concluir edição" : "Editar"}
            className="rounded-lg p-2 text-muted transition hover:bg-navy-50 hover:text-navy-700"
          >
            {editando ? <CheckCircle2 size={15} /> : <Wand2 size={15} />}
          </button>
          <button
            onClick={aoAlternarDescarte}
            title={descartada ? "Recuperar" : "Descartar"}
            className={cn(
              "rounded-lg p-2 transition",
              descartada
                ? "text-emerald-600 hover:bg-emerald-50"
                : "text-muted hover:bg-red-50 hover:text-red-600"
            )}
          >
            {descartada ? <CheckCircle2 size={15} /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>
    </Card>
  );
}
