"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility, AlertCircle, Award, BarChart3, Briefcase, ExternalLink, Eye,
  EyeOff, FileText, Loader2, Mail, MapPin, MessageSquare, MoveHorizontal,
  Pencil, Phone, Plus, ShieldCheck, Trash2, Users,
} from "lucide-react";
import {
  Avatar, Badge, Button, Card, Field, abaCls, abasCls, cn, inputCls,
} from "@/components/ui";
import { Modal } from "@/components/modal";
import { Barras, Funil } from "@/components/graficos";
import {
  ESCOLARIDADES, ETAPAS, GRUPOS_AFIRMATIVOS, JORNADAS,
  alternarVaga, apagarVaga, candidaturasDaEmpresa, carregarCandidatos,
  carregarVagasDaEmpresa, definirNotaInterna, definirStatusCandidatura,
  diversidadeDaVaga, marcarCandidaturaVista, salvarVaga,
  type Candidato, type DiversidadeDaVaga, type VagaAdmin,
} from "@/lib/repo-vagas";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   MINHAS VAGAS

   Três perguntas, três abas — nessa ordem, que é a ordem em que o gestor
   pergunta:

   · Vagas        — o que está publicado, e onde cada funil está parado.
   · Candidaturas — quem chegou, o que a pessoa certificou aqui, e o que fazer
                    com ela agora.
   · Estatísticas — a vaga está recebendo? em quanto tempo respondemos? o que
                    a base tem de formação?

   Sobre os filtros que a empresa pediu: NÃO existe filtro de idade nem de cor
   sobre candidato. A Lei 9.029/1995 proíbe prática discriminatória no acesso
   ao emprego por sexo, origem, raça, cor, estado civil, situação familiar,
   deficiência e idade — e as plataformas grandes também não oferecem isso. O
   caminho legal, que é o que está implementado aqui, é outro: a vaga pode ser
   afirmativa ou de cota PCD, o requisito pode ser objetivo (experiência,
   escolaridade, jornada) e a diversidade aparece agregada, nunca por pessoa.
   ========================================================================== */

const MODELOS = ["Presencial", "Híbrido", "Remoto"];
const CONTRATOS = ["CLT", "PJ", "Estágio", "Freelance"];
const SENIORIDADES = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];
const AREAS = ["Fiscal", "Tributário", "Contábil", "Pessoal", "Comex", "Gestão"];

const TOM_ETAPA: Record<string, "muted" | "navy" | "gold" | "green" | "red"> = {
  enviada: "muted",
  em_analise: "navy",
  entrevista: "gold",
  aprovada: "green",
  recusada: "red",
};

const rotuloEtapa = (v: string) =>
  ETAPAS.find((e) => e.v === v)?.rotulo ?? v;

const dia = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

type Aba = "vagas" | "candidaturas" | "estatisticas";

export default function VagasDaEmpresa() {
  const { empresa } = useEmpresa();
  const [aba, setAba] = useState<Aba>("vagas");
  const [vagas, setVagas] = useState<VagaAdmin[]>([]);
  const [candidaturas, setCandidaturas] = useState<
    Array<{ id: string; vagaId: string; status: string; criadaEm: string; vistaEm?: string }>
  >([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<VagaAdmin | "nova" | null>(null);
  const [vendo, setVendo] = useState<VagaAdmin | null>(null);
  const [apagando, setApagando] = useState<VagaAdmin | null>(null);

  const atualizar = useCallback(async () => {
    setErro("");
    // Perguntar pela empresa, e não filtrar o mural no cliente: a vaga pausada
    // sai do mural público e desaparecia justamente da tela de quem ia reabrir.
    const [r, cands] = await Promise.all([
      carregarVagasDaEmpresa(empresa.id),
      candidaturasDaEmpresa(empresa.id),
    ]);
    setVagas(r.vagas);
    setCandidaturas(cands);
    if (r.erro) setErro(r.erro);
    setCarregando(false);
  }, [empresa.id]);

  useEffect(() => { void atualizar(); }, [atualizar]);

  const porVaga = useMemo(() => {
    const m = new Map<string, typeof candidaturas>();
    for (const c of candidaturas) {
      const lista = m.get(c.vagaId) ?? [];
      lista.push(c);
      m.set(c.vagaId, lista);
    }
    return m;
  }, [candidaturas]);

  const abertas = vagas.filter((v) => v.ativa).length;
  const seteDias = Date.now() - 7 * 86400000;
  const novas7d = candidaturas.filter((c) => new Date(c.criadaEm).getTime() > seteDias).length;
  const naoVistas = candidaturas.filter((c) => !c.vistaEm).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-gold-500">Contratar</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Minhas vagas</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            {vagas.length === 0
              ? "Publique uma vaga e ela aparece para toda a base — com o cruzamento automático entre o que você pede e o que cada pessoa já certificou aqui."
              : "Cada candidatura traz os certificados emitidos na Academy, com código público de validação."}
          </p>
        </div>
        <Button variant="gold" onClick={() => setEditando("nova")} className="w-full sm:w-auto">
          <Plus size={16} /> Publicar vaga
        </Button>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Numero rotulo="Vagas abertas" valor={abertas} nota={`${vagas.length} publicada(s)`} />
        <Numero rotulo="Candidaturas" valor={candidaturas.length} nota="no total" />
        <Numero rotulo="Novas" valor={novas7d} nota="últimos 7 dias" destaque={novas7d > 0} />
        <Numero
          rotulo="Sem abrir"
          valor={naoVistas}
          nota="fichas ainda não vistas"
          destaque={naoVistas > 0}
        />
      </div>

      <div className={abasCls}>
        {([
          ["vagas", "Vagas", <Briefcase key="i" size={15} />],
          ["candidaturas", "Candidaturas", <Users key="i" size={15} />],
          ["estatisticas", "Estatísticas", <BarChart3 key="i" size={15} />],
        ] as const).map(([k, rotulo, icone]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={cn(
              abaCls,
              aba === k
                ? "border-b-2 border-gold-400 text-navy-700"
                : "text-muted hover:text-navy-700"
            )}
          >
            {icone} {rotulo}
            {k === "candidaturas" && naoVistas > 0 && (
              <span className="ml-1 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy-800">
                {naoVistas}
              </span>
            )}
          </button>
        ))}
      </div>

      {carregando ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p></Card>
      ) : aba === "vagas" ? (
        <ListaDeVagas
          vagas={vagas}
          porVaga={porVaga}
          aoEditar={setEditando}
          aoVerCandidatos={setVendo}
          aoApagar={setApagando}
          aoAlternar={async (v) => { await alternarVaga(v.id, !v.ativa); await atualizar(); }}
          aoPublicar={() => setEditando("nova")}
        />
      ) : aba === "candidaturas" ? (
        <PainelCandidaturas vagas={vagas} aoAtualizar={atualizar} />
      ) : (
        <Estatisticas vagas={vagas} candidaturas={candidaturas} />
      )}

      {editando && (
        <ModalVaga
          vaga={editando === "nova" ? null : editando}
          empresaId={empresa.id}
          aoFechar={() => setEditando(null)}
          aoSalvar={atualizar}
        />
      )}

      {vendo && (
        <ModalCandidatos
          vaga={vendo}
          aoFechar={() => { setVendo(null); void atualizar(); }}
        />
      )}

      {apagando && (
        <Modal
          titulo="Apagar esta vaga?"
          subtitulo="As candidaturas recebidas vão junto e não têm como voltar."
          largura="max-w-lg"
          aoFechar={() => setApagando(null)}
          rodape={
            <div className="flex flex-wrap justify-end gap-2">
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
          <p className="text-sm leading-relaxed text-ink">
            <strong>{apagando.titulo}</strong> —{" "}
            {(porVaga.get(apagando.id) ?? []).length} candidatura(s). Se a ideia é só
            parar de receber currículo, use <strong>pausar</strong> no lugar: a vaga sai
            do mural e o histórico continua aqui.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- números -- */
function Numero({
  rotulo, valor, nota, destaque,
}: {
  rotulo: string; valor: number; nota?: string; destaque?: boolean;
}) {
  return (
    <Card className={cn("!p-3.5 sm:!p-4", destaque && "!border-gold-300 !bg-gold-50/50")}>
      <p className="text-xl font-bold tabular-nums text-navy-700 sm:text-2xl">{valor}</p>
      <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-navy-600">
        {rotulo}
      </p>
      {nota && <p className="mt-0.5 text-[11px] leading-snug text-muted">{nota}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------- aba: vagas --- */
function ListaDeVagas({
  vagas, porVaga, aoEditar, aoVerCandidatos, aoApagar, aoAlternar, aoPublicar,
}: {
  vagas: VagaAdmin[];
  porVaga: Map<string, Array<{ status: string; vistaEm?: string }>>;
  aoEditar: (v: VagaAdmin) => void;
  aoVerCandidatos: (v: VagaAdmin) => void;
  aoApagar: (v: VagaAdmin) => void;
  aoAlternar: (v: VagaAdmin) => Promise<void>;
  aoPublicar: () => void;
}) {
  if (vagas.length === 0) {
    return (
      <Card className="py-12 text-center">
        <Briefcase size={26} className="mx-auto text-navy-300" />
        <p className="mt-3 font-semibold text-navy-700">Nenhuma vaga publicada</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          Ao exigir uma trilha ou um curso da Academy, a plataforma calcula a
          compatibilidade de cada candidato — e o candidato vê o próprio percentual
          antes de se inscrever.
        </p>
        <div className="mt-5">
          <Button variant="gold" onClick={aoPublicar}>
            <Plus size={15} /> Publicar a primeira
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {vagas.map((v) => {
        const cands = porVaga.get(v.id) ?? [];
        const naoVistas = cands.filter((c) => !c.vistaEm).length;
        return (
          <Card key={v.id} className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: v.logoCor }}
              >
                <Briefcase size={19} />
              </span>

              <div className="min-w-[180px] flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold leading-snug text-navy-700">
                  {v.titulo}
                  {v.area && <Badge tone="navy">{v.area}</Badge>}
                  {v.ativa ? <Badge tone="green">Aberta</Badge> : <Badge tone="muted">Pausada</Badge>}
                  {v.sigilosa && <Badge tone="muted">Sigilosa</Badge>}
                  {v.pcd && (
                    <Badge tone="teal">
                      <Accessibility size={11} /> PCD
                    </Badge>
                  )}
                  {v.afirmativaPara.map((g) => (
                    <Badge key={g} tone="gold">{g}</Badge>
                  ))}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs leading-snug text-muted">
                  <MapPin size={11} className="shrink-0" />
                  {v.cidade}/{v.uf} · {v.modelo} · {v.contrato}
                  {v.faixa ? ` · ${v.faixa}` : ""}
                </p>

                {/* Onde o funil está parado, sem abrir a vaga. */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cands.length === 0 ? (
                    <span className="text-[11px] text-muted">Nenhuma candidatura ainda</span>
                  ) : (
                    ETAPAS.map((e) => {
                      const n = cands.filter((c) => c.status === e.v).length;
                      if (n === 0) return null;
                      return (
                        <Badge key={e.v} tone={TOM_ETAPA[e.v]}>
                          {n} {e.rotulo.toLowerCase()}
                        </Badge>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={() => aoVerCandidatos(v)}
                className="flex items-center gap-2 rounded-xl bg-cream/70 px-4 py-2.5 transition hover:bg-cream"
              >
                <Users size={15} className="text-gold-500" />
                <span className="text-sm font-bold tabular-nums text-navy-700">{cands.length}</span>
                <span className="text-xs text-muted">candidato(s)</span>
                {naoVistas > 0 && (
                  <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy-800">
                    {naoVistas} novo(s)
                  </span>
                )}
              </button>

              <div className="flex gap-1.5">
                <IconeAcao
                  titulo={v.ativa ? "Pausar a vaga" : "Reabrir a vaga"}
                  onClick={() => void aoAlternar(v)}
                >
                  {v.ativa ? <EyeOff size={15} /> : <Eye size={15} />}
                </IconeAcao>
                <IconeAcao titulo="Editar" onClick={() => aoEditar(v)}>
                  <Pencil size={15} />
                </IconeAcao>
                <IconeAcao titulo="Ver no mural" onClick={() => window.open("/app/vagas", "_blank")}>
                  <ExternalLink size={15} />
                </IconeAcao>
                <IconeAcao titulo="Apagar" perigo onClick={() => aoApagar(v)}>
                  <Trash2 size={15} />
                </IconeAcao>
              </div>
            </div>
          </Card>
        );
      })}
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

/* --------------------------------------------------- aba: candidaturas --- */
/**
 * Todas as candidaturas da casa numa tela.
 *
 * Antes só existia o modal por vaga: para saber quem chegou hoje, o gestor
 * abria vaga por vaga. Aqui ele filtra por vaga e por etapa, e a ficha abre ao
 * lado sem perder a lista.
 */
function PainelCandidaturas({
  vagas, aoAtualizar,
}: {
  vagas: VagaAdmin[];
  aoAtualizar: () => Promise<void>;
}) {
  const [vagaId, setVagaId] = useState<string>(vagas[0]?.id ?? "");
  const [etapa, setEtapa] = useState<string>("");
  const [lista, setLista] = useState<Candidato[] | null>(null);
  const [aberto, setAberto] = useState<Candidato | null>(null);

  const carregar = useCallback(async () => {
    if (!vagaId) return setLista([]);
    setLista(null);
    setLista(await carregarCandidatos(vagaId));
  }, [vagaId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const filtrada = (lista ?? []).filter((c) => !etapa || c.status === etapa);

  if (vagas.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        Publique uma vaga para começar a receber candidaturas.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="!p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={vagaId}
            onChange={(e) => setVagaId(e.target.value)}
            className={cn(inputCls, "w-full sm:w-auto sm:min-w-[16rem]")}
            aria-label="Vaga"
          >
            {vagas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo}{v.ativa ? "" : " (pausada)"}
              </option>
            ))}
          </select>

          <div className="fileira flex gap-1.5 overflow-x-auto">
            <Chip ativo={!etapa} onClick={() => setEtapa("")}>Todas</Chip>
            {ETAPAS.map((e) => (
              <Chip key={e.v} ativo={etapa === e.v} onClick={() => setEtapa(e.v)}>
                {e.rotulo}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {lista === null ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando candidatos…
        </p></Card>
      ) : filtrada.length === 0 ? (
        <Card className="py-10 text-center">
          <Users size={24} className="mx-auto text-navy-300" />
          <p className="mt-2.5 text-sm font-semibold text-navy-700">
            {(lista ?? []).length === 0
              ? "Ninguém se candidatou a esta vaga ainda"
              : "Nenhum candidato nesta etapa"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Vagas com faixa salarial, benefícios e requisitos claros recebem mais
            candidatura — e as que exigem uma trilha da Academy recebem gente já
            formada no assunto.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrada.map((c) => (
            <LinhaCandidato
              key={c.candidaturaId}
              c={c}
              aoAbrir={async () => {
                setAberto(c);
                if (!c.vistaEm) {
                  await marcarCandidaturaVista(c.candidaturaId);
                  await aoAtualizar();
                }
              }}
              aoMudarEtapa={async (status) => {
                await definirStatusCandidatura(c.candidaturaId, status);
                setLista((l) =>
                  l?.map((x) => (x.candidaturaId === c.candidaturaId ? { ...x, status } : x)) ?? null
                );
                await aoAtualizar();
              }}
            />
          ))}
        </div>
      )}

      {aberto && (
        <FichaDoCandidato
          c={aberto}
          vaga={vagas.find((v) => v.id === vagaId)}
          aoFechar={() => setAberto(null)}
          aoSalvarNota={async (nota) => {
            await definirNotaInterna(aberto.candidaturaId, nota);
            setLista((l) =>
              l?.map((x) =>
                x.candidaturaId === aberto.candidaturaId ? { ...x, notaInterna: nota } : x
              ) ?? null
            );
          }}
          aoMudarEtapa={async (status) => {
            await definirStatusCandidatura(aberto.candidaturaId, status);
            setLista((l) =>
              l?.map((x) =>
                x.candidaturaId === aberto.candidaturaId ? { ...x, status } : x
              ) ?? null
            );
            setAberto({ ...aberto, status });
            await aoAtualizar();
          }}
        />
      )}
    </div>
  );
}

function Chip({
  children, ativo, onClick,
}: {
  children: React.ReactNode; ativo?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-600"
          : "border-navy-100 bg-white text-muted hover:border-navy-200"
      )}
    >
      {children}
    </button>
  );
}

function LinhaCandidato({
  c, aoAbrir, aoMudarEtapa,
}: {
  c: Candidato;
  aoAbrir: () => Promise<void>;
  aoMudarEtapa: (status: string) => Promise<void>;
}) {
  return (
    <Card className={cn("!p-4", !c.vistaEm && "!border-gold-200 !bg-gold-50/30")}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar nome={c.perfil.nome} size={42} />
        <div className="min-w-[180px] flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold leading-snug text-navy-700">
            {c.perfil.nome}
            {!c.vistaEm && <Badge tone="gold">Nova</Badge>}
            {c.perfil.crc && <Badge tone="teal">CRC</Badge>}
          </p>
          <p className="text-xs leading-snug text-muted">
            {c.perfil.cargo ?? "Sem cargo"}
            {c.perfil.cidade ? ` · ${c.perfil.cidade}/${c.perfil.uf}` : ""}
            {c.perfil.senioridade ? ` · ${c.perfil.senioridade}` : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Candidatou-se em {dia(c.criadaEm)} · {c.certificados.length} certificado(s) ·{" "}
            {c.trilhas.length} trilha(s)
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={c.status}
            onChange={(e) => void aoMudarEtapa(e.target.value)}
            className="min-w-[calc(50%-0.25rem)] flex-1 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 outline-none focus:border-gold-400 sm:min-w-0 sm:flex-none"
          >
            {ETAPAS.map((e) => <option key={e.v} value={e.v}>{e.rotulo}</option>)}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void aoAbrir()}
            className="min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none"
          >
            <FileText size={13} /> Ver ficha
          </Button>
        </div>
      </div>

      {(c.trilhas.length > 0 || c.certificados.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.trilhas.map((t) => <Badge key={t.trilhaSlug} tone="teal">{t.trilhaNome}</Badge>)}
          {c.certificados.slice(0, 4).map((x) => (
            <Badge key={x.cursoSlug} tone="navy">{x.cursoTitulo}</Badge>
          ))}
          {c.certificados.length > 4 && (
            <Badge tone="muted">+{c.certificados.length - 4}</Badge>
          )}
        </div>
      )}
    </Card>
  );
}

function FichaDoCandidato({
  c, vaga, aoFechar, aoSalvarNota, aoMudarEtapa,
}: {
  c: Candidato;
  vaga?: VagaAdmin;
  aoFechar: () => void;
  aoSalvarNota: (nota: string) => Promise<void>;
  aoMudarEtapa: (status: string) => Promise<void>;
}) {
  const [nota, setNota] = useState(c.notaInterna ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  return (
    <Modal
      titulo={c.perfil.nome}
      subtitulo={vaga ? `Candidatura para ${vaga.titulo}` : undefined}
      largura="max-w-3xl"
      aoFechar={aoFechar}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            value={c.status}
            onChange={(e) => void aoMudarEtapa(e.target.value)}
            className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 outline-none focus:border-gold-400"
          >
            {ETAPAS.map((e) => <option key={e.v} value={e.v}>{e.rotulo}</option>)}
          </select>
          <Button variant="ghost" onClick={aoFechar}>Fechar</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar nome={c.perfil.nome} size={52} />
          <div className="min-w-[180px] flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy-700">
              {c.perfil.cargo ?? "Sem cargo"}
              <Badge tone={TOM_ETAPA[c.status]}>{rotuloEtapa(c.status)}</Badge>
            </p>
            <p className="text-xs leading-snug text-muted">
              {[c.perfil.cidade && `${c.perfil.cidade}/${c.perfil.uf}`, c.perfil.senioridade,
                c.perfil.crc && `CRC ${c.perfil.crc}`, c.perfil.pretensao]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href={`mailto:${c.perfil.email}`} variant="outline" size="sm">
              <Mail size={13} /> E-mail
            </Button>
            {c.perfil.telefone && (
              <Button href={`tel:${c.perfil.telefone}`} variant="outline" size="sm">
                <Phone size={13} /> Ligar
              </Button>
            )}
            <Button href={`/empresa/talentos/${c.perfil.id}`} variant="ghost" size="sm">
              Perfil completo <ExternalLink size={13} />
            </Button>
          </div>
        </div>

        {c.perfil.bio && (
          <p className="rounded-xl bg-cream/60 px-4 py-3 text-sm leading-relaxed text-ink">
            {c.perfil.bio}
          </p>
        )}

        {c.mensagem && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
              O que a pessoa escreveu
            </p>
            <p className="mt-1.5 rounded-xl border border-navy-100 px-4 py-3 text-sm leading-relaxed text-ink">
              “{c.mensagem}”
            </p>
          </div>
        )}

        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
            <Award size={13} className="text-gold-500" /> Formação verificada na Academy
          </p>
          {c.trilhas.length === 0 && c.certificados.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              Ainda não concluiu curso na plataforma.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.trilhas.map((t) => <Badge key={t.trilhaSlug} tone="teal">{t.trilhaNome}</Badge>)}
              {c.certificados.map((x) => (
                <Badge key={x.cursoSlug} tone="navy">{x.cursoTitulo}</Badge>
              ))}
            </div>
          )}
        </div>

        {(c.perfil.habilidades ?? []).length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-navy-600">Habilidades</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(c.perfil.habilidades ?? []).map((h) => (
                <span
                  key={h}
                  className="rounded-md bg-cream px-2 py-0.5 text-[11px] font-medium text-navy-600"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* A anotação é da empresa. O candidato nunca vê — e o banco recusa a
            escrita para qualquer sessão que não seja da empresa da vaga. */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
            <MessageSquare size={13} className="text-gold-500" /> Anotação interna
          </p>
          <textarea
            value={nota}
            onChange={(e) => { setNota(e.target.value); setSalvo(false); }}
            rows={3}
            placeholder="O que ficou da conversa, o combinado, o que confirmar na próxima etapa."
            className={cn(inputCls, "mt-2 resize-none")}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={salvando}
              onClick={async () => {
                setSalvando(true);
                await aoSalvarNota(nota);
                setSalvando(false);
                setSalvo(true);
              }}
            >
              {salvando ? "Salvando…" : "Salvar anotação"}
            </Button>
            {salvo && <span className="text-xs font-semibold text-emerald-600">Salvo</span>}
            <span className="text-xs text-muted">Visível só para a sua equipe.</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------- aba: estatísticas --- */
function Estatisticas({
  vagas, candidaturas,
}: {
  vagas: VagaAdmin[];
  candidaturas: Array<{ vagaId: string; status: string; criadaEm: string; vistaEm?: string }>;
}) {
  const [vagaId, setVagaId] = useState<string>("");
  const [div, setDiv] = useState<DiversidadeDaVaga | null>(null);

  const alvo = vagaId
    ? candidaturas.filter((c) => c.vagaId === vagaId)
    : candidaturas;

  useEffect(() => {
    if (!vagaId) return setDiv(null);
    let vivo = true;
    diversidadeDaVaga(vagaId).then((d) => { if (vivo) setDiv(d); });
    return () => { vivo = false; };
  }, [vagaId]);

  // Funil: cada etapa conta quem chegou *até ali*, e não quem parou nela — é o
  // que responde "onde a gente perde gente". A recusada entra só no topo: o
  // banco guarda o status atual, não a etapa em que a recusa aconteceu.
  const ordem = ["enviada", "em_analise", "entrevista", "aprovada"];
  const funil = ordem.map((etapa, i) => ({
    rotulo: rotuloEtapa(etapa),
    valor: alvo.filter(
      (c) => ordem.indexOf(c.status) >= i || (c.status === "recusada" && i === 0)
    ).length,
  }));

  // Últimos 14 dias
  const hoje = new Date();
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(hoje.getTime() - (13 - i) * 86400000);
    const iso = d.toISOString().slice(0, 10);
    return {
      rotulo: `${d.getDate()}`,
      valor: alvo.filter((c) => c.criadaEm.slice(0, 10) === iso).length,
    };
  });

  const vistas = alvo.filter((c) => c.vistaEm);
  const horasAteVer =
    vistas.length === 0
      ? null
      : vistas.reduce(
          (a, c) =>
            a + (new Date(c.vistaEm!).getTime() - new Date(c.criadaEm).getTime()) / 3600000,
          0
        ) / vistas.length;

  const recusadas = alvo.filter((c) => c.status === "recusada").length;
  const aprovadas = alvo.filter((c) => c.status === "aprovada").length;

  return (
    <div className="space-y-4">
      <Card className="!p-3.5">
        <select
          value={vagaId}
          onChange={(e) => setVagaId(e.target.value)}
          className={cn(inputCls, "w-full sm:w-auto sm:min-w-[18rem]")}
          aria-label="Recorte"
        >
          <option value="">Todas as vagas</option>
          {vagas.map((v) => (
            <option key={v.id} value={v.id}>{v.titulo}</option>
          ))}
        </select>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Numero rotulo="Candidaturas" valor={alvo.length} nota={vagaId ? "nesta vaga" : "em todas"} />
        <Numero rotulo="Aprovadas" valor={aprovadas} nota="chegaram ao fim" />
        <Numero rotulo="Recusadas" valor={recusadas} nota="com devolutiva registrada" />
        <Card className="!p-3.5 sm:!p-4">
          <p className="text-xl font-bold tabular-nums text-navy-700 sm:text-2xl">
            {horasAteVer === null ? "—" : horasAteVer < 24
              ? `${Math.round(horasAteVer)}h`
              : `${(horasAteVer / 24).toFixed(1)}d`}
          </p>
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-navy-600">
            Até a 1ª leitura
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            tempo médio para abrir a ficha
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="!p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy-600">
            Funil da candidatura
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            Quantos chegaram a cada etapa — a queda entre duas linhas é onde o processo
            trava. Quem foi recusado conta no topo.
          </p>
          <div className="mt-4">
            {alvo.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Sem candidaturas no recorte.</p>
            ) : (
              <Funil etapas={funil} />
            )}
          </div>
        </Card>

        <Card className="!p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy-600">
            Candidaturas por dia
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Últimos 14 dias</p>
          <div className="mt-4">
            <Barras
              rotulos={dias.map((d) => d.rotulo)}
              valores={dias.map((d) => d.valor)}
              altura={180}
            />
          </div>
        </Card>
      </div>

      {/* Representatividade: contagem, nunca pessoa, e só a partir de cinco
          declarações. Abaixo disso o número identificaria quem declarou. */}
      <Card className="!p-4">
        <h2 className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
          <ShieldCheck size={13} className="text-gold-500" /> Representatividade das candidaturas
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Autodeclaração é opcional (LGPD) e aparece só somada. A plataforma não
          permite filtrar candidato por cor, gênero ou idade — a Lei 9.029/1995 proíbe.
          O que a empresa pode fazer é publicar vaga afirmativa ou de cota PCD.
        </p>

        {!vagaId ? (
          <p className="mt-4 text-sm text-muted">
            Escolha uma vaga acima para ver a representatividade dela.
          </p>
        ) : !div ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Somando…
          </p>
        ) : !div.disponivel ? (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {div.declaradas} pessoa(s) declararam nesta vaga. O quadro abre a partir de{" "}
            {div.minimo ?? 5} — com menos que isso, a contagem identificaria quem declarou.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Grupo titulo="PCD" dados={{ "Declararam PCD": div.pcd ?? 0 }} />
            <Grupo titulo="Gênero" dados={div.genero ?? {}} />
            <Grupo titulo="Raça/cor" dados={div.racaCor ?? {}} />
          </div>
        )}
      </Card>
    </div>
  );
}

function Grupo({ titulo, dados }: { titulo: string; dados: Record<string, number> }) {
  const itens = Object.entries(dados);
  const total = itens.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <div className="rounded-xl border border-navy-100 bg-cream/40 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-navy-600">{titulo}</p>
      {itens.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Sem declaração</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {itens.map(([k, n]) => (
            <div key={k}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                <span className="min-w-0 leading-snug text-ink">{k}</span>
                <span className="shrink-0 font-semibold tabular-nums text-navy-700">{n}</span>
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-navy-100">
                <div
                  className="gold-gradient h-full rounded-full"
                  style={{ width: `${(n / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    area: vaga?.area ?? "",
    requisitos: (vaga?.requisitos ?? []).join("\n"),
    ativa: vaga?.ativa ?? true,
    beneficios: (vaga?.beneficios ?? []).join(", "),
    jornada: vaga?.jornada ?? "",
    escolaridade: vaga?.escolaridade ?? "",
    experiencia: vaga?.experienciaMinAnos ?? 0,
    pcd: vaga?.pcd ?? false,
    afirmativaPara: vaga?.afirmativaPara ?? [],
    acessibilidade: vaga?.acessibilidade ?? "",
    sigilosa: vaga?.sigilosa ?? false,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));

  function alternarGrupo(g: string) {
    set({
      afirmativaPara: f.afirmativaPara.includes(g)
        ? f.afirmativaPara.filter((x) => x !== g)
        : [...f.afirmativaPara, g],
    });
  }

  async function salvar() {
    setErro("");
    if (!f.titulo.trim()) return setErro("Informe o título da vaga.");
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
      area: f.area,
      requisitos: f.requisitos.split("\n").map((x) => x.trim()).filter(Boolean),
      // As exigências por curso/trilha continuam com o administrador da
      // Academy: é ele que conhece o catálogo inteiro e evita a vaga que pede
      // uma trilha que não existe.
      cursosDesejados: vaga?.cursosDesejados ?? [],
      trilhasDesejadas: vaga?.trilhasDesejadas ?? [],
      ativa: f.ativa,
      beneficios: f.beneficios.split(",").map((x) => x.trim()).filter(Boolean),
      jornada: f.jornada,
      escolaridade: f.escolaridade,
      experienciaMinAnos: f.experiencia > 0 ? f.experiencia : null,
      pcd: f.pcd,
      afirmativaPara: f.afirmativaPara,
      acessibilidade: f.acessibilidade,
      sigilosa: f.sigilosa,
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 size={15} className="animate-spin" />}
            {vaga ? "Salvar" : "Publicar"}
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
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Modelo">
            <select value={f.modelo} onChange={(e) => set({ modelo: e.target.value })} className={inputCls}>
              {MODELOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Contrato">
            <select value={f.contrato} onChange={(e) => set({ contrato: e.target.value })} className={inputCls}>
              {CONTRATOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Senioridade">
            <select
              value={f.senioridade}
              onChange={(e) => set({ senioridade: e.target.value })}
              className={inputCls}
            >
              {SENIORIDADES.map((sn) => <option key={sn} value={sn}>{sn}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Área" hint="Deixe em branco e a plataforma deduz.">
            <select value={f.area} onChange={(e) => set({ area: e.target.value })} className={inputCls}>
              <option value="">Deduzir</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Faixa salarial" hint="Vaga com faixa recebe mais candidatura.">
            <input
              value={f.faixa}
              onChange={(e) => set({ faixa: e.target.value })}
              placeholder="R$ 4.500 – R$ 6.000"
              className={inputCls}
            />
          </Field>
          <Field label="Jornada">
            <select value={f.jornada} onChange={(e) => set({ jornada: e.target.value })} className={inputCls}>
              <option value="">Não informar</option>
              {JORNADAS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Escolaridade mínima">
            <select
              value={f.escolaridade}
              onChange={(e) => set({ escolaridade: e.target.value })}
              className={inputCls}
            >
              <option value="">Não exigir</option>
              {ESCOLARIDADES.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
            </select>
          </Field>
          <Field
            label="Experiência mínima (anos)"
            hint="Requisito objetivo — é o que substitui, legalmente, o “filtro de idade”."
          >
            <input
              type="number"
              min={0}
              max={40}
              value={f.experiencia}
              onChange={(e) => set({ experiencia: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Benefícios" hint="Separados por vírgula: VA/VR, plano de saúde, PLR…">
          <input
            value={f.beneficios}
            onChange={(e) => set({ beneficios: e.target.value })}
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

        {/* ---------------------------------------------- ação afirmativa -- */}
        <div className="rounded-xl border border-teal/25 bg-teal/5 p-4">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal">
            <ShieldCheck size={13} /> Inclusão e acessibilidade
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink">
            Aqui não existe filtro de idade, cor ou gênero sobre candidato: a{" "}
            <strong>Lei 9.029/1995</strong> proíbe prática discriminatória no acesso ao
            emprego. O que é permitido — e é o que estas opções fazem — é declarar a
            vaga como afirmativa ou de cota, o que amplia o acesso em vez de restringi-lo.
          </p>

          <label className="mt-3.5 flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-white p-3.5">
            <input
              type="checkbox"
              checked={f.pcd}
              onChange={(e) => set({ pcd: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-gold-500"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                <Accessibility size={14} className="text-teal" /> Vaga reservada a PCD
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">
                Cota da Lei 8.213/1991, art. 93. A vaga recebe selo próprio no mural.
              </span>
            </span>
          </label>

          <p className="mt-3.5 text-xs font-semibold uppercase tracking-wide text-navy-600">
            Vaga afirmativa para
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GRUPOS_AFIRMATIVOS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => alternarGrupo(g)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  f.afirmativaPara.includes(g)
                    ? "border-gold-400 bg-gold-50 text-gold-600"
                    : "border-navy-100 bg-white text-muted hover:border-navy-200"
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="mt-3.5">
            <Field
              label="Acessibilidade do posto"
              hint="O que a pessoa precisa saber antes de se candidatar."
            >
              <textarea
                value={f.acessibilidade}
                onChange={(e) => set({ acessibilidade: e.target.value })}
                rows={2}
                placeholder="Escritório térreo, sanitário adaptado, leitor de tela disponível."
                className={cn(inputCls, "resize-none")}
              />
            </Field>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-cream/50 p-4">
          <input
            type="checkbox"
            checked={f.sigilosa}
            onChange={(e) => set({ sigilosa: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-gold-500"
          />
          <span className="min-w-0">
            <span className="text-sm font-semibold text-navy-700">Vaga sigilosa</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted">
              O mural mostra a vaga sem identificar a empresa. Útil para reposição de
              alguém que ainda está no cargo.
            </span>
          </span>
        </label>

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

/* ------------------------------------------------ candidatos de uma vaga -- */
function ModalCandidatos({ vaga, aoFechar }: { vaga: VagaAdmin; aoFechar: () => void }) {
  const [lista, setLista] = useState<Candidato[] | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarCandidatos(vaga.id).then((c) => { if (ativo) setLista(c); });
    return () => { ativo = false; };
  }, [vaga.id]);

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
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Se você esperava candidaturas aqui, confira se a vaga está{" "}
            <strong>aberta</strong> — vaga pausada sai do mural.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs text-muted sm:hidden">
            <MoveHorizontal size={13} className="text-gold-500" />
            Use a aba Candidaturas para filtrar por etapa
          </p>
          {lista.map((c) => (
            <div key={c.candidaturaId} className="rounded-xl border border-navy-100 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar nome={c.perfil.nome} size={40} />
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-bold leading-snug text-navy-700">{c.perfil.nome}</p>
                  <p className="text-xs leading-snug text-muted">
                    {c.perfil.cargo ?? "Sem cargo"}
                    {c.perfil.cidade ? ` · ${c.perfil.cidade}/${c.perfil.uf}` : ""}
                  </p>
                </div>
                <Badge tone={TOM_ETAPA[c.status]}>{rotuloEtapa(c.status)}</Badge>
              </div>

              {(c.trilhas.length > 0 || c.certificados.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.trilhas.map((t) => (
                    <Badge key={t.trilhaSlug} tone="teal">{t.trilhaNome}</Badge>
                  ))}
                  {c.certificados.map((x) => (
                    <Badge key={x.cursoSlug} tone="navy">{x.cursoTitulo}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
