"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, PencilLine } from "lucide-react";
import { Field, cn, inputCls } from "@/components/ui";

/* ==========================================================================
   ENDEREÇO PELO CEP

   Digitar cidade e estado à mão gera "Feira de santana", "feira", "FSA" e
   "Bahia" no campo de UF — quatro grafias para o mesmo lugar, que depois
   estragam qualquer filtro do banco de talentos.

   Aqui a pessoa digita oito dígitos e o resto chega pronto. Só o número e o
   complemento continuam sendo dela, porque nenhuma base de CEP sabe disso.

   Os campos preenchidos ficam bloqueados, mas há um "corrigir à mão": CEP de
   loteamento novo ou de rua recém-nomeada volta errado, e travar a pessoa
   nesse caso seria pior do que a grafia solta.
   ========================================================================== */

export interface Endereco {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  complemento: string;
}

export const enderecoVazio: Endereco = {
  cep: "", logradouro: "", bairro: "", cidade: "", uf: "",
  numero: "", complemento: "",
};

/** 00000-000 */
export function mascararCep(bruto: string) {
  const d = (bruto ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function CamposEndereco({
  valor,
  aoMudar,
  obrigatorio,
  compacto,
}: {
  valor: Endereco;
  aoMudar: (patch: Partial<Endereco>) => void;
  /** Marca CEP e número como exigidos pelo formulário. */
  obrigatorio?: boolean;
  /** Esconde o rótulo da seção — para quando a tela já tem um. */
  compacto?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [achou, setAchou] = useState(false);
  const [manual, setManual] = useState(false);
  const numeroRef = useRef<HTMLInputElement>(null);
  const ultimoBuscado = useRef("");

  const digitos = valor.cep.replace(/\D/g, "");

  // Um endereço que já veio do banco não deve reabrir para edição só porque a
  // tela montou: se cidade e UF existem, o CEP já foi resolvido alguma vez.
  useEffect(() => {
    if (valor.cidade && valor.uf) setAchou(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (digitos.length !== 8 || digitos === ultimoBuscado.current) return;
    ultimoBuscado.current = digitos;

    let ativo = true;
    setBuscando(true);
    setErro("");

    fetch(`/api/cep?cep=${digitos}`)
      .then((r) => r.json())
      .then((d: Partial<Endereco> & { erro?: string }) => {
        if (!ativo) return;
        if (d.erro) {
          setErro(d.erro);
          setAchou(false);
          return;
        }
        aoMudar({
          logradouro: d.logradouro ?? "",
          bairro: d.bairro ?? "",
          cidade: d.cidade ?? "",
          uf: d.uf ?? "",
        });
        setAchou(true);
        // O cursor vai direto para o único campo que falta.
        setTimeout(() => numeroRef.current?.focus(), 60);
      })
      .catch(() => { if (ativo) setErro("Não consegui consultar o CEP agora."); })
      .finally(() => { if (ativo) setBuscando(false); });

    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitos]);

  const travado = achou && !manual;

  return (
    <div className="space-y-4">
      {!compacto && (
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
          <MapPin size={14} className="text-gold-500" /> Endereço
        </p>
      )}

      {/* O CEP fica com a linha inteira no celular: em meia linha, os oito
          dígitos disputavam espaço com o sinal de busca e apareciam cortados. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[180px_1fr] sm:gap-4">
        <Field
          label="CEP"
          hint={obrigatorio ? undefined : "Opcional."}
          className="col-span-2 sm:col-span-1"
        >
          <div className="relative">
            <input
              required={obrigatorio}
              value={valor.cep}
              onChange={(e) => {
                aoMudar({ cep: mascararCep(e.target.value) });
                setErro("");
              }}
              placeholder="44000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              className={cn(inputCls, "pr-10 font-mono")}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {buscando && <Loader2 size={15} className="animate-spin text-gold-500" />}
              {!buscando && achou && <Check size={15} className="text-emerald-500" />}
            </span>
          </div>
        </Field>

        <Field label="Rua / avenida" className="col-span-2 sm:col-span-1">
          <input
            value={valor.logradouro}
            onChange={(e) => aoMudar({ logradouro: e.target.value })}
            readOnly={travado}
            placeholder={buscando ? "Buscando…" : "Preenchido pelo CEP"}
            className={cn(inputCls, travado && "bg-cream/70 font-medium text-navy-700")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[140px_1fr] sm:gap-4">
        <Field label="Número">
          <input
            ref={numeroRef}
            required={obrigatorio}
            value={valor.numero}
            onChange={(e) => aoMudar({ numero: e.target.value })}
            placeholder="123"
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="Complemento" hint="Opcional — apartamento, bloco, sala.">
          <input
            value={valor.complemento}
            onChange={(e) => aoMudar({ complemento: e.target.value })}
            placeholder="Apto 402"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_72px] gap-3 sm:grid-cols-[1fr_1fr_90px] sm:gap-4">
        <Field label="Bairro" className="col-span-2 sm:col-span-1">
          <input
            value={valor.bairro}
            onChange={(e) => aoMudar({ bairro: e.target.value })}
            readOnly={travado}
            placeholder="Preenchido pelo CEP"
            className={cn(inputCls, travado && "bg-cream/70 font-medium text-navy-700")}
          />
        </Field>
        <Field label="Cidade">
          <input
            required={obrigatorio}
            value={valor.cidade}
            onChange={(e) => aoMudar({ cidade: e.target.value })}
            readOnly={travado}
            placeholder="Preenchido pelo CEP"
            className={cn(inputCls, travado && "bg-cream/70 font-medium text-navy-700")}
          />
        </Field>
        <Field label="UF">
          <input
            required={obrigatorio}
            value={valor.uf}
            onChange={(e) => aoMudar({ uf: e.target.value.toUpperCase().slice(0, 2) })}
            readOnly={travado}
            placeholder="BA"
            className={cn(inputCls, "text-center uppercase", travado && "bg-cream/70 font-medium text-navy-700")}
          />
        </Field>
      </div>

      {erro && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {erro} Você pode preencher os campos manualmente.
        </p>
      )}

      {travado && (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-gold-600"
        >
          <PencilLine size={13} className="shrink-0" /> O endereço veio errado? Corrigir à mão
        </button>
      )}
    </div>
  );
}
