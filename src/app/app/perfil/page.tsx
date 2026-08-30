"use client";

import { useState } from "react";
import { Award, CheckCircle2, Eye, Medal, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Avatar, Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import {
  CamposEndereco, enderecoVazio, mascararCep, type Endereco,
} from "@/components/campos-endereco";
import { useSession } from "@/lib/session";
import { useDados } from "@/lib/dados";
import { LegendaSelos, PainelDeSelos, SeloTrilha } from "@/components/selos";

export default function PerfilPage() {
  const { user, atualizarPerfil } = useSession();
  const { minhasTrilhas, trilhas } = useDados();
  const [salvo, setSalvo] = useState(false);
  // O endereço fica em um estado à parte porque ele é preenchido por
  // consulta, não por digitação — ver `CamposEndereco`.
  const [endereco, setEndereco] = useState<Endereco>({
    ...enderecoVazio,
    cep: mascararCep(user?.cep ?? ""),
    logradouro: user?.logradouro ?? "",
    bairro: user?.bairro ?? "",
    cidade: user?.cidade ?? "",
    uf: user?.uf ?? "",
    numero: user?.numero ?? "",
    complemento: user?.complemento ?? "",
  });
  const [form, setForm] = useState({
    nome: user?.nome ?? "",
    cargo: user?.cargo ?? "",
    crc: user?.crc ?? "",
    bio: user?.bio ?? "",
    senioridade: user?.senioridade ?? "Pleno",
    pretensao: user?.pretensao ?? "",
    linkedin: user?.linkedin ?? "",
    telefone: user?.telefone ?? "",
    contatoPublico: user?.contatoPublico ?? true,
    disponivel: user?.disponivel ?? true,
  });

  const selos = user?.selos ?? [];
  const conquistados = selos.filter((s) => s.selo).length;

  const selosDeTrilha = minhasTrilhas.map((c) => {
    const t = trilhas.find((x) => x.slug === c.trilhaSlug);
    return {
      slug: c.trilhaSlug,
      nome: c.trilhaNome,
      cor: t?.cor ?? "#00204D",
      codigo: c.codigo,
      cargaHoraria: c.cargaHoraria,
      pontosPEPC: c.pontosPEPC,
      emitidoEm: c.emitidoEm,
      habilidades: (t?.habilidades ?? []).map((h) => h.nome),
    };
  });

  // O 78% fixo dizia a mesma coisa para o perfil vazio e para o completo.
  const criterios = [
    Boolean(form.bio),
    conquistados >= 3,
    Boolean(form.crc),
    Boolean(form.linkedin),
    Boolean(form.telefone),
    Boolean(form.cargo),
  ];
  const forca = Math.round((criterios.filter(Boolean).length / criterios.length) * 100);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvo(false);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    atualizarPerfil({
      ...form,
      senioridade: form.senioridade as never,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      bairro: endereco.bairro,
      numero: endereco.numero,
      complemento: endereco.complemento,
      cidade: endereco.cidade,
      uf: endereco.uf.toUpperCase(),
    });
    setSalvo(true);
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy-700">Meu perfil</h1>
        <p className="mt-1.5 text-sm text-muted">
          Este é o perfil que as empresas veem no banco de talentos.
        </p>
      </div>

      <form onSubmit={salvar} className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar nome={form.nome || "Aluno"} size={64} />
              <div>
                <Button variant="outline" size="sm">
                  <Upload size={14} /> Alterar foto
                </Button>
                <p className="mt-1.5 text-xs text-muted">JPG ou PNG, até 2 MB.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nome completo">
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Cargo atual">
                <input
                  value={form.cargo}
                  onChange={(e) => set("cargo", e.target.value)}
                  placeholder="Analista Fiscal"
                  className={inputCls}
                />
              </Field>
              <Field label="Registro CRC" hint="Opcional — exibe o selo de CRC ativo.">
                <input
                  value={form.crc}
                  onChange={(e) => set("crc", e.target.value)}
                  placeholder="BA-123456/O-1"
                  className={inputCls}
                />
              </Field>
              <Field label="Senioridade">
                <select
                  value={form.senioridade}
                  onChange={(e) => set("senioridade", e.target.value as never)}
                  className={inputCls}
                >
                  {["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Resumo profissional" hint="2 a 3 linhas. É o que aparece no card de busca.">
              <textarea
                rows={4}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Ex.: 5 anos em departamento fiscal de transportadoras…"
                className={inputCls}
              />
            </Field>

            {/* Cidade e UF saíram do formulário livre: agora vêm do CEP, o que
                acaba com as quatro grafias da mesma cidade no banco de
                talentos. O endereço completo nunca é público — só cidade/UF
                aparecem no perfil. */}
            <div className="mt-6 border-t border-navy-100 pt-6">
              <CamposEndereco
                valor={endereco}
                aoMudar={(patch) => setEndereco((e) => ({ ...e, ...patch }))}
              />
              <p className="mt-3 text-xs text-muted">
                Das informações acima, só cidade e estado aparecem no seu perfil
                público. Rua, número e complemento ficam com a Castelo Branco.
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                  <Medal size={15} className="text-gold-500" /> Selos de habilidade
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Você não escolhe mais: cada curso concluído concede a habilidade
                  dele, no metal do nível do curso. É o que dá peso ao seu perfil na
                  busca das empresas.
                </p>
              </div>
              {conquistados > 0 && <Badge tone="gold">{conquistados} conquistados</Badge>}
            </div>

            <div className="mt-4">
              <PainelDeSelos
                selos={selos}
                vazio="Nenhum selo ainda. Conclua um curso e o primeiro aparece aqui automaticamente."
              />
            </div>

            <LegendaSelos className="mt-5 border-t border-navy-100 pt-4" />
          </Card>

          {selosDeTrilha.length > 0 && (
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-bold text-navy-700">
                <Award size={15} className="text-gold-500" /> Certificações de trilha
              </h2>
              <p className="mt-1 text-xs text-muted">
                Visíveis para colegas e recrutadores no seu perfil público.
              </p>
              <div className="mt-4 space-y-3">
                {selosDeTrilha.map((t) => (
                  <SeloTrilha key={t.slug} selo={t} />
                ))}
              </div>
            </Card>
          )}

          <Card className="space-y-5">
            <h2 className="text-sm font-bold text-navy-700">Banco de talentos</h2>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4">
              <input
                type="checkbox"
                checked={form.disponivel}
                onChange={(e) => set("disponivel", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
              />
              <span>
                <span className="block text-sm font-semibold text-navy-700">
                  Quero aparecer para empresas
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Seu perfil fica visível na busca. Você pode desativar a qualquer momento.
                </span>
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Pretensão salarial">
                <input
                  value={form.pretensao}
                  onChange={(e) => set("pretensao", e.target.value)}
                  placeholder="R$ 6.000 – R$ 7.500"
                  className={inputCls}
                />
              </Field>
              <Field label="LinkedIn">
                <input
                  value={form.linkedin}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/seu-perfil"
                  className={inputCls}
                />
              </Field>
              <Field
                label="WhatsApp / telefone"
                hint="Com DDD. É por aqui que a empresa chama para conversar."
              >
                <input
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                  placeholder="(75) 99999-0000"
                  className={inputCls}
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4">
              <input
                type="checkbox"
                checked={form.contatoPublico}
                onChange={(e) => set("contatoPublico", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
              />
              <span>
                <span className="block text-sm font-semibold text-navy-700">
                  Mostrar meu contato para quem abrir meu perfil
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  Aparecer no banco de talentos e entregar o telefone são decisões
                  diferentes. Desmarcado, a empresa só fala com você pela Academy.
                </span>
              </span>
            </label>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="gold" size="lg">
              <Save size={16} /> Salvar alterações
            </Button>
            {salvo && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 size={16} /> Perfil atualizado
              </span>
            )}
          </div>
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-700">Força do perfil</h3>
              <Badge tone="gold">{forca}%</Badge>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy-100">
              <div
                className="gold-gradient h-full rounded-full transition-all"
                style={{ width: `${forca}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                ["Foto de perfil", true],
                ["Resumo profissional", Boolean(form.bio)],
                ["Selos de habilidade (mín. 3)", conquistados >= 3],
                ["Registro CRC", Boolean(form.crc)],
                ["LinkedIn conectado", Boolean(form.linkedin)],
              ].map(([label, ok]) => (
                <li key={label as string} className="flex items-center gap-2 text-sm">
                  <CheckCircle2
                    size={15}
                    className={ok ? "text-emerald-500" : "text-navy-200"}
                  />
                  <span className={ok ? "text-muted line-through" : "text-ink"}>
                    {label as string}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">Pré-visualização</h3>
            <p className="mt-1 text-xs text-muted">Como as empresas veem você.</p>
            <div className="mt-4 rounded-xl border border-navy-100 p-4">
              <div className="flex items-center gap-3">
                <Avatar nome={form.nome || "Aluno"} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy-700">{form.nome || "Seu nome"}</p>
                  <p className="truncate text-xs text-muted">
                    {form.cargo || "Seu cargo"} · {endereco.cidade || "Cidade"}/{endereco.uf || "UF"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="navy">{form.senioridade}</Badge>
                {form.crc && <Badge tone="teal">CRC ativo</Badge>}
                {form.disponivel && <Badge tone="green">Disponível</Badge>}
              </div>
            </div>
            <Button href="/app/talentos" variant="outline" size="sm" full className="mt-4">
              <Eye size={14} /> Ver no banco de talentos
            </Button>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <ShieldCheck size={15} className="text-gold-500" /> Privacidade e LGPD
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Você controla quem vê seus dados. Pode exportar tudo o que temos sobre você
              ou solicitar a exclusão completa da conta.
            </p>
            <div className="mt-4 space-y-2">
              <Button variant="outline" size="sm" full>Exportar meus dados</Button>
              <Button variant="ghost" size="sm" full className="!text-red-600 hover:!bg-red-50">
                <Trash2 size={14} /> Excluir minha conta
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
