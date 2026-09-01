"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, Bookmark, BookmarkCheck, MapPin, Search, SlidersHorizontal,
  Sparkles, Users, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, cn, inputCls } from "@/components/ui";
import { TravaBancoDeTalentos } from "@/components/trava-talentos";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";

const senioridades = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];

export default function TalentosPage() {
  return (
    <TravaBancoDeTalentos>
      <Talentos />
    </TravaBancoDeTalentos>
  );
}

function Talentos() {
  const { favoritos, alternarFavorito } = useSession();
  const { talentos, habilidades: habilidadesDisponiveis } = useDados();

  const [busca, setBusca] = useState("");
  const [senioridade, setSenioridade] = useState<string | null>(null);
  const [uf, setUf] = useState<string>("");
  const [skills, setSkills] = useState<string[]>([]);
  const [soDisponiveis, setSoDisponiveis] = useState(false);
  const [soFavoritos, setSoFavoritos] = useState(false);

  const ufs = useMemo(() => [...new Set(talentos.map((t) => t.uf!))].sort(), [talentos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return talentos.filter((t) => {
      const bateBusca =
        !q ||
        t.nome.toLowerCase().includes(q) ||
        (t.cargo ?? "").toLowerCase().includes(q) ||
        (t.bio ?? "").toLowerCase().includes(q) ||
        (t.habilidades ?? []).some((h) => h.toLowerCase().includes(q));
      const bateSen = !senioridade || t.senioridade === senioridade;
      const bateUf = !uf || t.uf === uf;
      const bateSkills = skills.length === 0 || skills.every((s) => (t.habilidades ?? []).includes(s));
      const bateDisp = !soDisponiveis || t.disponivel;
      const bateFav = !soFavoritos || favoritos.includes(t.id);
      return bateBusca && bateSen && bateUf && bateSkills && bateDisp && bateFav;
    });
  }, [talentos, busca, senioridade, uf, skills, soDisponiveis, soFavoritos, favoritos]);

  function alternarSkill(s: string) {
    setSkills((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]));
  }

  function limpar() {
    setBusca(""); setSenioridade(null); setUf(""); setSkills([]);
    setSoDisponiveis(false); setSoFavoritos(false);
  }

  const filtrosAtivos =
    Boolean(busca || senioridade || uf || skills.length || soDisponiveis || soFavoritos);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">Banco de Talentos</h1>
          <p className="mt-1.5 text-sm text-muted">
            Profissionais contábeis com histórico de formação verificado na plataforma.
          </p>
        </div>
        <Button href="/app/vagas" variant="outline">
          Ver vagas abertas
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filtros */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                <SlidersHorizontal size={15} /> Filtros
              </p>
              {filtrosAtivos && (
                <button
                  onClick={limpar}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 hover:underline"
                >
                  <X size={12} /> Limpar
                </button>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                Senioridade
              </p>
              <div className="flex flex-wrap gap-1.5">
                {senioridades.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSenioridade(senioridade === s ? null : s)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                      senioridade === s
                        ? "border-gold-400 bg-gold-50 text-gold-600"
                        : "border-navy-100 text-muted hover:border-navy-200"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Estado</p>
              <select value={uf} onChange={(e) => setUf(e.target.value)} className={inputCls}>
                <option value="">Todos os estados</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                Habilidades
              </p>
              <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
                {habilidadesDisponiveis.map((h) => (
                  <button
                    key={h}
                    onClick={() => alternarSkill(h)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      skills.includes(h)
                        ? "border-navy-700 bg-navy-700 text-white"
                        : "border-navy-100 text-muted hover:border-navy-200"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 border-t border-navy-100 pt-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={soDisponiveis}
                  onChange={(e) => setSoDisponiveis(e.target.checked)}
                  className="h-4 w-4 rounded border-navy-200 accent-[#C89F50]"
                />
                Aberto a oportunidades
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={soFavoritos}
                  onChange={(e) => setSoFavoritos(e.target.checked)}
                  className="h-4 w-4 rounded border-navy-200 accent-[#C89F50]"
                />
                Somente favoritos ({favoritos.length})
              </label>
            </div>
          </Card>

          <Card className="!border-gold-200 !bg-gold-50">
            <Sparkles size={17} className="text-gold-500" />
            <p className="mt-2.5 text-sm font-bold text-navy-700">Busca inteligente</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gold-600/90">
              Descreva a vaga em linguagem natural e a IA ranqueia os perfis por
              aderência — com explicação do porquê.
            </p>
          </Card>
        </aside>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: analista fiscal com experiência em CT-e na Bahia"
              className={inputCls + " pl-11"}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              <strong className="text-navy-700">{lista.length}</strong> profissionais encontrados
            </p>
            <select className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-xs text-muted outline-none">
              <option>Mais relevantes</option>
              <option>Maior XP</option>
              <option>Atualizados recentemente</option>
            </select>
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon={<Users size={34} />}
              title="Nenhum profissional encontrado"
              description="Tente remover algum filtro ou usar termos mais amplos."
              action={<Button variant="outline" onClick={limpar}>Limpar filtros</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lista.map((t) => {
                const fav = favoritos.includes(t.id);
                return (
                  <Card key={t.id} hover className="flex h-full flex-col">
                    <div className="flex items-start gap-3.5">
                      <Avatar nome={t.nome} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          <Link
                            href={`/app/talentos/${t.id}`}
                            className="text-sm font-bold leading-snug text-navy-700 hover:text-gold-600"
                          >
                            {t.nome}
                          </Link>
                          <BadgeCheck size={15} className="mt-0.5 shrink-0 text-gold-500" />
                        </div>
                        <p className="text-xs leading-snug text-muted">{t.cargo}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs leading-snug text-muted">
                          <MapPin size={11} className="shrink-0" /> {t.cidade}/{t.uf}
                        </p>
                      </div>
                      <button
                        onClick={() => alternarFavorito(t.id)}
                        className={cn(
                          "shrink-0 transition",
                          fav ? "text-gold-500" : "text-navy-200 hover:text-gold-400"
                        )}
                        aria-label={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
                      >
                        {fav ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                    </div>

                    <p className="mt-3.5 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                      {t.bio}
                    </p>

                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      <Badge tone="navy">{t.senioridade}</Badge>
                      {t.crc && <Badge tone="teal">CRC ativo</Badge>}
                      {t.disponivel ? (
                        <Badge tone="green">Disponível</Badge>
                      ) : (
                        <Badge tone="muted">Empregado</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(t.habilidades ?? []).slice(0, 4).map((h) => (
                        <span
                          key={h}
                          className="rounded-md bg-cream px-2 py-0.5 text-[11px] font-medium text-navy-600"
                        >
                          {h}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-4">
                      <span className="text-xs text-muted">
                        Nível {t.nivel} · {(t.pontos ?? 0).toLocaleString("pt-BR")} XP
                      </span>
                      <Button href={`/app/talentos/${t.id}`} variant="outline" size="sm">
                        Ver perfil
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
