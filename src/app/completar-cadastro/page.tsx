"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  AlertCircle, ArrowRight, BadgeCheck, Building2, Loader2, MapPin, Phone,
  Sparkles, User,
} from "lucide-react";
import { Button, Field, Logo, cn, inputCls } from "@/components/ui";
import {
  CamposEndereco, enderecoVazio, mascararCep, type Endereco,
} from "@/components/campos-endereco";
import { useSession } from "@/lib/session";
import type { Perfil } from "@/lib/types";

/* ==========================================================================
   TERMINAR DE CRIAR A CONTA

   Quem entra pelo Google chega aqui com nome e foto e mais nada: o Google não
   dá telefone, não dá cidade e nunca pediu aceite de termos. Quem entra por
   e-mail chega no mesmo lugar, pelo mesmo motivo — é uma tela só, depois do
   "sim", em vez de um formulário longo antes dele.

   A regra de quem passa por aqui é uma coluna: `perfis.cadastro_completo`.
   Ela nasce `false` no gatilho `handle_new_user` e vira `true` no botão do
   fim desta tela. O AppShell só olha para ela.
   ========================================================================== */

const SENIORIDADES: NonNullable<Perfil["senioridade"]>[] = [
  "Estagiário", "Júnior", "Pleno", "Sênior", "Especialista",
];


/** (75) 99999-9999 — o formato que a equipe usa para abrir o WhatsApp. */
function mascararTelefone(bruto: string) {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompletarCadastro />
    </Suspense>
  );
}

function CompletarCadastro() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, atualizarPerfil } = useSession();
  const destino = params.get("destino") || "/app";

  const empresa = user?.role === "empresa";

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState<Endereco>(enderecoVazio);
  const [senioridade, setSenioridade] = useState<Perfil["senioridade"]>(undefined);
  const [cargo, setCargo] = useState("");
  const [crc, setCrc] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Preenche com o que já existe — vindo do Google ou de um cadastro parado no
  // meio. Ninguém deve redigitar o que a plataforma já sabe.
  useEffect(() => {
    if (!user) return;
    setNome((v) => v || user.nome || "");
    setTelefone((v) => v || (user.telefone ? mascararTelefone(user.telefone) : ""));
    setEndereco((e) => ({
      cep: e.cep || mascararCep(user.cep ?? ""),
      logradouro: e.logradouro || user.logradouro || "",
      bairro: e.bairro || user.bairro || "",
      cidade: e.cidade || user.cidade || "",
      uf: e.uf || user.uf || "",
      numero: e.numero || user.numero || "",
      complemento: e.complemento || user.complemento || "",
    }));
    setSenioridade((v) => v ?? user.senioridade);
    setCargo((v) => v || user.cargo || "");
    setCrc((v) => v || user.crc || "");
    // Já aceitou uma vez: não pede de novo.
    setAceite((v) => v || Boolean(user.consentimentoEm));
  }, [user]);

  // Guardas de rota. Sem sessão, login. Com o cadastro já fechado, painel — a
  // tela não deve ficar acessível como um formulário solto.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.cadastroCompleto) router.replace(destino);
  }, [loading, user, router, destino]);

  const primeiroNome = useMemo(() => (user?.nome || "").split(" ")[0], [user?.nome]);
  const digitosTelefone = telefone.replace(/\D/g, "").length;

  if (loading || !user || user.cadastroCompleto) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-200 border-t-gold-400" />
      </div>
    );
  }

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (nome.trim().split(/\s+/).length < 2) {
      return setErro("Escreva o nome completo — é ele que sai impresso no certificado.");
    }
    if (digitosTelefone < 10) {
      return setErro("Informe um WhatsApp com DDD, no formato (75) 99999-9999.");
    }
    if (endereco.cep.replace(/\D/g, "").length !== 8) {
      return setErro("Informe o CEP — ele preenche o resto do endereço sozinho.");
    }
    if (!endereco.cidade.trim() || !endereco.uf.trim()) {
      return setErro("Não consegui resolver esse CEP. Preencha cidade e UF à mão.");
    }
    if (!endereco.numero.trim()) {
      return setErro("Informe o número do endereço.");
    }
    if (!empresa && !senioridade) {
      return setErro("Escolha o seu momento de carreira.");
    }
    if (!aceite) {
      return setErro("É preciso aceitar os termos e a política de privacidade.");
    }

    setSalvando(true);
    await atualizarPerfil({
      nome: nome.trim(),
      telefone,
      cep: endereco.cep,
      logradouro: endereco.logradouro.trim() || undefined,
      bairro: endereco.bairro.trim() || undefined,
      numero: endereco.numero.trim(),
      complemento: endereco.complemento.trim() || undefined,
      cidade: endereco.cidade.trim(),
      uf: endereco.uf.trim().toUpperCase(),
      ...(empresa ? {} : { senioridade, cargo: cargo.trim() || undefined, crc: crc.trim() || undefined }),
      // Marcado sempre: quem já tinha aceitado mantém a data original no banco
      // só se não reenviarmos — e reenviar aqui é o registro do aceite desta
      // tela, que é o que a LGPD pede.
      consentimentoEm: new Date().toISOString(),
      cadastroCompleto: true,
    });
    router.replace(destino);
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-navy-700">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-5">
          <Logo variant="light" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-700 text-gold-400">
            <Sparkles size={24} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
            {primeiroNome ? `Falta pouco, ${primeiroNome}` : "Falta pouco"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {empresa
              ? "Só os dados de contato da empresa e a conta está pronta. O endereço vem pronto pelo CEP."
              : "Menos de um minuto. É o que usamos para emitir o seu certificado e recomendar as vagas certas — o endereço vem pronto pelo CEP."}
          </p>
        </div>

        <form
          onSubmit={finalizar}
          className="mt-8 space-y-7 rounded-2xl border border-navy-100 bg-white p-6 sm:p-8"
        >
          {/* ------------------------------------------------ identificação */}
          <div className="space-y-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
              <User size={14} className="text-gold-500" />
              {empresa ? "Dados da empresa" : "Seus dados"}
            </p>

            <Field
              label={empresa ? "Razão social" : "Nome completo"}
              hint={
                empresa
                  ? undefined
                  : "É exatamente assim que ele vai aparecer no certificado."
              }
            >
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Maria Silva Santos"
                autoComplete="name"
                className={inputCls}
              />
            </Field>

            <Field label="WhatsApp" hint="Só a equipe da Castelo Branco vê este número.">
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(75) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </Field>

          </div>

          {/* ------------------------------------------------------ endereço */}
          <div className="space-y-5 border-t border-navy-100 pt-7">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
              <MapPin size={14} className="text-gold-500" /> Endereço
            </p>
            <CamposEndereco
              valor={endereco}
              aoMudar={(patch) => setEndereco((e) => ({ ...e, ...patch }))}
              obrigatorio
              compacto
            />
          </div>

          {/* ------------------------------------------------------ carreira */}
          {!empresa && (
            <div className="space-y-5 border-t border-navy-100 pt-7">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
                <BadgeCheck size={14} className="text-gold-500" /> Seu momento
              </p>

              <Field
                label="Onde você está hoje"
                hint="Define as trilhas e as vagas que aparecem primeiro para você."
              >
                <div className="flex flex-wrap gap-2">
                  {SENIORIDADES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSenioridade(s)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-semibold transition",
                        senioridade === s
                          ? "border-gold-400 bg-gold-50 text-gold-700"
                          : "border-navy-100 bg-white text-navy-600 hover:border-navy-200"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cargo atual" hint="Opcional.">
                  <input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Analista fiscal"
                    className={inputCls}
                  />
                </Field>
                <Field label="CRC" hint="Opcional. Para a pontuação PEPC.">
                  <input
                    value={crc}
                    onChange={(e) => setCrc(e.target.value.toUpperCase())}
                    placeholder="BA-123456/O-1"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- aceite */}
          <div className="border-t border-navy-100 pt-7">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
              />
              <span>
                Li e aceito os{" "}
                <span className="font-semibold text-navy-700">Termos de Uso</span> e a{" "}
                <span className="font-semibold text-navy-700">Política de Privacidade</span>,
                incluindo o tratamento dos meus dados conforme a LGPD.
              </span>
            </label>

            {erro && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
              </p>
            )}

            <div className="mt-5">
              <Button type="submit" variant="gold" size="lg" full disabled={salvando}>
                {salvando ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvando…</>
                ) : (
                  <>Finalizar cadastro <ArrowRight size={16} /></>
                )}
              </Button>
            </div>
          </div>
        </form>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
          {empresa ? <Building2 size={13} /> : <User size={13} />}
          Conectado como {user.email}
        </p>
      </main>
    </div>
  );
}
