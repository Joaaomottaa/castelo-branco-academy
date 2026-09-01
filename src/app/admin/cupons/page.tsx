"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePercent, Copy, Check, Infinity as InfinityIcon, Pencil, Plus, RefreshCw,
  Ticket, Trash2, TrendingDown, Users,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Progress, cn, inputCls } from "@/components/ui";
import { AvisoErro, ConfirmarExclusao, Modal } from "@/components/modal";
import {
  alternarCupom, apagarCupom, listarCupons, listarUsos, salvarCupom,
  type Cupom, type DadosCupom, type UsoDeCupom,
} from "@/lib/repo-cupons";

/* ==========================================================================
   CUPONS DE DESCONTO

   O que a tela precisa responder, nessa ordem: quanto de receita o desconto
   consumiu, quais cupons estão de pé e quem usou.

   O código nunca é listado para o aluno — a validação passa por RPC. Aqui o
   admin vê tudo, inclusive os desativados.
   ========================================================================== */

const PLANOS = ["Pro", "Enterprise"];
const CICLOS = [
  { v: "mensal", rotulo: "Mensal" },
  { v: "anual", rotulo: "Anual" },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminCuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [usos, setUsos] = useState<UsoDeCupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Cupom | "novo" | null>(null);
  const [excluir, setExcluir] = useState<Cupom | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [rc, ru] = await Promise.all([listarCupons(), listarUsos()]);
    setCupons(rc.cupons);
    setUsos(ru);
    setErro(rc.erro ?? "");
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const resumo = useMemo(() => {
    const descontoTotal = usos.reduce((a, u) => a + u.valorDesconto, 0);
    const receita = usos.reduce((a, u) => a + u.valorFinal, 0);
    return {
      ativos: cupons.filter((c) => c.ativo && !expirado(c)).length,
      resgates: usos.length,
      descontoTotal,
      receita,
    };
  }, [cupons, usos]);

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    const r = await apagarCupom(excluir.id);
    setExcluindo(false);
    if (!r.ok) return setErro(r.erro ?? "");
    setExcluir(null);
    await recarregar();
  }

  function copiar(codigo: string) {
    void navigator.clipboard?.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 1600);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Cupons de desconto</h1>
          <p className="mt-1 text-sm text-muted">
            Crie o código, defina a regra e acompanhe quanto cada campanha custou em desconto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={recarregar}>
            <RefreshCw size={14} className={cn(carregando && "animate-spin")} /> Atualizar
          </Button>
          <Button variant="gold" size="sm" onClick={() => setEditando("novo")}>
            <Plus size={14} /> Novo cupom
          </Button>
        </div>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumo icone={<Ticket size={15} />} valor={String(resumo.ativos)} rotulo="Cupons no ar" />
        <Resumo icone={<Users size={15} />} valor={String(resumo.resgates)} rotulo="Resgates" />
        <Resumo
          icone={<TrendingDown size={15} />}
          valor={brl(resumo.descontoTotal)}
          rotulo="Desconto concedido"
          tom="alerta"
        />
        <Resumo
          icone={<BadgePercent size={15} />}
          valor={brl(resumo.receita)}
          rotulo="Receita com cupom"
          tom="ok"
        />
      </div>

      {carregando ? (
        <Card><p className="py-8 text-center text-sm text-muted">Carregando cupons…</p></Card>
      ) : cupons.length === 0 ? (
        <EmptyState
          icon={<Ticket size={32} />}
          title="Nenhum cupom criado"
          description="Um cupom de primeiro mês costuma converter melhor que desconto permanente — e não corrói o preço de tabela."
          action={
            <Button variant="gold" onClick={() => setEditando("novo")}>
              <Plus size={15} /> Criar o primeiro
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {cupons.map((c) => {
            const venceu = expirado(c);
            const esgotou = c.limiteUsos !== undefined && c.usos >= c.limiteUsos;
            const noAr = c.ativo && !venceu && !esgotou;

            return (
              <Card key={c.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      noAr ? "gold-gradient text-navy-800" : "bg-navy-50 text-navy-300"
                    )}
                  >
                    <Ticket size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copiar(c.codigo)}
                        title="Copiar código"
                        className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-2 py-0.5 font-mono text-sm font-bold text-white transition hover:bg-navy-600"
                      >
                        {c.codigo}
                        {copiado === c.codigo ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                      <Badge tone={noAr ? "green" : venceu ? "red" : esgotou ? "gold" : "muted"}>
                        {noAr ? "No ar" : venceu ? "Expirado" : esgotou ? "Esgotado" : "Desativado"}
                      </Badge>
                    </div>

                    <p className="mt-1.5 text-sm font-semibold text-navy-700">
                      {c.tipo === "percentual" ? `${c.valor}% de desconto` : `${brl(c.valor)} de desconto`}
                    </p>
                    {c.descricao && <p className="mt-0.5 text-xs text-muted">{c.descricao}</p>}

                    <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted">
                      <span>
                        {c.planos.length ? `Planos: ${c.planos.join(", ")}` : "Todos os planos"}
                      </span>
                      <span>·</span>
                      <span>
                        {c.ciclos.length ? `Cobrança ${c.ciclos.join(" e ")}` : "Qualquer cobrança"}
                      </span>
                      {c.expiraEm && (
                        <>
                          <span>·</span>
                          <span>até {new Date(c.expiraEm).toLocaleDateString("pt-BR")}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      title={c.ativo ? "Desativar" : "Ativar"}
                      onClick={async () => { await alternarCupom(c.id, !c.ativo); await recarregar(); }}
                    >
                      <span
                        className={cn(
                          "block h-3.5 w-6 rounded-full transition",
                          c.ativo ? "bg-emerald-500" : "bg-navy-200"
                        )}
                      >
                        <span
                          className={cn(
                            "block h-2.5 w-2.5 translate-y-0.5 rounded-full bg-white transition",
                            c.ativo ? "translate-x-3" : "translate-x-0.5"
                          )}
                        />
                      </span>
                    </IconBtn>
                    <IconBtn title="Editar" onClick={() => setEditando(c)}>
                      <Pencil size={14} />
                    </IconBtn>
                    <IconBtn title="Excluir" danger onClick={() => setExcluir(c)}>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </div>

                <div className="mt-3 border-t border-navy-100 pt-3">
                  <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
                    <span className="text-muted">
                      {c.usos} uso{c.usos === 1 ? "" : "s"}
                      {c.limitePorPessoa > 1 && ` · até ${c.limitePorPessoa} por pessoa`}
                    </span>
                    <span className="font-semibold text-navy-700">
                      {c.limiteUsos !== undefined ? (
                        `limite ${c.limiteUsos}`
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <InfinityIcon size={11} /> sem limite
                        </span>
                      )}
                    </span>
                  </div>
                  {c.limiteUsos !== undefined && (
                    <Progress
                      value={(c.usos / c.limiteUsos) * 100}
                      tone={c.usos >= c.limiteUsos ? "green" : "gold"}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------- resgates */}
      <Card className="!p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
          Últimos resgates
        </h2>
        {usos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Nenhum cupom foi usado ainda. Quando alguém assinar com desconto, aparece aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* Sete colunas não cabem em 280px: sem um mínimo, o nome do aluno
                e a data ficam com duas letras cada — a tabela rola no quadro. */}
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="pb-2 font-semibold">Aluno</th>
                  <th className="pb-2 font-semibold">Cupom</th>
                  <th className="pb-2 font-semibold">Plano</th>
                  <th className="pb-2 text-right font-semibold">De</th>
                  <th className="pb-2 text-right font-semibold">Desconto</th>
                  <th className="pb-2 text-right font-semibold">Pagou</th>
                  <th className="pb-2 text-right font-semibold">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {usos.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3 text-[13px] font-medium text-navy-700">{u.perfilNome}</td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy-700">
                        {u.codigo}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] text-muted">
                      {u.plano} · {u.ciclo}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] tabular-nums text-muted line-through">
                      {brl(u.valorOriginal)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] font-semibold tabular-nums text-red-600">
                      − {brl(u.valorDesconto)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] font-bold tabular-nums text-navy-700">
                      {brl(u.valorFinal)}
                    </td>
                    <td className="py-2.5 text-right text-[11px] text-muted">
                      {new Date(u.criadoEm).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && (
        <ModalCupom
          cupom={editando === "novo" ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => { setEditando(null); await recarregar(); }}
        />
      )}

      {excluir && (
        <ConfirmarExclusao
          titulo="Excluir cupom"
          descricao={
            excluir.usos > 0
              ? `O cupom ${excluir.codigo} já foi usado ${excluir.usos} vez(es). Apagar remove também o histórico de resgates — considere desativar em vez de excluir.`
              : `O cupom ${excluir.codigo} será apagado. Não há como desfazer.`
          }
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluir(null)}
          ocupado={excluindo}
        />
      )}
    </div>
  );
}

function expirado(c: Cupom): boolean {
  return Boolean(c.expiraEm && new Date(c.expiraEm) < new Date());
}

/* ======================================================================
   Formulário
   ====================================================================== */
function ModalCupom({
  cupom, aoFechar, aoSalvar,
}: {
  cupom?: Cupom; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState<DadosCupom>({
    id: cupom?.id,
    codigo: cupom?.codigo ?? "",
    descricao: cupom?.descricao ?? "",
    tipo: cupom?.tipo ?? "percentual",
    valor: cupom?.valor ?? 20,
    planos: cupom?.planos ?? [],
    ciclos: cupom?.ciclos ?? [],
    limiteUsos: cupom?.limiteUsos !== undefined ? String(cupom.limiteUsos) : "",
    limitePorPessoa: cupom?.limitePorPessoa ?? 1,
    expiraEm: cupom?.expiraEm ? cupom.expiraEm.slice(0, 10) : "",
    ativo: cupom?.ativo ?? true,
  });

  function alternar(campo: "planos" | "ciclos", v: string) {
    setF((x) => ({
      ...x,
      [campo]: x[campo].includes(v) ? x[campo].filter((y) => y !== v) : [...x[campo], v],
    }));
  }

  async function submeter() {
    setSalvando(true);
    setErro("");
    const r = await salvarCupom(f);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
    aoSalvar();
  }

  // Prévia sobre o preço cheio do Pro mensal.
  const previa = f.tipo === "percentual"
    ? Math.max(0, 89 - (89 * f.valor) / 100)
    : Math.max(0, 89 - f.valor);

  return (
    <Modal
      titulo={cupom ? "Editar cupom" : "Novo cupom"}
      subtitulo="O aluno digita o código no checkout; a validação acontece no banco."
      aoFechar={aoFechar}
      largura="max-w-xl"
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando}>
            {salvando ? "Salvando…" : cupom ? "Salvar alterações" : "Criar cupom"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Código" hint="Letras, números e hífen. Vira maiúscula sozinho.">
            <input
              value={f.codigo}
              onChange={(e) => setF((v) => ({ ...v, codigo: e.target.value.toUpperCase() }))}
              placeholder="CASTELO50"
              className={inputCls + " font-mono font-bold"}
            />
          </Field>
          <Field label="Tipo de desconto">
            <select
              value={f.tipo}
              onChange={(e) => setF((v) => ({ ...v, tipo: e.target.value as DadosCupom["tipo"] }))}
              className={inputCls}
            >
              <option value="percentual">Percentual (%)</option>
              <option value="valor">Valor fixo (R$)</option>
            </select>
          </Field>
        </div>

        <Field
          label={f.tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
          hint={`No Pro mensal de R$ 89, o aluno pagaria ${brl(previa)}.`}
        >
          <input
            type="number"
            min={1}
            max={f.tipo === "percentual" ? 100 : undefined}
            value={f.valor}
            onChange={(e) => setF((v) => ({ ...v, valor: Number(e.target.value) }))}
            className={inputCls}
          />
        </Field>

        <Field label="Descrição" hint="Aparece para o aluno quando o cupom é aceito.">
          <input
            value={f.descricao}
            onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
            placeholder="Metade do preço no primeiro mês"
            className={inputCls}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
            Vale para os planos
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PLANOS.map((p) => (
              <Chip key={p} ativo={f.planos.includes(p)} onClick={() => alternar("planos", p)}>
                {p === "Enterprise" ? "Empresarial" : p}
              </Chip>
            ))}
          </div>
          <span className="mt-1 block text-xs text-muted">
            Nenhum marcado = vale para todos os planos.
          </span>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
            Vale na cobrança
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CICLOS.map((c) => (
              <Chip key={c.v} ativo={f.ciclos.includes(c.v)} onClick={() => alternar("ciclos", c.v)}>
                {c.rotulo}
              </Chip>
            ))}
          </div>
          <span className="mt-1 block text-xs text-muted">
            Nenhum marcado = vale nas duas.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Limite de usos" hint="Em branco = ilimitado.">
            <input
              type="number"
              min={1}
              value={f.limiteUsos}
              onChange={(e) => setF((v) => ({ ...v, limiteUsos: e.target.value }))}
              placeholder="100"
              className={inputCls}
            />
          </Field>
          <Field label="Por pessoa">
            <input
              type="number"
              min={1}
              value={f.limitePorPessoa}
              onChange={(e) => setF((v) => ({ ...v, limitePorPessoa: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Expira em" hint="Em branco = sem prazo.">
            <input
              type="date"
              value={f.expiraEm}
              onChange={(e) => setF((v) => ({ ...v, expiraEm: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4">
          <input
            type="checkbox"
            checked={f.ativo}
            onChange={(e) => setF((v) => ({ ...v, ativo: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-[#C89F50]"
          />
          <span>
            <span className="block text-sm font-semibold text-navy-700">Cupom ativo</span>
            <span className="mt-0.5 block text-xs text-muted">
              Desmarcado, o código passa a ser recusado no checkout imediatamente.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function Chip({
  children, ativo, onClick,
}: {
  children: React.ReactNode; ativo: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-700"
          : "border-navy-100 text-muted hover:border-navy-200 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

function Resumo({
  icone, valor, rotulo, tom,
}: {
  icone: React.ReactNode; valor: string; rotulo: string; tom?: "ok" | "alerta";
}) {
  return (
    <Card className="!p-4">
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg",
          tom === "ok" ? "bg-emerald-50 text-emerald-600"
            : tom === "alerta" ? "bg-gold-50 text-gold-600"
              : "bg-navy-50 text-navy-600"
        )}
      >
        {icone}
      </span>
      <p className="mt-2 text-xl font-bold tabular-nums text-navy-700">{valor}</p>
      <p className="text-[11px] text-muted">{rotulo}</p>
    </Card>
  );
}

function IconBtn({
  children, title, danger, onClick,
}: {
  children: React.ReactNode; title: string; danger?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
        danger
          ? "text-navy-300 hover:bg-red-50 hover:text-red-600"
          : "text-navy-400 hover:bg-navy-50 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}
