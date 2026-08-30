"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import { Badge, Card, EmptyState, cn, inputCls } from "@/components/ui";
import { IconeFerramenta } from "@/components/ferramenta-form";
import { CATEGORIAS_FERRAMENTAS, FERRAMENTAS } from "@/lib/ferramentas/catalogo";
import { VIGENCIA } from "@/lib/ferramentas/tabelas";

export default function FerramentasPage() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return FERRAMENTAS.filter((f) => {
      if (categoria && f.categoria !== categoria) return false;
      if (!termo) return true;
      return `${f.nome} ${f.descricao} ${f.categoria}`.toLowerCase().includes(termo);
    });
  }, [busca, categoria]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, typeof FERRAMENTAS>();
    for (const f of lista) {
      if (!m.has(f.categoria)) m.set(f.categoria, []);
      m.get(f.categoria)!.push(f);
    }
    return CATEGORIAS_FERRAMENTAS.filter((c) => m.has(c)).map((c) => [c, m.get(c)!] as const);
  }, [lista]);

  const destaques = FERRAMENTAS.filter((f) => f.destaque);

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow text-gold-500">Ferramentas</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
          Calculadoras do dia a dia
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {FERRAMENTAS.length} ferramentas para a rotina do escritório: folha, tributos,
          transporte, comércio exterior e gestão. Tudo calcula no seu navegador —
          nenhum dado digitado aqui sai da sua máquina.
        </p>
      </div>

      {/* Atalhos do que mais se usa */}
      {!busca && !categoria && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
            <Sparkles size={13} className="text-gold-500" /> Mais usadas
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {destaques.map((f) => (
              <Link key={f.slug} href={`/app/ferramentas/${f.slug}`}>
                <Card hover className="!border-gold-200 !bg-gold-50/40 h-full">
                  <div className="flex items-start gap-3">
                    <span className="gold-gradient inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-800">
                      <IconeFerramenta nome={f.icone} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy-700">{f.nome}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{f.descricao}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card className="space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ferramenta — rescisão, DAS, frete, importação…"
            className={inputCls + " pl-11"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={!categoria} onClick={() => setCategoria("")}>
            Todas ({FERRAMENTAS.length})
          </Chip>
          {CATEGORIAS_FERRAMENTAS.map((c) => (
            <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(categoria === c ? "" : c)}>
              {c} ({FERRAMENTAS.filter((f) => f.categoria === c).length})
            </Chip>
          ))}
          {(busca || categoria) && (
            <button
              onClick={() => { setBusca(""); setCategoria(""); }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-gold-600 transition hover:text-gold-500"
            >
              <X size={12} /> limpar
            </button>
          )}
        </div>
      </Card>

      {/* Lista */}
      {lista.length === 0 ? (
        <EmptyState
          title="Nenhuma ferramenta com esse termo"
          description="Tente por assunto: férias, Simples, frete, importação, markup."
        />
      ) : (
        porCategoria.map(([cat, itens]) => (
          <div key={cat}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
              {cat}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {itens.map((f) => (
                <Link key={f.slug} href={`/app/ferramentas/${f.slug}`} className="group">
                  <Card hover className="flex h-full flex-col">
                    <div className="flex items-start gap-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-600 transition group-hover:bg-navy-700 group-hover:text-white"
                      >
                        <IconeFerramenta nome={f.icone} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy-700">{f.nome}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{f.descricao}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3">
                      {f.vigencia ? (
                        <Badge tone="muted">Tabela oficial</Badge>
                      ) : (
                        <Badge tone="teal">Cálculo puro</Badge>
                      )}
                      <ArrowRight
                        size={15}
                        className="text-navy-200 transition group-hover:translate-x-0.5 group-hover:text-gold-500"
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}

      <Card className="!bg-cream/60">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-navy-700">Sobre as tabelas.</strong> As contas estão
          conferidas; o que muda com o tempo são as tabelas oficiais (INSS, IRRF, anexos
          do Simples, presunções). Elas vivem num arquivo só, revisado pela última vez em{" "}
          {VIGENCIA.revisadoEm}. Toda ferramenta que depende de tabela mostra a vigência
          dela na tela — confira antes de entregar número a cliente.
        </p>
      </Card>
    </div>
  );
}

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
          : "border-navy-200 text-navy-700 hover:border-gold-400 hover:text-gold-600"
      )}
    >
      {children}
    </button>
  );
}
