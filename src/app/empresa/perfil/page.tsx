"use client";

import { useState } from "react";
import { AlertCircle, Building2, Check, KeyRound, Loader2, Save } from "lucide-react";
import { Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { CamposEndereco, mascararCep, type Endereco } from "@/components/campos-endereco";
import { salvarCadastroEmpresa } from "@/lib/repo-empresa";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   CADASTRO DA EMPRESA

   O que a empresa vê de si mesma. Nome, cor e cidade não são vaidade: eles
   aparecem no card de toda vaga publicada e no feed da comunidade.

   Os assentos contratados aparecem aqui só para leitura. Não é desconfiança —
   é que assento é cláusula de contrato, e o banco também recusa a alteração
   por gatilho. Deixar o campo editável e falhar no salvamento seria pior do
   que dizer com quem falar.
   ========================================================================== */

const CORES = ["#00204D", "#B88A45", "#2F6E75", "#1F4A7A", "#7A3E2F", "#3D5A3C"];

export default function CadastroEmpresa() {
  const { empresa, recarregar } = useEmpresa();

  const [f, setF] = useState({
    nome: empresa.nome,
    cnpj: empresa.cnpj ?? "",
    segmento: empresa.segmento ?? "",
    site: empresa.site ?? "",
    telefone: empresa.telefone ?? "",
    descricao: empresa.descricao ?? "",
    cor: empresa.cor ?? CORES[0],
  });

  const [endereco, setEndereco] = useState<Endereco>({
    cep: mascararCep(empresa.cep ?? ""),
    logradouro: empresa.logradouro ?? "",
    bairro: empresa.bairro ?? "",
    cidade: empresa.cidade ?? "",
    uf: empresa.uf ?? "",
    numero: empresa.numero ?? "",
    complemento: empresa.complemento ?? "",
  });

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  const set = (p: Partial<typeof f>) => { setF((v) => ({ ...v, ...p })); setSalvo(false); };

  async function salvar() {
    setErro("");
    if (!f.nome.trim()) return setErro("A empresa precisa de um nome.");
    setSalvando(true);
    const r = await salvarCadastroEmpresa(empresa.id, {
      ...f,
      cep: endereco.cep.replace(/\D/g, ""),
      logradouro: endereco.logradouro,
      bairro: endereco.bairro,
      numero: endereco.numero,
      complemento: endereco.complemento,
      cidade: endereco.cidade,
      uf: endereco.uf,
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui salvar.");
    setSalvo(true);
    await recarregar();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="eyebrow text-gold-500">Empresa</p>
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">Cadastro</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Estes dados aparecem no card das suas vagas, no perfil da empresa dentro da
          comunidade e no cabeçalho do relatório PEPC.
        </p>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      {/* Contrato — leitura */}
      <Card className="!border-gold-200 !bg-gold-50/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-400/25 text-gold-600">
              <KeyRound size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-navy-700">Contrato de licenças</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gold-600/90">
                {empresa.licencas.contratadas} assento(s) contratado(s), {empresa.licencas.usadas} em
                uso. Para ampliar ou reduzir, fale com a Castelo Branco — a alteração é feita
                pelo painel da Academy.
              </p>
            </div>
          </div>
          <Badge tone="gold">
            {empresa.licencas.usadas}/{empresa.licencas.contratadas}
          </Badge>
        </div>
      </Card>

      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <Field label="Razão social ou nome fantasia">
            <input value={f.nome} onChange={(e) => set({ nome: e.target.value })} className={inputCls} />
          </Field>
          <Field label="CNPJ" hint="Opcional — usado no cabeçalho do relatório.">
            <input
              value={f.cnpj}
              onChange={(e) => set({ cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className={cn(inputCls, "font-mono")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Segmento" hint="Aparece no card da empresa.">
            <input
              value={f.segmento}
              onChange={(e) => set({ segmento: e.target.value })}
              placeholder="Transporte e logística"
              className={inputCls}
            />
          </Field>
          <Field label="Telefone">
            <input
              value={f.telefone}
              onChange={(e) => set({ telefone: e.target.value })}
              placeholder="(75) 3221-0000"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Site">
          <input
            value={f.site}
            onChange={(e) => set({ site: e.target.value })}
            placeholder="https://suaempresa.com.br"
            className={inputCls}
          />
        </Field>

        <Field
          label="Sobre a empresa"
          hint="Duas ou três linhas. É o que o candidato lê antes de decidir se candidatar."
        >
          <textarea
            value={f.descricao}
            onChange={(e) => set({ descricao: e.target.value })}
            rows={3}
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        <Field label="Cor da marca" hint="Usada no selo da empresa nas vagas e no feed.">
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => set({ cor: c })}
                aria-label={`Cor ${c}`}
                className={cn(
                  "h-9 w-9 rounded-lg transition",
                  f.cor === c ? "ring-2 ring-gold-400 ring-offset-2" : "hover:scale-105"
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </Card>

      <Card>
        <CamposEndereco
          valor={endereco}
          aoMudar={(p) => { setEndereco((v) => ({ ...v, ...p })); setSalvo(false); }}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <Check size={15} /> Cadastro salvo
          </span>
        )}
        <Button variant="gold" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar cadastro
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-navy-100 bg-cream/50 px-4 py-3 text-xs leading-relaxed text-muted">
        <Building2 size={14} className="mt-0.5 shrink-0 text-gold-500" />
        O logotipo ainda não é enviável por aqui — a marca aparece como um selo com a cor
        escolhida e as iniciais. Envio de arquivo entra junto com a personalização do
        certificado por empresa.
      </p>
    </div>
  );
}
