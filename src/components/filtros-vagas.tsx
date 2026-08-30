"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button, cn } from "@/components/ui";
import { Modal } from "@/components/modal";

/* ==========================================================================
   FILTROS DO MURAL DE VAGAS

   O mural filtrava por modelo de trabalho e tipo de contrato — dois campos
   que dizem *como* se trabalha, nenhum diz *do que* o trabalho trata. Quem
   procura vaga contábil procura por área primeiro.

   A forma é a que o LinkedIn consagrou e todo mundo já sabe usar: uma fila de
   pílulas com o que se filtra toda hora, cada uma abrindo um menu, e um
   "Todos os filtros" para o resto. O que não fazemos é copiar a lista inteira
   deles: metade daqueles filtros não existe aqui (setor, função, candidatura
   simplificada) e filtro que nunca casa é só ruído entre a pessoa e a vaga.

   Cada pílula mostra a contagem quando tem seleção — é o que evita a pessoa
   se perguntar por que só apareceram duas vagas.
   ========================================================================== */

export type Ordem = "relevancia" | "recentes";

export interface EstadoFiltros {
  busca: string;
  areas: string[];
  modelos: string[];
  contratos: string[];
  senioridades: string[];
  empresas: string[];
  locais: string[];
  /** Dias desde a publicação. 0 = sem limite. */
  dias: number;
  ordem: Ordem;
  soNaoCandidatadas: boolean;
  soAltoMatch: boolean;
}

export const filtrosVazios: EstadoFiltros = {
  busca: "", areas: [], modelos: [], contratos: [], senioridades: [],
  empresas: [], locais: [], dias: 0, ordem: "relevancia",
  soNaoCandidatadas: false, soAltoMatch: false,
};

export const AREAS = ["Fiscal", "Tributário", "Contábil", "Pessoal", "Comex", "Gestão"];
export const MODELOS = ["Presencial", "Híbrido", "Remoto"];
export const CONTRATOS = ["CLT", "PJ", "Estágio", "Freelance"];
export const SENIORIDADES = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];

export const PERIODOS: Array<{ v: number; rotulo: string }> = [
  { v: 1, rotulo: "Últimas 24 horas" },
  { v: 7, rotulo: "Última semana" },
  { v: 30, rotulo: "Último mês" },
  { v: 90, rotulo: "Últimos 3 meses" },
];

const ORDENS: Array<{ v: Ordem; rotulo: string; dica: string }> = [
  { v: "relevancia", rotulo: "Mais relevantes", dica: "Pelo seu match com a vaga" },
  { v: "recentes", rotulo: "Mais recentes", dica: "Pela data de publicação" },
];

/** Quantos filtros estão valendo — alimenta o "Redefinir" e a contagem. */
export function contarFiltros(f: EstadoFiltros): number {
  return (
    f.areas.length + f.modelos.length + f.contratos.length + f.senioridades.length
    + f.empresas.length + f.locais.length
    + (f.dias ? 1 : 0)
    + (f.busca.trim() ? 1 : 0)
    + (f.soNaoCandidatadas ? 1 : 0)
    + (f.soAltoMatch ? 1 : 0)
  );
}

export function BarraDeFiltros({
  f, aoMudar, empresas, locais, total,
}: {
  f: EstadoFiltros;
  aoMudar: (patch: Partial<EstadoFiltros>) => void;
  /** Vêm das vagas carregadas: filtro por empresa que não existe é gaveta vazia. */
  empresas: string[];
  locais: string[];
  total: number;
}) {
  const [tudo, setTudo] = useState(false);
  const ativos = contarFiltros(f);

  const alternar = (campo: keyof EstadoFiltros, valor: string) => {
    const atual = f[campo] as string[];
    aoMudar({
      [campo]: atual.includes(valor)
        ? atual.filter((x) => x !== valor)
        : [...atual, valor],
    } as Partial<EstadoFiltros>);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pilula
          rotulo={ORDENS.find((o) => o.v === f.ordem)!.rotulo}
          aberta={false}
        >
          {(fechar) => (
            <Menu>
              {ORDENS.map((o) => (
                <ItemMenu
                  key={o.v}
                  marcado={f.ordem === o.v}
                  onClick={() => { aoMudar({ ordem: o.v }); fechar(); }}
                >
                  <span>
                    {o.rotulo}
                    <span className="block text-[11px] font-normal text-muted">{o.dica}</span>
                  </span>
                </ItemMenu>
              ))}
            </Menu>
          )}
        </Pilula>

        <Pilula rotulo="Área" contagem={f.areas.length}>
          {() => (
            <Menu>
              {AREAS.map((a) => (
                <ItemMenu key={a} marcado={f.areas.includes(a)} onClick={() => alternar("areas", a)}>
                  {a}
                </ItemMenu>
              ))}
            </Menu>
          )}
        </Pilula>

        <Pilula
          rotulo={f.dias ? PERIODOS.find((p) => p.v === f.dias)!.rotulo : "Data do anúncio"}
          contagem={f.dias ? 1 : 0}
        >
          {(fechar) => (
            <Menu>
              {PERIODOS.map((p) => (
                <ItemMenu
                  key={p.v}
                  marcado={f.dias === p.v}
                  onClick={() => { aoMudar({ dias: f.dias === p.v ? 0 : p.v }); fechar(); }}
                >
                  {p.rotulo}
                </ItemMenu>
              ))}
            </Menu>
          )}
        </Pilula>

        <Pilula rotulo="Modelo" contagem={f.modelos.length}>
          {() => (
            <Menu>
              {MODELOS.map((m) => (
                <ItemMenu key={m} marcado={f.modelos.includes(m)} onClick={() => alternar("modelos", m)}>
                  {m}
                </ItemMenu>
              ))}
            </Menu>
          )}
        </Pilula>

        <Pilula rotulo="Nível" contagem={f.senioridades.length}>
          {() => (
            <Menu>
              {SENIORIDADES.map((n) => (
                <ItemMenu
                  key={n}
                  marcado={f.senioridades.includes(n)}
                  onClick={() => alternar("senioridades", n)}
                >
                  {n}
                </ItemMenu>
              ))}
            </Menu>
          )}
        </Pilula>

        <button
          onClick={() => setTudo(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
            ativos > 0
              ? "border-navy-700 bg-navy-700 text-white"
              : "border-navy-200 bg-white text-navy-700 hover:border-gold-400 hover:text-gold-600"
          )}
        >
          <SlidersHorizontal size={13} /> Todos os filtros
          {ativos > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">
              {ativos}
            </span>
          )}
        </button>

        {ativos > 0 && (
          <button
            onClick={() => aoMudar(filtrosVazios)}
            className="text-xs font-semibold text-muted underline underline-offset-2 transition hover:text-gold-600"
          >
            Redefinir
          </button>
        )}
      </div>

      {tudo && (
        <Modal
          titulo="Todos os filtros"
          subtitulo={`${total} vaga(s) com os filtros atuais`}
          largura="max-w-2xl"
          aoFechar={() => setTudo(false)}
          rodape={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => aoMudar(filtrosVazios)}
                className="text-sm font-semibold text-muted underline underline-offset-2 hover:text-gold-600"
              >
                Limpar tudo
              </button>
              <Button variant="gold" onClick={() => setTudo(false)}>
                Ver {total} vaga(s)
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <Grupo titulo="Área">
              <Caixas opcoes={AREAS} marcadas={f.areas} onToggle={(v) => alternar("areas", v)} />
            </Grupo>
            <Grupo titulo="Data do anúncio">
              <div className="flex flex-wrap gap-2">
                {PERIODOS.map((p) => (
                  <Chip
                    key={p.v}
                    ativo={f.dias === p.v}
                    onClick={() => aoMudar({ dias: f.dias === p.v ? 0 : p.v })}
                  >
                    {p.rotulo}
                  </Chip>
                ))}
              </div>
            </Grupo>
            <Grupo titulo="Modelo de trabalho">
              <Caixas opcoes={MODELOS} marcadas={f.modelos} onToggle={(v) => alternar("modelos", v)} />
            </Grupo>
            <Grupo titulo="Tipo de contrato">
              <Caixas opcoes={CONTRATOS} marcadas={f.contratos} onToggle={(v) => alternar("contratos", v)} />
            </Grupo>
            <Grupo titulo="Nível de experiência">
              <Caixas opcoes={SENIORIDADES} marcadas={f.senioridades} onToggle={(v) => alternar("senioridades", v)} />
            </Grupo>
            {empresas.length > 1 && (
              <Grupo titulo="Empresa">
                <Caixas opcoes={empresas} marcadas={f.empresas} onToggle={(v) => alternar("empresas", v)} />
              </Grupo>
            )}
            {locais.length > 1 && (
              <Grupo titulo="Localidade">
                <Caixas opcoes={locais} marcadas={f.locais} onToggle={(v) => alternar("locais", v)} />
              </Grupo>
            )}
            <Grupo titulo="Atalhos">
              <div className="space-y-2">
                <Interruptor
                  ligado={f.soAltoMatch}
                  onChange={(v) => aoMudar({ soAltoMatch: v })}
                  rotulo="Só vagas com match acima de 70%"
                  dica="O match cruza suas certificações, habilidades e localização."
                />
                <Interruptor
                  ligado={f.soNaoCandidatadas}
                  onChange={(v) => aoMudar({ soNaoCandidatadas: v })}
                  rotulo="Esconder onde já me candidatei"
                  dica="Some do mural o que já está com a empresa."
                />
              </div>
            </Grupo>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- peças -- */

/** Pílula com menu. Fecha no clique fora e no Esc, como todo menu. */
function Pilula({
  rotulo, contagem = 0, children,
}: {
  rotulo: string;
  contagem?: number;
  aberta?: boolean;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
          contagem > 0 || aberta
            ? "border-navy-700 bg-navy-700 text-white"
            : "border-navy-200 bg-white text-navy-700 hover:border-gold-400 hover:text-gold-600"
        )}
      >
        {rotulo}
        {contagem > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">
            {contagem}
          </span>
        )}
        <ChevronDown size={13} className={cn("transition", aberta && "rotate-180")} />
      </button>
      {aberta && children(() => setAberta(false))}
    </div>
  );
}

const Menu = ({ children }: { children: React.ReactNode }) => (
  <div className="absolute left-0 z-30 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-xl">
    {children}
  </div>
);

function ItemMenu({
  children, marcado, onClick,
}: {
  children: React.ReactNode; marcado: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-4 py-2 text-left text-sm text-ink transition hover:bg-cream"
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
          marcado ? "border-gold-400 bg-gold-400 text-white" : "border-navy-200"
        )}
      >
        {marcado && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 font-medium">{children}</span>
    </button>
  );
}

const Grupo = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-navy-600">{titulo}</p>
    {children}
  </div>
);

function Caixas({
  opcoes, marcadas, onToggle,
}: {
  opcoes: string[]; marcadas: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <Chip key={o} ativo={marcadas.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </Chip>
      ))}
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        ativo
          ? "border-gold-400 bg-gold-50 text-gold-600"
          : "border-navy-200 bg-white text-navy-700 hover:border-navy-300"
      )}
    >
      {ativo && <X size={11} />}
      {children}
    </button>
  );
}

function Interruptor({
  ligado, onChange, rotulo, dica,
}: {
  ligado: boolean; onChange: (v: boolean) => void; rotulo: string; dica: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-cream/50 p-3.5">
      <input
        type="checkbox"
        checked={ligado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-gold-500"
      />
      <span>
        <span className="block text-sm font-semibold text-navy-700">{rotulo}</span>
        <span className="mt-0.5 block text-xs text-muted">{dica}</span>
      </span>
    </label>
  );
}
