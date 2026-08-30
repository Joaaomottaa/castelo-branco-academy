"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, Briefcase, Building2, Eye, EyeOff, Mail, MapPin, Pencil, Plus,
  RefreshCw, Route, Search, Star, Trash2, Users, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro, ConfirmarExclusao, Modal } from "@/components/modal";
import { useDados } from "@/lib/dados";
import { calcularMatch } from "@/lib/repo";
import {
  alternarVaga, apagarEmpresa, apagarVaga, carregarCandidatos, carregarEmpresas,
  carregarVagasAdmin, definirStatusCandidatura, salvarEmpresa, salvarVaga,
  type Candidato, type DadosEmpresa, type DadosVaga, type Empresa, type VagaAdmin,
} from "@/lib/repo-vagas";
import type { Vaga } from "@/lib/types";

const MODELOS = ["Presencial", "Híbrido", "Remoto"];
const CONTRATOS = ["CLT", "PJ", "Estágio", "Freelance"];
const SENIORIDADES = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];
const CORES = ["#00204D", "#B88A45", "#2F6E75", "#1F4A7A", "#7A3E2F", "#3D5A3C"];

const STATUS_CANDIDATURA = [
  { v: "enviada", rotulo: "Enviada", tom: "muted" as const },
  { v: "em_analise", rotulo: "Em análise", tom: "navy" as const },
  { v: "entrevista", rotulo: "Entrevista", tom: "gold" as const },
  { v: "aprovada", rotulo: "Aprovada", tom: "green" as const },
  { v: "recusada", rotulo: "Recusada", tom: "red" as const },
];

export default function AdminVagasPage() {
  const [aba, setAba] = useState<"vagas" | "empresas">("vagas");
  const [vagas, setVagas] = useState<VagaAdmin[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const [editandoVaga, setEditandoVaga] = useState<VagaAdmin | "nova" | null>(null);
  const [editandoEmpresa, setEditandoEmpresa] = useState<Empresa | "nova" | null>(null);
  const [vendoCandidatos, setVendoCandidatos] = useState<VagaAdmin | null>(null);
  const [excluir, setExcluir] = useState<
    { tipo: "vaga" | "empresa"; id: string; nome: string } | null
  >(null);
  const [excluindo, setExcluindo] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [rv, re] = await Promise.all([carregarVagasAdmin(), carregarEmpresas()]);
    setVagas(rv.vagas);
    setEmpresas(re);
    setErro(rv.erro ?? "");
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const listaVagas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vagas.filter((v) => !q || `${v.titulo} ${v.empresa} ${v.cidade}`.toLowerCase().includes(q));
  }, [vagas, busca]);

  const listaEmpresas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas.filter((e) => !q || `${e.nome} ${e.cidade ?? ""}`.toLowerCase().includes(q));
  }, [empresas, busca]);

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    const r = excluir.tipo === "vaga"
      ? await apagarVaga(excluir.id)
      : await apagarEmpresa(excluir.id);
    setExcluindo(false);
    if (!r.ok) return setErro(r.erro ?? "");
    setExcluir(null);
    await recarregar();
  }

  const totalCandidaturas = vagas.reduce((a, v) => a + v.candidatos, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Vagas & empresas</h1>
          <p className="mt-1 text-sm text-muted">
            Publique vagas, cadastre empresas e veja os candidatos ordenados por compatibilidade.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={recarregar}>
            <RefreshCw size={14} className={cn(carregando && "animate-spin")} /> Atualizar
          </Button>
          {aba === "vagas" ? (
            <Button variant="gold" size="sm" onClick={() => setEditandoVaga("nova")}>
              <Plus size={14} /> Publicar vaga
            </Button>
          ) : (
            <Button variant="gold" size="sm" onClick={() => setEditandoEmpresa("nova")}>
              <Plus size={14} /> Nova empresa
            </Button>
          )}
        </div>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Vagas ativas", vagas.filter((v) => v.ativa).length],
          ["Vagas pausadas", vagas.filter((v) => !v.ativa).length],
          ["Empresas parceiras", empresas.length],
          ["Candidaturas", totalCandidaturas],
        ].map(([r, v]) => (
          <Card key={r as string} className="!p-4">
            <p className="text-xl font-bold text-navy-700">{v as number}</p>
            <p className="text-[11px] text-muted">{r as string}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-navy-100 p-0.5">
            {([["vagas", "Vagas", Briefcase], ["empresas", "Empresas", Building2]] as const).map(
              ([k, rotulo, Icone]) => (
                <button
                  key={k}
                  onClick={() => setAba(k)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    aba === k ? "bg-navy-700 text-white" : "text-muted hover:text-navy-700"
                  )}
                >
                  <Icone size={13} /> {rotulo}
                </button>
              )
            )}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={aba === "vagas" ? "Buscar vaga, empresa ou cidade" : "Buscar empresa"}
              className={inputCls + " pl-10"}
            />
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ vagas */}
      {aba === "vagas" && (
        carregando ? (
          <Card><p className="py-8 text-center text-sm text-muted">Carregando vagas…</p></Card>
        ) : listaVagas.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={32} />}
            title={vagas.length ? "Nenhuma vaga com esse termo" : "Nenhuma vaga publicada"}
            description="Cadastre a empresa primeiro; a vaga precisa estar vinculada a uma."
            action={
              <Button variant="gold" onClick={() => setEditandoVaga("nova")}>
                <Plus size={15} /> Publicar vaga
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {listaVagas.map((v) => (
              <Card key={v.id} className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: v.logoCor }}
                  >
                    <Building2 size={17} />
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <p className="truncate text-sm font-bold text-navy-700">{v.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-xs text-muted">
                      <span>{v.empresa}</span>
                      {v.cidade && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={10} /> {v.cidade}/{v.uf}
                        </span>
                      )}
                      {v.faixa && <span>{v.faixa}</span>}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Badge tone="muted">{v.modelo}</Badge>
                    <Badge tone="muted">{v.contrato}</Badge>
                    {v.senioridade && <Badge tone="navy">{v.senioridade}</Badge>}
                    <Badge tone={v.ativa ? "green" : "gold"}>{v.ativa ? "Ativa" : "Pausada"}</Badge>
                  </div>

                  <button
                    onClick={() => setVendoCandidatos(v)}
                    title="Ver candidatos"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600"
                  >
                    <Users size={13} /> {v.candidatos}
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      title={v.ativa ? "Pausar vaga" : "Reativar vaga"}
                      onClick={async () => { await alternarVaga(v.id, !v.ativa); await recarregar(); }}
                    >
                      {v.ativa ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconBtn>
                    <IconBtn title="Editar vaga" onClick={() => setEditandoVaga(v)}>
                      <Pencil size={15} />
                    </IconBtn>
                    <IconBtn
                      title="Excluir vaga"
                      danger
                      onClick={() => setExcluir({ tipo: "vaga", id: v.id, nome: v.titulo })}
                    >
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>

                {(v.cursosDesejados.length > 0 || v.trilhasDesejadas.length > 0) && (
                  <p className="mt-2.5 border-t border-navy-100 pt-2.5 text-[11px] text-muted">
                    Valoriza {v.trilhasDesejadas.length > 0 && `${v.trilhasDesejadas.length} trilha(s)`}
                    {v.trilhasDesejadas.length > 0 && v.cursosDesejados.length > 0 && " e "}
                    {v.cursosDesejados.length > 0 && `${v.cursosDesejados.length} certificado(s)`}
                    {" "}— candidatos com essa formação sobem no ranking.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* --------------------------------------------------------- empresas */}
      {aba === "empresas" && (
        carregando ? (
          <Card><p className="py-8 text-center text-sm text-muted">Carregando empresas…</p></Card>
        ) : listaEmpresas.length === 0 ? (
          <EmptyState
            icon={<Building2 size={32} />}
            title="Nenhuma empresa cadastrada"
            description="A vaga precisa estar vinculada a uma empresa."
            action={
              <Button variant="gold" onClick={() => setEditandoEmpresa("nova")}>
                <Plus size={15} /> Nova empresa
              </Button>
            }
          />
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {listaEmpresas.map((e) => (
              <Card key={e.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: e.cor }}
                  >
                    <Building2 size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy-700">{e.nome}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[e.cnpj, e.cidade && `${e.cidade}/${e.uf}`, `${e.vagas} vaga(s)`]
                        .filter(Boolean).join(" · ")}
                    </p>
                    {e.licencasContratadas > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-gold-600">
                        {e.licencasUsadas}/{e.licencasContratadas} licenças em uso
                        {e.membros > e.licencasUsadas
                          && ` · ${e.membros} pessoa(s) no time`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn title="Editar" onClick={() => setEditandoEmpresa(e)}>
                      <Pencil size={15} />
                    </IconBtn>
                    <IconBtn
                      title="Excluir"
                      danger
                      onClick={() => setExcluir({ tipo: "empresa", id: e.id, nome: e.nome })}
                    >
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ---------------------------------------------------------- modais */}
      {editandoVaga && (
        <ModalVaga
          vaga={editandoVaga === "nova" ? undefined : editandoVaga}
          empresas={empresas}
          aoFechar={() => setEditandoVaga(null)}
          aoSalvar={async () => { setEditandoVaga(null); await recarregar(); }}
        />
      )}

      {editandoEmpresa && (
        <ModalEmpresa
          empresa={editandoEmpresa === "nova" ? undefined : editandoEmpresa}
          aoFechar={() => setEditandoEmpresa(null)}
          aoSalvar={async () => { setEditandoEmpresa(null); await recarregar(); }}
        />
      )}

      {vendoCandidatos && (
        <ModalCandidatos
          vaga={vendoCandidatos}
          aoFechar={() => setVendoCandidatos(null)}
          aoMudar={recarregar}
        />
      )}

      {excluir && (
        <ConfirmarExclusao
          titulo={`Excluir ${excluir.tipo}`}
          descricao={
            excluir.tipo === "vaga"
              ? `A vaga “${excluir.nome}” e todas as candidaturas dela serão apagadas. Não há como desfazer.`
              : `A empresa “${excluir.nome}” será apagada. Se houver vagas publicadas, apague-as antes.`
          }
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluir(null)}
          ocupado={excluindo}
        />
      )}
    </div>
  );
}

/* ======================================================================
   Formulário da vaga
   ====================================================================== */
function ModalVaga({
  vaga, empresas, aoFechar, aoSalvar,
}: {
  vaga?: VagaAdmin;
  empresas: Empresa[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { cursos, trilhas } = useDados();
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [f, setF] = useState<DadosVaga>({
    id: vaga?.id,
    empresaId: vaga?.empresaId ?? empresas[0]?.id ?? "",
    titulo: vaga?.titulo ?? "",
    descricao: vaga?.descricao ?? "",
    cidade: vaga?.cidade ?? "",
    uf: vaga?.uf ?? "",
    modelo: vaga?.modelo ?? MODELOS[0],
    contrato: vaga?.contrato ?? CONTRATOS[0],
    faixa: vaga?.faixa ?? "",
    senioridade: vaga?.senioridade ?? SENIORIDADES[2],
    requisitos: vaga?.requisitos ?? [],
    cursosDesejados: vaga?.cursosDesejados ?? [],
    trilhasDesejadas: vaga?.trilhasDesejadas ?? [],
    ativa: vaga?.ativa ?? true,
  });
  const [requisitosTexto, setRequisitosTexto] = useState((vaga?.requisitos ?? []).join(", "));

  function alternar(campo: "cursosDesejados" | "trilhasDesejadas", id: string) {
    setF((v) => ({
      ...v,
      [campo]: v[campo].includes(id) ? v[campo].filter((x) => x !== id) : [...v[campo], id],
    }));
  }

  async function submeter() {
    setSalvando(true);
    setErro("");
    const r = await salvarVaga({
      ...f,
      requisitos: requisitosTexto.split(",").map((x) => x.trim()).filter(Boolean),
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
    aoSalvar();
  }

  return (
    <Modal
      titulo={vaga ? "Editar vaga" : "Publicar vaga"}
      subtitulo="Certificações e trilhas são opcionais — quando preenchidas, sobem o candidato no ranking."
      aoFechar={aoFechar}
      largura="max-w-2xl"
      rodape={
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando}>
            {salvando ? "Salvando…" : vaga ? "Salvar alterações" : "Publicar vaga"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>

        {empresas.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nenhuma empresa cadastrada. Cadastre uma na aba Empresas antes de publicar a vaga.
          </div>
        )}

        <Field label="Título da vaga">
          <input
            value={f.titulo}
            onChange={(e) => setF((v) => ({ ...v, titulo: e.target.value }))}
            placeholder="Analista Fiscal Pleno"
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa">
            <select
              value={f.empresaId}
              onChange={(e) => setF((v) => ({ ...v, empresaId: e.target.value }))}
              className={inputCls}
            >
              <option value="">Escolha…</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Faixa salarial">
            <input
              value={f.faixa}
              onChange={(e) => setF((v) => ({ ...v, faixa: e.target.value }))}
              placeholder="R$ 5.500 – R$ 7.200"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Cidade">
            <input
              value={f.cidade}
              onChange={(e) => setF((v) => ({ ...v, cidade: e.target.value }))}
              placeholder="Feira de Santana"
              className={inputCls}
            />
          </Field>
          <Field label="UF">
            <input
              value={f.uf}
              maxLength={2}
              onChange={(e) => setF((v) => ({ ...v, uf: e.target.value.toUpperCase() }))}
              placeholder="BA"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Modelo">
            <select
              value={f.modelo}
              onChange={(e) => setF((v) => ({ ...v, modelo: e.target.value }))}
              className={inputCls}
            >
              {MODELOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Contrato">
            <select
              value={f.contrato}
              onChange={(e) => setF((v) => ({ ...v, contrato: e.target.value }))}
              className={inputCls}
            >
              {CONTRATOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Senioridade">
            <select
              value={f.senioridade}
              onChange={(e) => setF((v) => ({ ...v, senioridade: e.target.value }))}
              className={inputCls}
            >
              {SENIORIDADES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            rows={4}
            value={f.descricao}
            onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field
          label="Requisitos"
          hint="Separados por vírgula. Entram no cálculo de compatibilidade contra as habilidades do candidato."
        >
          <input
            value={requisitosTexto}
            onChange={(e) => setRequisitosTexto(e.target.value)}
            placeholder="SPED, Obrigações acessórias, CT-e"
            className={inputCls}
          />
        </Field>

        <Selecionaveis
          rotulo="Certificações valorizadas"
          dica="Opcional. Deixe em branco se a vaga não exige curso específico."
          itens={cursos.map((c) => ({ id: c.id ?? c.slug, nome: c.titulo }))}
          selecionados={f.cursosDesejados}
          aoAlternar={(id) => alternar("cursosDesejados", id)}
          icone={<Award size={12} />}
        />

        <Selecionaveis
          rotulo="Trilhas exigidas"
          dica="Opcional. A trilha pesa 60% do critério de formação — bem mais que o curso avulso."
          itens={trilhas.map((t) => ({ id: t.id, nome: t.nome }))}
          selecionados={f.trilhasDesejadas}
          aoAlternar={(id) => alternar("trilhasDesejadas", id)}
          icone={<Route size={12} />}
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4">
          <input
            type="checkbox"
            checked={f.ativa}
            onChange={(e) => setF((v) => ({ ...v, ativa: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-[#C89F50]"
          />
          <span>
            <span className="block text-sm font-semibold text-navy-700">Vaga ativa</span>
            <span className="mt-0.5 block text-xs text-muted">
              Desmarcada, ela some da listagem do aluno mas as candidaturas ficam guardadas.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function Selecionaveis({
  rotulo, dica, itens, selecionados, aoAlternar, icone,
}: {
  rotulo: string;
  dica: string;
  itens: Array<{ id: string; nome: string }>;
  selecionados: string[];
  aoAlternar: (id: string) => void;
  icone: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
        {rotulo}
        {selecionados.length > 0 && (
          <span className="ml-1.5 rounded-full bg-gold-400 px-1.5 text-[10px] text-navy-800">
            {selecionados.length}
          </span>
        )}
      </span>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-navy-100 p-2.5">
        {itens.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted">Nada cadastrado ainda.</p>
        )}
        {itens.map((i) => {
          const marcado = selecionados.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => aoAlternar(i.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                marcado
                  ? "border-gold-400 bg-gold-50 text-gold-700"
                  : "border-navy-100 text-muted hover:border-navy-200 hover:text-navy-700"
              )}
            >
              {marcado && icone}
              {i.nome}
            </button>
          );
        })}
      </div>
      <span className="mt-1 block text-xs text-muted">{dica}</span>
    </div>
  );
}

/* ======================================================================
   Formulário da empresa
   ====================================================================== */
function ModalEmpresa({
  empresa, aoFechar, aoSalvar,
}: {
  empresa?: Empresa; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState<DadosEmpresa>({
    id: empresa?.id,
    nome: empresa?.nome ?? "",
    cnpj: empresa?.cnpj ?? "",
    cor: empresa?.cor ?? CORES[0],
    site: empresa?.site ?? "",
    cidade: empresa?.cidade ?? "",
    uf: empresa?.uf ?? "",
    licencasContratadas: empresa?.licencasContratadas ?? 0,
  });

  async function submeter() {
    setSalvando(true);
    setErro("");
    const r = await salvarEmpresa(f);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
    aoSalvar();
  }

  return (
    <Modal
      titulo={empresa ? "Editar empresa" : "Nova empresa"}
      aoFechar={aoFechar}
      largura="max-w-lg"
      rodape={
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>
        <Field label="Nome">
          <input
            value={f.nome}
            onChange={(e) => setF((v) => ({ ...v, nome: e.target.value }))}
            placeholder="TransLog Brasil"
            className={inputCls}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CNPJ">
            <input
              value={f.cnpj}
              onChange={(e) => setF((v) => ({ ...v, cnpj: e.target.value }))}
              placeholder="00.000.000/0001-00"
              className={inputCls}
            />
          </Field>
          <Field label="Site">
            <input
              value={f.site}
              onChange={(e) => setF((v) => ({ ...v, site: e.target.value }))}
              placeholder="translog.com.br"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Cidade">
            <input
              value={f.cidade}
              onChange={(e) => setF((v) => ({ ...v, cidade: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="UF">
            <input
              value={f.uf}
              maxLength={2}
              onChange={(e) => setF((v) => ({ ...v, uf: e.target.value.toUpperCase() }))}
              className={inputCls}
            />
          </Field>
        </div>
        {/* O assento é cláusula comercial: a empresa vê o número no painel
            dela, mas só muda aqui. O banco reforça isso por gatilho, então
            não há caminho pela API que contorne esta tela. */}
        <Field
          label="Licenças contratadas"
          hint="Assentos que a empresa pode distribuir. Cada colaborador com licença recebe o plano Pro."
        >
          <input
            value={f.licencasContratadas}
            onChange={(e) =>
              setF((v) => ({
                ...v,
                licencasContratadas: Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0,
              }))
            }
            inputMode="numeric"
            className={inputCls}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
            Cor da marca
          </span>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setF((v) => ({ ...v, cor: c }))}
                className={cn(
                  "h-9 w-9 rounded-lg border-2 transition",
                  f.cor === c ? "border-gold-400 ring-2 ring-gold-400/30" : "border-transparent"
                )}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ======================================================================
   Candidatos, ordenados por compatibilidade
   ====================================================================== */
function ModalCandidatos({
  vaga, aoFechar, aoMudar,
}: {
  vaga: VagaAdmin; aoFechar: () => void; aoMudar: () => Promise<void>;
}) {
  const { cursos, trilhas } = useDados();
  const [lista, setLista] = useState<Candidato[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setLista(await carregarCandidatos(vaga.id));
    setCarregando(false);
  }, [vaga.id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // A vaga vem com ids; `calcularMatch` trabalha com slugs. A conversão fica
  // aqui para o cálculo ser exatamente o mesmo que o aluno vê.
  const vagaParaMatch = useMemo<Vaga>(() => {
    const slugCurso = new Map(cursos.map((c) => [c.id ?? c.slug, c.slug]));
    const slugTrilha = new Map(trilhas.map((t) => [t.id, t.slug]));
    return {
      id: vaga.id,
      titulo: vaga.titulo,
      empresa: vaga.empresa,
      logoCor: vaga.logoCor,
      cidade: vaga.cidade,
      uf: vaga.uf,
      modelo: vaga.modelo as Vaga["modelo"],
      contrato: vaga.contrato as Vaga["contrato"],
      faixa: vaga.faixa,
      senioridade: vaga.senioridade,
      publicadaEm: vaga.publicadaEm,
      requisitos: vaga.requisitos,
      certificacoesDesejadas: vaga.cursosDesejados
        .map((id) => slugCurso.get(id)).filter((s): s is string => Boolean(s)),
      trilhasDesejadas: vaga.trilhasDesejadas
        .map((id) => slugTrilha.get(id)).filter((s): s is string => Boolean(s)),
      descricao: vaga.descricao,
      candidatos: vaga.candidatos,
    };
  }, [vaga, cursos, trilhas]);

  const ranking = useMemo(
    () =>
      lista
        .map((c) => ({
          ...c,
          match: calcularMatch(vagaParaMatch, c.perfil, c.certificados, c.trilhas) ?? 0,
        }))
        .sort((a, b) => b.match - a.match),
    [lista, vagaParaMatch]
  );

  async function mudarStatus(id: string, status: string) {
    await definirStatusCandidatura(id, status);
    await recarregar();
    await aoMudar();
  }

  return (
    <Modal
      titulo="Candidatos"
      subtitulo={`${vaga.titulo} · ${vaga.empresa} — ordenados por compatibilidade`}
      aoFechar={aoFechar}
      largura="max-w-3xl"
    >
      {carregando ? (
        <p className="py-8 text-center text-sm text-muted">Carregando candidatos…</p>
      ) : ranking.length === 0 ? (
        <EmptyState
          icon={<Users size={30} />}
          title="Nenhuma candidatura ainda"
          description="Assim que alguém se candidatar, ela aparece aqui com o percentual de compatibilidade."
        />
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-cream px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
            <strong className="text-navy-700">Como o percentual é calculado:</strong> 30%
            formação exigida (trilha pesa 60% desse critério), 25% habilidades contra os
            requisitos, 15% senioridade, 15% localização, 10% atividade e perfil completo,
            5% pretensão declarada. É o mesmo número que o candidato vê.
          </p>

          {ranking.map((c, i) => (
            <div
              key={c.candidaturaId}
              className={cn(
                "rounded-xl border p-4",
                i === 0 ? "border-gold-300 bg-gold-50/40" : "border-navy-100"
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className="relative shrink-0">
                  <Avatar nome={c.perfil.nome} size={40} />
                  {i === 0 && (
                    <span className="gold-gradient absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-navy-800">
                      <Star size={9} />
                    </span>
                  )}
                </span>

                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-sm font-bold text-navy-700">{c.perfil.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[c.perfil.cargo, c.perfil.senioridade,
                      c.perfil.cidade && `${c.perfil.cidade}/${c.perfil.uf}`]
                      .filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {(c.perfil.habilidades ?? []).slice(0, 4).map((h) => (
                      <span key={h} className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] text-navy-600">
                        {h}
                      </span>
                    ))}
                  </p>
                </div>

                <div className="shrink-0 text-center">
                  <p
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      c.match >= 80 ? "text-emerald-600" : c.match >= 60 ? "text-gold-600" : "text-navy-400"
                    )}
                  >
                    {c.match}%
                  </p>
                  <p className="text-[10px] text-muted">compatível</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 pt-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <Award size={11} className="text-gold-500" />
                  {c.certificados.length} certificado(s)
                  {c.trilhas.length > 0 && (
                    <>
                      <Route size={11} className="ml-1.5 text-gold-500" />
                      {c.trilhas.length} trilha(s)
                    </>
                  )}
                  <a
                    href={`mailto:${c.perfil.email}`}
                    className="ml-1.5 inline-flex items-center gap-1 font-semibold text-gold-600 hover:underline"
                  >
                    <Mail size={11} /> {c.perfil.email}
                  </a>
                </div>

                <select
                  value={c.status}
                  onChange={(e) => mudarStatus(c.candidaturaId, e.target.value)}
                  className="rounded-lg border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 outline-none transition focus:border-gold-400"
                >
                  {STATUS_CANDIDATURA.map((s) => (
                    <option key={s.v} value={s.v}>{s.rotulo}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
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
