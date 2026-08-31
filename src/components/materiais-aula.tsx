"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, FileSpreadsheet, FileText, Image as IconeImagem, Link2, Loader2,
  Paperclip, Plus, Presentation, Trash2, Upload,
} from "lucide-react";
import { Field, cn, inputCls } from "@/components/ui";
import {
  LIMITE_MATERIAL_BYTES, ROTULO_TIPO, apagarMaterial, enviarMaterial,
  materiaisDaAula, salvarMaterial, tamanhoLegivel, tipoPeloNome, urlDoMaterial,
  type Material, type TipoMaterial,
} from "@/lib/materiais";

/* ==========================================================================
   MATERIAIS DA AULA

   O mesmo módulo serve aos dois lados: `EditorMateriais` no admin e
   `ListaMateriais` na aula. Compartilhar o ícone e o rótulo aqui evita o caso
   clássico de a planilha aparecer como "Planilha" para o admin e "Arquivo"
   para o aluno.
   ========================================================================== */

export function IconeMaterial({
  tipo, size = 18, className,
}: {
  tipo: TipoMaterial; size?: number; className?: string;
}) {
  const Comp =
    tipo === "planilha" ? FileSpreadsheet
    : tipo === "imagem" ? IconeImagem
    : tipo === "slide" ? Presentation
    : tipo === "link" ? Link2
    : FileText;
  return <Comp size={size} className={className} />;
}

/* ------------------------------------------------------------- aluno ----- */

export function ListaMateriais({ aulaId }: { aulaId: string }) {
  const [itens, setItens] = useState<Material[] | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    materiaisDaAula(aulaId).then((m) => { if (ativo) setItens(m); });
    return () => { ativo = false; };
  }, [aulaId]);

  async function baixar(m: Material) {
    setBaixando(m.id);
    const url = await urlDoMaterial(m);
    setBaixando(null);
    if (!url) return;
    // O bucket é privado: a URL assinada vale uma hora e é gerada no clique,
    // não na renderização — assim ela não vaza no HTML da página.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (itens === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" /> Carregando materiais…
      </p>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-navy-200 bg-cream/40 p-5 text-center sm:p-6">
        <Paperclip size={22} className="mx-auto text-navy-300" />
        <p className="mt-2.5 text-sm font-semibold text-navy-700">
          Esta aula ainda não tem material de apoio
        </p>
        <p className="mt-1 text-xs text-muted">
          Quando o instrutor anexar slides, planilhas ou checklists, eles aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {itens.map((m) => (
        <button
          key={m.id}
          onClick={() => baixar(m)}
          disabled={baixando === m.id}
          className="flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3.5 text-left transition hover:border-gold-300 hover:bg-gold-50/40 disabled:opacity-60"
        >
          <IconeMaterial tipo={m.tipo} className="shrink-0 text-gold-500" />
          <div className="min-w-0 flex-1">
            {/* O nome do arquivo dividia ~160px com o ícone e a seta de
                download: "Planilha de apuração do Simples" virava "Planilha
                de apu…". Agora quebra em duas linhas. */}
            <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-navy-700">{m.titulo}</p>
            <p className="line-clamp-2 text-xs leading-snug text-muted">
              {ROTULO_TIPO[m.tipo]}
              {m.bytes ? ` · ${tamanhoLegivel(m.bytes)}` : ""}
              {m.descricao ? ` · ${m.descricao}` : ""}
            </p>
          </div>
          {baixando === m.id ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-gold-500" />
          ) : (
            <Download size={16} className="shrink-0 text-muted" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- admin ----- */

export function EditorMateriais({
  aulaId,
  cursoSlug,
  garantirAula,
}: {
  /** Vazio enquanto a aula ainda não foi criada. */
  aulaId?: string;
  cursoSlug: string;
  /** Cria a aula sob demanda e devolve o id — igual ao upload de vídeo. */
  garantirAula: () => Promise<string | null>;
}) {
  const [itens, setItens] = useState<Material[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [formLink, setFormLink] = useState(false);
  const [linkTitulo, setLinkTitulo] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const inputArquivo = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async (id: string) => {
    setCarregando(true);
    setItens(await materiaisDaAula(id));
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (aulaId) void recarregar(aulaId);
  }, [aulaId, recarregar]);

  async function subir(arquivo: File) {
    setErro("");
    setEnviando(true);

    const id = aulaId ?? (await garantirAula());
    if (!id) {
      setEnviando(false);
      return setErro("Não consegui preparar a aula para receber o material.");
    }

    const r = await enviarMaterial(arquivo, cursoSlug, id);
    if (r.erro) {
      setEnviando(false);
      return setErro(r.erro);
    }

    const salvo = await salvarMaterial({
      aulaId: id,
      titulo: arquivo.name.replace(/\.[^.]+$/, ""),
      tipo: tipoPeloNome(arquivo.name),
      path: r.path,
      nomeArquivo: r.nome,
      bytes: r.bytes,
      ordem: itens.length,
    });
    setEnviando(false);
    if (!salvo.ok) return setErro(salvo.erro ?? "Falha ao registrar o material.");
    await recarregar(id);
  }

  async function adicionarLink() {
    setErro("");
    if (!linkTitulo.trim() || !linkUrl.trim()) {
      return setErro("O link precisa de um título e de um endereço.");
    }
    const id = aulaId ?? (await garantirAula());
    if (!id) return setErro("Não consegui preparar a aula para receber o material.");

    const salvo = await salvarMaterial({
      aulaId: id,
      titulo: linkTitulo.trim(),
      tipo: "link",
      url: linkUrl.trim(),
      ordem: itens.length,
    });
    if (!salvo.ok) return setErro(salvo.erro ?? "Falha ao salvar o link.");
    setLinkTitulo("");
    setLinkUrl("");
    setFormLink(false);
    await recarregar(id);
  }

  async function remover(m: Material) {
    const e = await apagarMaterial(m);
    if (e) return setErro(e);
    setItens((l) => l.filter((x) => x.id !== m.id));
  }

  async function renomear(m: Material, titulo: string) {
    setItens((l) => l.map((x) => (x.id === m.id ? { ...x, titulo } : x)));
    await salvarMaterial({ ...m, titulo });
  }

  return (
    <div className="rounded-xl border border-navy-100 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
            <Paperclip size={15} className="text-gold-500" /> Materiais de apoio
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            PDF, planilha, slides, checklist. O aluno baixa na aba
            <strong className="text-navy-700"> Materiais</strong> da aula.
            Até {LIMITE_MATERIAL_BYTES / 1024 / 1024} MB por arquivo — acima disso, use um link.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
          <input
            ref={inputArquivo}
            type="file"
            className="hidden"
            onChange={(e) => {
              const a = e.target.files?.[0];
              if (a) void subir(a);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputArquivo.current?.click()}
            disabled={enviando}
            className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-1.5 rounded-full border border-navy-200 px-3.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600 disabled:opacity-50 sm:min-w-0 sm:flex-none"
          >
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {enviando ? "Enviando…" : "Enviar arquivo"}
          </button>
          <button
            type="button"
            onClick={() => setFormLink((v) => !v)}
            className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-1.5 rounded-full border border-navy-200 px-3.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600 sm:min-w-0 sm:flex-none"
          >
            <Link2 size={13} /> Adicionar link
          </button>
        </div>
      </div>

      {formLink && (
        <div className="mt-4 grid gap-3 rounded-xl bg-cream/60 p-3.5 sm:grid-cols-[1fr_1.4fr_auto]">
          <Field label="Título">
            <input
              value={linkTitulo}
              onChange={(e) => setLinkTitulo(e.target.value)}
              placeholder="Planilha de apuração"
              className={inputCls}
            />
          </Field>
          <Field label="Endereço">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void adicionarLink()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-600 sm:w-auto"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {erro}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {carregando && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={13} className="animate-spin" /> Carregando…
          </p>
        )}

        {!carregando && itens.length === 0 && (
          <p className="rounded-lg border border-dashed border-navy-200 px-3 py-4 text-center text-xs text-muted">
            Nenhum material anexado ainda.
          </p>
        )}

        {itens.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-navy-100 bg-white p-2.5"
            )}
          >
            <IconeMaterial tipo={m.tipo} size={16} className="shrink-0 text-gold-500" />
            {/* O tipo e o tamanho dividiam a linha com o campo do título e
                sobravam uns 70px para digitar. No celular eles descem. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <input
                value={m.titulo}
                onChange={(e) => void renomear(m, e.target.value)}
                className="w-full min-w-0 border-none bg-transparent p-0 text-sm font-semibold text-navy-700 outline-none focus:underline sm:w-auto sm:flex-1"
              />
              <span className="shrink-0 text-[11px] text-muted">
                {ROTULO_TIPO[m.tipo]}
                {m.bytes ? ` · ${tamanhoLegivel(m.bytes)}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void remover(m)}
              title="Remover material"
              className="shrink-0 text-muted transition hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
