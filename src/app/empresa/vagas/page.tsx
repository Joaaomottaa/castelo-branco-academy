"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Briefcase, ExternalLink, Eye, EyeOff, Loader2, Mail, MapPin,
  Pencil, Plus, Trash2, Users,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";
import {
  alternarVaga, apagarVaga, carregarCandidatos, carregarVagasAdmin,
  definirStatusCandidatura, salvarVaga,
  type Candidato, type VagaAdmin,
} from "@/lib/repo-vagas";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   VAGAS DA EMPRESA

   O banco já sabia disso: `vagas.empresa_id` e a policy "vagas: empresa e admin
   escrevem" existem desde o primeiro schema. Faltava a tela — a empresa
   dependia do administrador da Academy para publicar uma vaga.

   O que amarra esta página ao resto do produto é a candidatura: quem se
   candidata traz certificados e trilhas concluídas na Academy, com código de
   validação. Contratar deixa de ser leitura de currículo autodeclarado.
   ========================================================================== */

const MODELOS = ["Presencial", "Híbrido", "Remoto"];
const CONTRATOS = ["CLT", "PJ", "Estágio", "Freelance"];
const SENIORIDADES = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];

const STATUS = [
  { v: "enviada", rotulo: "Enviada", tom: "muted" as const },
  { v: "em_analise", rotulo: "Em análise", tom: "navy" as const },
  { v: "entrevista", rotulo: "Entrevista", tom: "gold" as const },
  { v: "aprovada", rotulo: "Aprovada", tom: "green" as const },
  { v: "recusada", rotulo: "Recusada", tom: "red" as const },
];

export default function VagasDaEmpresa() {
  const { empresa } = useEmpresa();
  const [vagas, setVagas] = useState<VagaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<VagaAdmin | "nova" | null>(null);
  const [vendo, setVendo] = useState<VagaAdmin | null>(null);
  const [apagando, setApagando] = useState<VagaAdmin | null>(null);

  const atualizar = useCallback(async () => {
    const { vagas: todas, erro: e } = await carregarVagasAdmin();
    // A policy devolve as vagas ativas de todo mundo (é assim que o aluno vê o
    // mural); aqui interessam só as da casa.
    setVagas(todas.filter((v) => v.empresaId === empresa.id));
    if (e) setErro(e);
    setCarregando(false);
  }, [empresa.id]);

  useEffect(() => { void atualizar(); }, [atualizar]);

  const abertas = vagas.filter((v) => v.ativa).length;
  const candidatos = vagas.reduce((a, v) => a + v.candidatos, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-500">Contratar</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Minhas vagas</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            {vagas.length === 0
              ? "Publique uma vaga e ela aparece para toda a base — com o cruzamento automático entre o que você pede e o que cada pessoa já certificou aqui."
              : `${abertas} vaga(s) aberta(s) e ${candidatos} candidatura(s) recebida(s).`}
          </p>
        </div>
        <Button variant="gold" onClick={() => setEditando("nova")}>
          <Plus size={16} /> Publicar vaga
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
      ) : vagas.length === 0 ? (
        <Card className="py-12 text-center">
          <Briefcase size={26} className="mx-auto text-navy-300" />
          <p className="mt-3 font-semibold text-navy-700">Nenhuma vaga publicada</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            Ao exigir uma trilha ou um curso da Academy, a plataforma calcula a
            compatibilidade de cada candidato — e o candidato vê o próprio percentual
            antes de se inscrever.
          </p>
          <div className="mt-5">
            <Button variant="gold" onClick={() => setEditando("nova")}>
              <Plus size={15} /> Publicar a primeira
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {vagas.map((v) => (
            <Card key={v.id} className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 p-5">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: v.logoCor }}
                >
                  <Briefcase size={19} />
                </span>

                <div className="min-w-[200px] flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-navy-700">
                    {v.titulo}
                    {v.ativa
                      ? <Badge tone="green">Aberta</Badge>
                      : <Badge tone="muted">Pausada</Badge>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <MapPin size={11} />
                    {v.cidade}/{v.uf} · {v.modelo} · {v.contrato}
                    {v.faixa ? ` · ${v.faixa}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => setVendo(v)}
                  className="flex items-center gap-2 rounded-xl bg-cream/70 px-4 py-2.5 transition hover:bg-cream"
                >
                  <Users size={15} className="text-gold-500" />
                  <span className="text-sm font-bold tabular-nums text-navy-700">{v.candidatos}</span>
                  <span className="text-xs text-muted">candidato(s)</span>
                </button>

                <div className="flex gap-1.5">
                  <IconeAcao
                    titulo={v.ativa ? "Pausar a vaga" : "Reabrir a vaga"}
                    onClick={async () => { await alternarVaga(v.id, !v.ativa); await atualizar(); }}
                  >
                    {v.ativa ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconeAcao>
                  <IconeAcao titulo="Editar" onClick={() => setEditando(v)}>
                    <Pencil size={15} />
                  </IconeAcao>
                  <IconeAcao titulo="Ver no mural" onClick={() => window.open("/app/vagas", "_blank")}>
                    <ExternalLink size={15} />
                  </IconeAcao>
                  <IconeAcao titulo="Apagar" perigo onClick={() => setApagando(v)}>
                    <Trash2 size={15} />
                  </IconeAcao>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editando && (
        <ModalVaga
          vaga={editando === "nova" ? null : editando}
          empresaId={empresa.id}
          aoFechar={() => setEditando(null)}
          aoSalvar={atualizar}
        />
      )}

      {vendo && <ModalCandidatos vaga={vendo} aoFechar={() => setVendo(null)} />}

      {apagando && (
        <Modal
          titulo="Apagar esta vaga?"
          subtitulo="As candidaturas recebidas vão junto e não têm como voltar."
          largura="max-w-lg"
          aoFechar={() => setApagando(null)}
          rodape={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setApagando(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  const alvo = apagando;
                  setApagando(null);
                  const r = await apagarVaga(alvo.id);
                  if (!r.ok) setErro(r.erro ?? "");
                  await atualizar();
                }}
              >
                <Trash2 size={15} /> Apagar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink">
            <strong>{apagando.titulo}</strong> — {apagando.candidatos} candidatura(s).
            Se a ideia é só parar de receber currículo, use <strong>pausar</strong> no
            lugar: a vaga some do mural e o histórico continua.
          </p>
        </Modal>
      )}
    </div>
  );
}

function IconeAcao({
  children, titulo, onClick, perigo,
}: {
  children: React.ReactNode; titulo: string; onClick: () => void; perigo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={cn(
        "rounded-lg p-2 text-muted transition",
        perigo ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-navy-50 hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ formulário -- */

function ModalVaga({
  vaga, empresaId, aoFechar, aoSalvar,
}: {
  vaga: VagaAdmin | null;
  empresaId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [f, setF] = useState({
    titulo: vaga?.titulo ?? "",
    descricao: vaga?.descricao ?? "",
    cidade: vaga?.cidade ?? "",
    uf: vaga?.uf ?? "",
    modelo: vaga?.modelo ?? MODELOS[0],
    contrato: vaga?.contrato ?? CONTRATOS[0],
    faixa: vaga?.faixa ?? "",
    senioridade: vaga?.senioridade ?? SENIORIDADES[2],
    requisitos: (vaga?.requisitos ?? []).join("\n"),
    ativa: vaga?.ativa ?? true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));

  async function salvar() {
    setErro("");
    setSalvando(true);
    const r = await salvarVaga({
      id: vaga?.id,
      empresaId,
      titulo: f.titulo,
      descricao: f.descricao,
      cidade: f.cidade,
      uf: f.uf,
      modelo: f.modelo,
      contrato: f.contrato,
      faixa: f.faixa,
      senioridade: f.senioridade,
      requisitos: f.requisitos.split("\n").map((x) => x.trim()).filter(Boolean),
      // As exigências por curso/trilha continuam com o administrador da
      // Academy: é ele que conhece o catálogo inteiro e evita a vaga que pede
      // uma trilha que não existe.
      cursosDesejados: vaga?.cursosDesejados ?? [],
      trilhasDesejadas: vaga?.trilhasDesejadas ?? [],
      ativa: f.ativa,
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui salvar.");
    await aoSalvar();
    aoFechar();
  }

  return (
    <Modal
      titulo={vaga ? "Editar vaga" : "Publicar vaga"}
      subtitulo="A vaga aparece no mural de toda a base assim que for salva como aberta."
      aoFechar={aoFechar}
      rodape={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 size={15} className="animate-spin" />}
            {vaga ? "Salvar" : "Publicar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {erro && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <Field label="Título da vaga">
          <input
            value={f.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            placeholder="Analista fiscal pleno"
            className={inputCls}
          />
        </Field>

        <Field label="Descrição" hint="O que a pessoa vai fazer no dia a dia.">
          <textarea
            value={f.descricao}
            onChange={(e) => set({ descricao: e.target.value })}
            rows={4}
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
          <Field label="Cidade">
            <input value={f.cidade} onChange={(e) => set({ cidade: e.target.value })} className={inputCls} />
          </Field>
          <Field label="UF">
            <input
              value={f.uf}
              onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })}
              className={cn(inputCls, "text-center uppercase")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Modelo">
            <select value={f.modelo} onChange={(e) => set({ modelo: e.target.value })} className={inputCls}>
              {MODELOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Contrato">
            <select value={f.contrato} onChange={(e) => set({ contrato: e.target.value })} className={inputCls}>
              {CONTRATOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Senioridade">
            <select value={f.senioridade} onChange={(e) => set({ senioridade: e.target.value })} className={inputCls}>
              {SENIORIDADES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Faixa salarial" hint="Opcional, mas vaga com faixa recebe mais candidatura qualificada.">
          <input
            value={f.faixa}
            onChange={(e) => set({ faixa: e.target.value })}
            placeholder="R$ 4.500 a R$ 6.000"
            className={inputCls}
          />
        </Field>

        <Field label="Requisitos" hint="Um por linha.">
          <textarea
            value={f.requisitos}
            onChange={(e) => set({ requisitos: e.target.value })}
            rows={4}
            placeholder={"Experiência com SPED Fiscal\nConhecimento de CT-e\nCRC ativo"}
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-100 bg-cream/50 p-4">
          <input
            type="checkbox"
            checked={f.ativa}
            onChange={(e) => set({ ativa: e.target.checked })}
            className="h-4 w-4 accent-gold-500"
          />
          <span className="text-sm font-semibold text-navy-700">
            Vaga aberta — visível no mural e recebendo candidaturas
          </span>
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ candidatos -- */

function ModalCandidatos({ vaga, aoFechar }: { vaga: VagaAdmin; aoFechar: () => void }) {
  const [lista, setLista] = useState<Candidato[] | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarCandidatos(vaga.id).then((c) => { if (ativo) setLista(c); });
    return () => { ativo = false; };
  }, [vaga.id]);

  async function mudar(id: string, status: string) {
    await definirStatusCandidatura(id, status);
    setLista((l) => l?.map((c) => (c.candidaturaId === id ? { ...c, status } : c)) ?? null);
  }

  return (
    <Modal
      titulo={`Candidatos — ${vaga.titulo}`}
      subtitulo="Os certificados listados foram emitidos aqui e têm código público de validação."
      largura="max-w-3xl"
      aoFechar={aoFechar}
    >
      {lista === null ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      ) : lista.length === 0 ? (
        <div className="py-8 text-center">
          <Users size={24} className="mx-auto text-navy-300" />
          <p className="mt-2.5 text-sm font-semibold text-navy-700">
            Ninguém se candidatou ainda
          </p>
          <p className="mt-1 text-xs text-muted">
            Vagas com faixa salarial e requisitos claros recebem mais candidatura.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((c) => (
            <div key={c.candidaturaId} className="rounded-xl border border-navy-100 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar nome={c.perfil.nome} size={40} />
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-bold text-navy-700">{c.perfil.nome}</p>
                  <p className="text-xs text-muted">
                    {c.perfil.cargo ?? "Sem cargo"}
                    {c.perfil.cidade ? ` · ${c.perfil.cidade}/${c.perfil.uf}` : ""}
                    {c.perfil.senioridade ? ` · ${c.perfil.senioridade}` : ""}
                  </p>
                </div>
                <select
                  value={c.status}
                  onChange={(e) => void mudar(c.candidaturaId, e.target.value)}
                  className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 outline-none focus:border-gold-400"
                >
                  {STATUS.map((s) => <option key={s.v} value={s.v}>{s.rotulo}</option>)}
                </select>
              </div>

              {c.mensagem && (
                <p className="mt-3 rounded-lg bg-cream/60 px-3 py-2 text-xs leading-relaxed text-ink">
                  “{c.mensagem}”
                </p>
              )}

              {(c.certificados.length > 0 || c.trilhas.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.trilhas.map((t) => (
                    <Badge key={t.trilhaSlug} tone="teal">{t.trilhaNome}</Badge>
                  ))}
                  {c.certificados.map((x) => (
                    <Badge key={x.cursoSlug} tone="navy">{x.cursoTitulo}</Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button href={`/app/talentos/${c.perfil.id}`} target="_blank" variant="ghost" size="sm">
                  Ver perfil completo <ExternalLink size={13} />
                </Button>
                <Button href={`mailto:${c.perfil.email}`} variant="ghost" size="sm">
                  <Mail size={13} /> Escrever
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
