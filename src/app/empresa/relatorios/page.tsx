"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award, CheckCircle2, Download, ExternalLink, FileBarChart, Loader2,
  ShieldCheck, TrendingUp,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Progress, cn } from "@/components/ui";
import { carregarRelatorioPEPC, type LinhaRelatorio, type RelatorioPEPC } from "@/lib/repo-empresa";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   RELATÓRIO DE EDUCAÇÃO CONTINUADA

   Este é o documento que justifica o contrato. A Resolução CFC 1.377/2011 põe
   a pontuação anual como obrigação do profissional, mas quem responde pelo
   time — em auditoria, em perícia, numa due diligence de cliente — é o
   escritório. Sem este relatório o gestor faz isso em planilha, na mão, com o
   certificado em PDF no e-mail de cada um.

   Cada linha traz o código público do certificado. É o que permite conferir
   sem depender da nossa palavra: /validar/CODIGO abre para qualquer pessoa,
   inclusive para quem não tem conta.

   A exportação sai em CSV com ponto e vírgula e BOM — é o que o Excel em
   português abre com as colunas separadas, sem passar pelo assistente de
   importação.
   ========================================================================== */

const META_ANUAL = 40;

export default function RelatoriosPage() {
  const { empresa } = useEmpresa();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [rel, setRel] = useState<RelatorioPEPC | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async (a: number) => {
    setCarregando(true);
    setRel(await carregarRelatorioPEPC(a));
    setCarregando(false);
  }, []);

  useEffect(() => { void buscar(ano); }, [ano, buscar]);

  const membros = rel?.membros ?? [];
  const totalPontos = membros.reduce((a, m) => a + m.pontos, 0);
  const totalHoras = membros.reduce((a, m) => a + m.horas, 0);
  const emDia = membros.filter((m) => m.pontos >= META_ANUAL).length;
  const meta = membros.length * META_ANUAL;

  function exportar() {
    const linhas: string[][] = [
      ["Empresa", empresa.nome],
      ["Ano-base", String(ano)],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      [],
      ["Profissional", "CRC", "Cargo", "E-mail", "Pontos PEPC", "Horas", "Tipo", "Formação", "Código de validação", "Emitido em"],
    ];

    for (const m of membros) {
      if (m.itens.length === 0) {
        linhas.push([m.nome, m.crc ?? "", m.cargo ?? "", m.email, "0", "0", "", "Nenhum certificado no período", "", ""]);
        continue;
      }
      for (const i of m.itens) {
        linhas.push([
          m.nome, m.crc ?? "", m.cargo ?? "", m.email,
          String(m.pontos), String(m.horas),
          i.tipo === "trilha" ? "Trilha" : "Curso",
          i.titulo, i.codigo,
          new Date(i.emitidoEm).toLocaleDateString("pt-BR"),
        ]);
      }
    }

    // Ponto e vírgula + BOM: o Excel brasileiro depende dos dois para abrir
    // o arquivo já com as colunas no lugar.
    const csv = "﻿" + linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pepc-${empresa.nome.toLowerCase().replace(/\W+/g, "-")}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-500">Prestação de contas</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">
            Educação continuada — {ano}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Pontuação de cada profissional no ano-base, com o código público de
            validação de cada certificado. É o anexo que acompanha a resposta ao CRC
            ou a due diligence de um cliente.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
              Ano-base
            </span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gold-400"
            >
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={anoAtual - i}>{anoAtual - i}</option>
              ))}
            </select>
          </label>
          <Button variant="gold" onClick={exportar} disabled={membros.length === 0}>
            <Download size={15} /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi icone={<TrendingUp size={18} />} rotulo="Pontos do time" valor={totalPontos} nota={`Meta: ${meta} pts`} />
        <Kpi icone={<CheckCircle2 size={18} />} rotulo="Profissionais em dia" valor={`${emDia}/${membros.length}`} nota={`${META_ANUAL} pts por pessoa`} />
        <Kpi icone={<Award size={18} />} rotulo="Certificados no ano" valor={membros.reduce((a, m) => a + m.itens.length, 0)} nota="Com validação pública" />
        <Kpi icone={<FileBarChart size={18} />} rotulo="Horas certificadas" valor={`${totalHoras}h`} nota="Somadas do time" />
      </div>

      {carregando ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Levantando os certificados…
        </p></Card>
      ) : membros.length === 0 ? (
        <Card className="py-12 text-center">
          <FileBarChart size={26} className="mx-auto text-navy-300" />
          <p className="mt-3 font-semibold text-navy-700">Nada a relatar em {ano}</p>
          <p className="mt-1.5 text-sm text-muted">
            Nenhum certificado foi emitido para o time neste ano-base.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {membros.map((m) => <LinhaPessoa key={m.perfilId} m={m} />)}
        </div>
      )}

      <p className="rounded-xl border border-navy-100 bg-cream/50 px-4 py-3 text-xs leading-relaxed text-muted">
        <ShieldCheck size={13} className="mr-1 inline text-gold-500" />
        A pontuação PEPC segue a carga horária de cada curso. A validade formal para
        o CRC depende de a Castelo Branco estar credenciada como capacitadora — veja
        o item correspondente antes de usar este relatório como prova documental.
      </p>
    </div>
  );
}

function Kpi({
  icone, rotulo, valor, nota,
}: {
  icone: React.ReactNode; rotulo: string; valor: string | number; nota: string;
}) {
  return (
    <Card>
      <div className="text-gold-500">{icone}</div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-navy-700">{valor}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-navy-600">{rotulo}</p>
      <p className="mt-1.5 text-xs text-muted">{nota}</p>
    </Card>
  );
}

function LinhaPessoa({ m }: { m: LinhaRelatorio }) {
  const [aberto, setAberto] = useState(false);
  const pct = Math.min(100, Math.round((m.pontos / META_ANUAL) * 100));
  const emDia = m.pontos >= META_ANUAL;

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition hover:bg-cream/40"
      >
        <Avatar nome={m.nome} size={38} />
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-semibold text-navy-700">{m.nome}</p>
          <p className="text-xs text-muted leading-snug">
            {m.cargo ? `${m.cargo} · ` : ""}{m.crc ? `CRC ${m.crc}` : "CRC não informado"}
          </p>
        </div>

        <div className="w-40">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">{m.pontos} de {META_ANUAL} pts</span>
            <span className="tabular-nums text-muted">{pct}%</span>
          </div>
          <Progress value={pct} tone={emDia ? "green" : "gold"} className="mt-1.5" />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{m.horas}h · {m.itens.length} certificado(s)</span>
          {emDia
            ? <Badge tone="green"><CheckCircle2 size={11} /> Em dia</Badge>
            : <Badge tone="gold">Faltam {META_ANUAL - m.pontos} pts</Badge>}
        </div>
      </button>

      {aberto && (
        <div className="border-t border-navy-100 bg-cream/40">
          {m.itens.length === 0 ? (
            <p className="px-5 py-4 text-xs text-muted">
              Nenhum certificado emitido neste ano-base.
            </p>
          ) : (
            <div className="divide-y divide-navy-100">
              {m.itens.map((i) => (
                <div key={i.codigo} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Badge tone={i.tipo === "trilha" ? "teal" : "navy"}>
                    {i.tipo === "trilha" ? "Trilha" : "Curso"}
                  </Badge>
                  <p className="min-w-[160px] flex-1 text-sm font-semibold text-navy-700">
                    {i.titulo}
                  </p>
                  <span className="text-xs tabular-nums text-muted">
                    {i.cargaHoraria}h · {i.pontos} pts ·{" "}
                    {new Date(i.emitidoEm).toLocaleDateString("pt-BR")}
                  </span>
                  <a
                    href={`/validar/${i.codigo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1.5",
                      "font-mono text-[11px] font-semibold text-navy-700 transition",
                      "hover:border-gold-400 hover:text-gold-600"
                    )}
                  >
                    {i.codigo} <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
