"use client";

import { useEffect, useState } from "react";
import { Check, Info, Loader2, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import {
  OPCOES_GENERO, OPCOES_PCD, OPCOES_RACA_COR, minhaDiversidade,
  salvarMinhaDiversidade, type Diversidade,
} from "@/lib/repo-pessoas";

/* ==========================================================================
   AUTODECLARAÇÃO

   Isto existe para viabilizar duas coisas ao mesmo tempo:

   · a empresa poder medir a representatividade das candidaturas dela —
     agregada, a partir de cinco declarações, nunca por pessoa;
   · a vaga de cota PCD encontrar quem ela precisa encontrar.

   O que este bloco NÃO faz, de propósito: virar filtro. A Lei 9.029/1995
   proíbe prática discriminatória no acesso ao emprego por sexo, origem, raça,
   cor, estado civil, situação familiar, deficiência e idade — e é por isso que
   nenhuma tela desta plataforma permite peneirar candidato por esses campos.

   Responder é opcional em todos os campos, inclusive por exigência da LGPD:
   pergunta pessoal não pode ser obrigatória em processo seletivo.
   ========================================================================== */

export function BlocoAutodeclaracao() {
  const [d, setD] = useState<Diversidade | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    minhaDiversidade().then((r) => { if (vivo) setD(r ?? {}); });
    return () => { vivo = false; };
  }, []);

  const set = (p: Partial<Diversidade>) => {
    setD((v) => ({ ...(v ?? {}), ...p }));
    setSalvo(false);
  };

  async function salvar() {
    if (!d) return;
    setErro("");
    setSalvando(true);
    const r = await salvarMinhaDiversidade(d);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui salvar.");
    setSalvo(true);
  }

  const preenchido = Boolean(d?.genero || d?.racaCor || d?.pcd);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
          <ShieldCheck size={15} className="text-gold-500" /> Autodeclaração
        </h3>
        <Badge tone={preenchido ? "green" : "muted"}>
          {preenchido ? "Preenchida" : "Opcional"}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Serve para duas coisas: as vagas de cota PCD te encontrarem e as empresas medirem
        a representatividade das candidaturas — <strong>somada, nunca por pessoa</strong>.
        Nenhuma tela aqui permite filtrar candidato por cor, gênero ou idade.
      </p>

      {!aberto ? (
        <Button variant="outline" size="sm" full className="mt-4" onClick={() => setAberto(true)}>
          {preenchido ? "Revisar minha declaração" : "Preencher (leva 20 segundos)"}
        </Button>
      ) : d === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <Field label="Gênero">
            <select
              value={d.genero ?? ""}
              onChange={(e) => set({ genero: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Não informar</option>
              {OPCOES_GENERO.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>

          <Field label="Raça/cor" hint="Mesmas categorias que o IBGE usa.">
            <select
              value={d.racaCor ?? ""}
              onChange={(e) => set({ racaCor: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Não informar</option>
              {OPCOES_RACA_COR.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-cream/50 p-3.5">
            <input
              type="checkbox"
              checked={Boolean(d.pcd)}
              onChange={(e) => set({ pcd: e.target.checked, pcdTipo: e.target.checked ? d.pcdTipo : null })}
              className="mt-0.5 h-4 w-4 accent-gold-500"
            />
            <span className="min-w-0">
              <span className="text-sm font-semibold text-navy-700">
                Sou pessoa com deficiência
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">
                Vagas de cota (Lei 8.213/1991) passam a considerar seu perfil.
              </span>
            </span>
          </label>

          {d.pcd && (
            <Field label="Tipo de deficiência">
              <select
                value={d.pcdTipo ?? ""}
                onChange={(e) => set({ pcdTipo: e.target.value || null })}
                className={inputCls}
              >
                <option value="">Não informar</option>
                {OPCOES_PCD.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="gold"
              size="sm"
              onClick={() => void salvar()}
              disabled={salvando}
              className={cn(salvo && "!bg-emerald-500")}
            >
              {salvando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : salvo ? (
                <Check size={14} />
              ) : null}
              {salvo ? "Salvo" : "Salvar declaração"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>

          <p className="flex items-start gap-1.5 border-t border-navy-100 pt-3 text-[11px] leading-relaxed text-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            Só você lê esta linha. A empresa vê contagem por grupo, e só quando pelo menos
            cinco pessoas declararam naquela vaga — abaixo disso a conta identificaria
            quem respondeu.
          </p>
        </div>
      )}
    </Card>
  );
}
