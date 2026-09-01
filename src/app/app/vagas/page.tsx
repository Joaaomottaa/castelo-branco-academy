"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Accessibility, Briefcase, Building2, CheckCircle2, Clock, MapPin,
  Search, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, cn, inputCls } from "@/components/ui";
import {
  BarraDeFiltros, contarFiltros, filtrosVazios, type EstadoFiltros,
} from "@/components/filtros-vagas";
import { useDados } from "@/lib/dados";
import type { Vaga } from "@/lib/types";
import { useSession, type ResultadoCandidatura } from "@/lib/session";

export default function VagasPage() {
  const { candidaturas, candidatar } = useSession();
  const { vagas, cursos } = useDados();

  const [f, setF] = useState<EstadoFiltros>(filtrosVazios);
  const [selecionada, setSelecionada] = useState<string>("");

  const mudar = (patch: Partial<EstadoFiltros>) => setF((v) => ({ ...v, ...patch }));

  // As opções de empresa e localidade saem das próprias vagas: oferecer um
  // filtro que não casa com nada é gaveta vazia.
  const empresas = useMemo(
    () => [...new Set(vagas.map((v) => v.empresa))].sort(),
    [vagas]
  );
  const locais = useMemo(
    () => [...new Set(vagas.map((v) => `${v.cidade}/${v.uf}`))].filter((x) => x !== "/").sort(),
    [vagas]
  );

  const lista = useMemo(() => {
    const q = f.busca.trim().toLowerCase();
    const limite = f.dias ? Date.now() - f.dias * 86400000 : 0;

    const filtradas = vagas.filter((v) => {
      if (q) {
        const bate =
          v.titulo.toLowerCase().includes(q)
          || v.empresa.toLowerCase().includes(q)
          || (v.area ?? "").toLowerCase().includes(q)
          || v.requisitos.some((r) => r.toLowerCase().includes(q));
        if (!bate) return false;
      }
      if (f.areas.length && !f.areas.includes(v.area ?? "")) return false;
      if (f.modelos.length && !f.modelos.includes(v.modelo)) return false;
      if (f.contratos.length && !f.contratos.includes(v.contrato)) return false;
      if (f.senioridades.length && !f.senioridades.includes(v.senioridade)) return false;
      if (f.empresas.length && !f.empresas.includes(v.empresa)) return false;
      if (f.locais.length && !f.locais.includes(`${v.cidade}/${v.uf}`)) return false;
      if (limite && new Date(v.publicadaEm).getTime() < limite) return false;
      if (f.soAltoMatch && (v.match ?? 0) < 70) return false;
      if (f.soNaoCandidatadas && candidaturas.includes(v.id)) return false;
      return true;
    });

    return filtradas.sort((a, b) =>
      f.ordem === "recentes"
        ? new Date(b.publicadaEm).getTime() - new Date(a.publicadaEm).getTime()
        : (b.match ?? 0) - (a.match ?? 0)
    );
  }, [vagas, f, candidaturas]);

  const vaga = lista.find((v) => v.id === selecionada) ?? lista[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Vagas</h1>
          <p className="mt-1.5 text-sm text-muted">
            Oportunidades de empresas parceiras. O match considera suas certificações,
            habilidades e localização.
          </p>
        </div>
        <Button href="/empresa/vagas" variant="outline" className="w-full sm:w-auto">
          <Building2 size={15} /> Sou empresa: publicar vaga
        </Button>
      </div>

      {/* Filtros */}
      <Card className="space-y-3.5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={f.busca}
            onChange={(e) => mudar({ busca: e.target.value })}
            placeholder="Cargo, empresa, área ou requisito"
            className={inputCls + " pl-10"}
          />
        </div>
        <BarraDeFiltros
          f={f}
          aoMudar={mudar}
          empresas={empresas}
          locais={locais}
          total={lista.length}
        />
      </Card>

      {contarFiltros(f) > 0 && (
        <p className="-mt-2 text-xs text-muted">
          {lista.length === 0
            ? "Nenhuma vaga com esses filtros."
            : `${lista.length} vaga(s) de ${vagas.length} no mural.`}
        </p>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={34} />}
          title="Nenhuma vaga encontrada"
          description="Ajuste os filtros ou volte em alguns dias — novas vagas são publicadas toda semana."
          action={
            contarFiltros(f) > 0 ? (
              <Button variant="outline" onClick={() => setF(filtrosVazios)}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Lista */}
          <div className="space-y-3 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto lg:pr-1">
            {lista.map((v) => {
              const ativa = v.id === vaga?.id;
              const aplicada = candidaturas.includes(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelecionada(v.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    ativa
                      ? "border-gold-400 bg-white shadow-lg shadow-navy-700/5"
                      : "border-navy-100 bg-white hover:border-navy-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: v.logoCor }}
                    >
                      <Building2 size={17} />
                    </span>
                    {/* O nome da vaga é o que a pessoa lê para decidir se abre.
                        Numa linha só, dividindo espaço com o logo e o selo de
                        match, sobravam ~140px: "Analista Fiscal Pleno — Transp…".
                        Agora o nome quebra e usa quantas linhas precisar. */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug text-navy-700">{v.titulo}</p>
                      <p className="text-xs leading-snug text-muted">{v.empresa}</p>
                    </div>
                    {v.match && (
                      <span className="shrink-0">
                        <Badge tone={v.match >= 85 ? "green" : "gold"}>{v.match}%</Badge>
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1"><MapPin size={11} /> {v.cidade}/{v.uf}</span>
                    <span className="inline-flex items-center gap-1"><Wallet size={11} /> {v.faixa}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {v.area && <Badge tone="navy">{v.area}</Badge>}
                    <Badge tone="muted">{v.modelo}</Badge>
                    <Badge tone="muted">{v.contrato}</Badge>
                    {/* Cota e ação afirmativa aparecem na lista, não só no
                        detalhe: é informação que muda a decisão de abrir. */}
                    {v.pcd && (
                      <Badge tone="teal">
                        <Accessibility size={11} /> Vaga PCD
                      </Badge>
                    )}
                    {(v.afirmativaPara ?? []).map((g) => (
                      <Badge key={g} tone="gold">{g}</Badge>
                    ))}
                    {aplicada && <Badge tone="green">Candidatura enviada</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalhe */}
          {vaga && (
            <DetalheVaga
              vaga={vaga}
              aplicada={candidaturas.includes(vaga.id)}
              onCandidatar={(mensagem) => candidatar(vaga.id, mensagem)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DetalheVaga({
  vaga, aplicada, onCandidatar,
}: {
  vaga: Vaga;
  aplicada: boolean;
  onCandidatar: (mensagem?: string) => Promise<ResultadoCandidatura>;
}) {
  const { cursos } = useDados();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCandidatura | null>(null);
  const [carta, setCarta] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);

  // A vaga muda quando a pessoa clica em outra na lista; o aviso da anterior
  // não pode ficar pendurado.
  useEffect(() => {
    setResultado(null);
    setCarta("");
    setEscrevendo(false);
  }, [vaga.id]);

  async function enviar() {
    setEnviando(true);
    const r = await onCandidatar(carta);
    setEnviando(false);
    setResultado(r);
    if (r.ok) setEscrevendo(false);
  }
  const dias = Math.max(
    0,
    Math.round((Date.now() - new Date(vaga.publicadaEm).getTime()) / 86400000)
  );

  return (
    <Card className="!p-0 lg:sticky lg:top-24 lg:self-start">
      <div
        className="rounded-t-2xl p-5 sm:p-7"
        style={{ background: `linear-gradient(120deg, ${vaga.logoCor} 0%, #001838 100%)` }}
      >
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug text-white sm:text-xl lg:text-2xl">{vaga.titulo}</h2>
            <p className="mt-1 text-sm text-navy-100/70">
              {vaga.empresa} · {vaga.cidade}/{vaga.uf}
            </p>
          </div>
          {vaga.match && (
            <div className="shrink-0 rounded-xl border border-gold-400/35 bg-gold-400/10 px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-gold-300">{vaga.match}%</p>
              <p className="text-[10px] uppercase tracking-wider text-navy-100/50">match</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[vaga.area, vaga.modelo, vaga.contrato, vaga.senioridade, vaga.faixa]
            .filter(Boolean)
            .map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-navy-100/55 sm:gap-x-5">
          <span className="inline-flex items-center gap-1.5"><Clock size={12} /> Publicada há {dias} dias</span>
          <span className="inline-flex items-center gap-1.5"><Briefcase size={12} /> {vaga.candidatos} candidatos</span>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy-700">Sobre a vaga</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-ink">{vaga.descricao}</p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy-700">Requisitos</h3>
          <ul className="mt-2.5 space-y-2">
            {vaga.requisitos.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm text-ink">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-500" /> {r}
              </li>
            ))}
          </ul>
        </div>

        {(vaga.jornada || vaga.escolaridade || vaga.experienciaMinAnos || vaga.beneficios?.length) && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-navy-700">
              Condições e benefícios
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {vaga.jornada && <Badge tone="muted">Jornada {vaga.jornada.toLowerCase()}</Badge>}
              {vaga.escolaridade && <Badge tone="muted">{vaga.escolaridade}</Badge>}
              {typeof vaga.experienciaMinAnos === "number" && vaga.experienciaMinAnos > 0 && (
                <Badge tone="muted">
                  {vaga.experienciaMinAnos}+ ano(s) de experiência
                </Badge>
              )}
              {(vaga.beneficios ?? []).map((b) => (
                <Badge key={b} tone="navy">{b}</Badge>
              ))}
            </div>
          </div>
        )}

        {(vaga.pcd || (vaga.afirmativaPara ?? []).length > 0 || vaga.acessibilidade) && (
          <div className="rounded-xl border border-teal/25 bg-teal/5 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal">
              <ShieldCheck size={13} />
              {vaga.pcd ? "Vaga afirmativa · reserva para PCD" : "Vaga afirmativa"}
            </p>
            {(vaga.afirmativaPara ?? []).length > 0 && (
              <p className="mt-2 text-sm leading-relaxed text-ink">
                A empresa declarou preferência para{" "}
                <strong>{(vaga.afirmativaPara ?? []).join(", ").toLowerCase()}</strong>. A
                candidatura segue aberta a todo mundo; a preferência vale no critério de
                desempate.
              </p>
            )}
            {vaga.pcd && (
              <p className="mt-2 text-sm leading-relaxed text-ink">
                Reserva prevista na Lei 8.213/1991, art. 93.
              </p>
            )}
            {vaga.acessibilidade && (
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink">
                <Accessibility size={15} className="mt-0.5 shrink-0 text-teal" />
                {vaga.acessibilidade}
              </p>
            )}
          </div>
        )}

        {vaga.certificacoesDesejadas.length > 0 && (
          <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-600">
              <Sparkles size={13} /> Certificações valorizadas
            </p>
            <div className="mt-2.5 space-y-1.5">
              {vaga.certificacoesDesejadas.map((slug) => {
                const c = cursos.find((x) => x.slug === slug);
                return (
                  <p key={slug} className="text-sm font-medium text-gold-600/90">
                    · {c?.titulo ?? slug}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-navy-100 pt-5">
          {/* A carta é opcional e some depois do envio: quem quer só se
              candidatar clica uma vez, quem quer se apresentar tem onde. */}
          {escrevendo && !aplicada && (
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
                Uma linha sobre você (opcional)
              </label>
              <textarea
                value={carta}
                onChange={(e) => setCarta(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Ex.: trabalho com CT-e há 4 anos e acabei de concluir a trilha de Analista Fiscal aqui."
                className={cn(inputCls, "resize-none")}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 sm:gap-3">
            {aplicada ? (
              <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 sm:w-auto">
                <CheckCircle2 size={16} /> Candidatura enviada
              </span>
            ) : (
              <>
                <Button
                  variant="gold"
                  size="lg"
                  onClick={() => void enviar()}
                  disabled={enviando}
                  className="w-full sm:w-auto"
                >
                  {enviando ? "Enviando…" : "Candidatar-se"}
                </Button>
                {!escrevendo && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setEscrevendo(true)}
                    className="w-full sm:w-auto"
                  >
                    Escrever uma linha antes
                  </Button>
                )}
              </>
            )}
          </div>

          {/* O aviso vem do banco, não de otimismo: antes a tela dizia
              "enviada" mesmo quando a gravação falhava. */}
          {resultado && !resultado.ok && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {resultado.erro ?? "Não consegui enviar a sua candidatura."}
            </p>
          )}
          {resultado?.ok && resultado.apenasLocal && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              Você está no modo demonstração: a candidatura vale para esta sessão e
              não chega à empresa. Troque para o Supabase no seletor do topo.
            </p>
          )}
          {resultado?.ok && !resultado.apenasLocal && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              Candidatura enviada. A empresa vê seu perfil com os certificados
              emitidos aqui e você acompanha o andamento nesta tela.
            </p>
          )}
        </div>
        <p className="text-xs text-muted">
          Ao se candidatar, seu perfil e certificações verificadas são enviados à empresa.
          Você pode revogar o acesso a qualquer momento em Configurações › Privacidade.
        </p>
      </div>
    </Card>
  );
}


