"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot, Check, FileVideo, Link2, Loader2, PenLine, Plus, Sparkles, Trash2, Upload,
  Youtube,
} from "lucide-react";
import { Badge, Button, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro, Modal } from "@/components/modal";
import {
  definirHabilidadesDoCurso, enviarAssinaturaDocente, gerarSlug, habilidadesDoCurso,
  listarHabilidades, questoesDaAula, salvarAula, salvarCurso, salvarModulo,
  salvarQuestoesDaAula,
  type CursoAdmin, type DadosAula, type DadosCurso,
} from "@/lib/repo-admin";
import {
  LIMITE_UPLOAD_BYTES, apagarVideo, detectarOrigem, enviarVideo, rotuloOrigem,
} from "@/lib/video";
import { EditorMateriais } from "@/components/materiais-aula";

// Mesmas categorias que já existem no catálogo — o filtro fica inútil se a
// lista da tela e a do banco não baterem.
/** Resposta de /api/video-info. */
interface InfoVideo {
  titulo?: string;
  canal?: string;
  thumb?: string;
  erro?: string;
}

export const CATEGORIAS = [
  "Tributário", "Setorial", "Formação", "Gestão", "Pessoal", "Ferramentas", "Contábil",
];
export const NIVEIS = ["Iniciante", "Intermediário", "Avançado"];
const CORES = ["#00204D", "#B88A45", "#2F6E75", "#1F4A7A", "#7A3E2F", "#3D5A3C"];

// O metal do selo é consequência do nível do curso — a mesma regra que roda
// em `selo_do_nivel()` no banco. Repetida aqui só para o admin ver antes.
const SELO_DO_NIVEL: Record<string, string> = {
  Iniciante: "bronze",
  "Intermediário": "prata",
  "Avançado": "ouro",
};

/* ==========================================================================
   1. CURSO
   ========================================================================== */
export function ModalCurso({
  curso,
  aoFechar,
  aoSalvar,
}: {
  curso?: CursoAdmin;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const editando = Boolean(curso);
  const [f, setF] = useState<DadosCurso>({
    id: curso?.id,
    slug: curso?.slug ?? "",
    titulo: curso?.titulo ?? "",
    subtitulo: curso?.subtitulo ?? "",
    descricao: curso?.descricao ?? "",
    categoria: curso?.categoria ?? CATEGORIAS[0],
    nivel: curso?.nivel ?? NIVEIS[0],
    cor: curso?.cor ?? CORES[0],
    instrutor: curso?.instrutor ?? "",
    instrutorCargo: curso?.instrutorCargo ?? "",
    instrutorRegistro: curso?.instrutorRegistro ?? "",
    instrutorAssinaturaUrl: curso?.instrutorAssinaturaUrl ?? "",
    cargaHoraria: curso?.cargaHoraria ?? 0,
    pontosPEPC: curso?.pontosPEPC ?? 0,
    tags: curso?.tags ?? [],
    destaque: curso?.destaque ?? false,
    publicado: curso?.publicado ?? false,
  });
  const [tagsTexto, setTagsTexto] = useState((curso?.tags ?? []).join(", "));
  const [catalogoHabs, setCatalogoHabs] = useState<Array<{ id: string; nome: string }>>([]);
  const [habs, setHabs] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Catálogo de habilidades e o que este curso já concede.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [cat, atuais] = await Promise.all([
        listarHabilidades(),
        curso?.id ? habilidadesDoCurso(curso.id) : Promise.resolve([]),
      ]);
      if (!vivo) return;
      setCatalogoHabs(cat);
      setHabs(atuais);
    })();
    return () => {
      vivo = false;
    };
  }, [curso?.id]);

  // O slug acompanha o título enquanto o curso é novo; depois de publicado
  // mudar a URL quebraria link já compartilhado.
  function mudarTitulo(titulo: string) {
    setF((v) => ({ ...v, titulo, slug: editando ? v.slug : gerarSlug(titulo) }));
  }

  async function submeter() {
    if (!f.titulo.trim()) return setErro("O título é obrigatório.");
    if (!f.slug.trim()) return setErro("O endereço (slug) é obrigatório.");
    // Quem concluir este curso recebe um certificado assinado por este nome.
    // Sem docente o documento sairia sem assinatura, então o campo é barreira.
    if (!f.instrutor.trim()) {
      return setErro(
        "Informe o docente que ministra o curso — é quem assina o certificado de conclusão."
      );
    }

    setSalvando(true);
    setErro("");
    const r = await salvarCurso({
      ...f,
      tags: tagsTexto.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (!r.ok) {
      setSalvando(false);
      return setErro(r.erro ?? "Não foi possível salvar.");
    }

    // As habilidades vão depois porque o curso novo só ganha id agora.
    if (r.dado) await definirHabilidadesDoCurso(r.dado, habs);

    setSalvando(false);
    aoSalvar();
  }

  return (
    <Modal
      titulo={editando ? "Editar curso" : "Novo curso"}
      subtitulo={editando ? curso!.slug : "Depois de criar, adicione os módulos e as aulas."}
      aoFechar={aoFechar}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar curso"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>

        <Field label="Título do curso">
          <input
            value={f.titulo}
            onChange={(e) => mudarTitulo(e.target.value)}
            placeholder="Ex.: Reforma Tributária na Prática"
            className={inputCls}
          />
        </Field>

        <Field label="Endereço (slug)" hint={`/app/cursos/${f.slug || "..."}`}>
          <input
            value={f.slug}
            onChange={(e) => setF((v) => ({ ...v, slug: gerarSlug(e.target.value) }))}
            className={inputCls}
          />
        </Field>

        <Field label="Subtítulo">
          <input
            value={f.subtitulo}
            onChange={(e) => setF((v) => ({ ...v, subtitulo: e.target.value }))}
            placeholder="Uma linha que explica o resultado prático"
            className={inputCls}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            rows={4}
            value={f.descricao}
            onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Categoria">
            <select
              value={f.categoria}
              onChange={(e) => setF((v) => ({ ...v, categoria: e.target.value }))}
              className={inputCls}
            >
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Nível">
            <select
              value={f.nivel}
              onChange={(e) => setF((v) => ({ ...v, nivel: e.target.value }))}
              className={inputCls}
            >
              {NIVEIS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Carga horária">
            <input
              type="number" min={0}
              value={f.cargaHoraria}
              onChange={(e) => setF((v) => ({ ...v, cargaHoraria: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Pontos PEPC" hint="Educação continuada do CFC" className="sm:max-w-[12rem]">
          <input
            type="number" min={0}
            value={f.pontosPEPC}
            onChange={(e) => setF((v) => ({ ...v, pontosPEPC: Number(e.target.value) }))}
            className={inputCls}
          />
        </Field>

        <BlocoDocente
          f={f}
          setF={setF}
          slug={f.slug}
          faltando={Boolean(erro) && !f.instrutor.trim()}
        />

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
            Habilidades concedidas
          </p>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Quem concluir este curso ganha estes selos no perfil e no banco de
            talentos, no metal do nível escolhido acima —{" "}
            <strong className="text-navy-700">{SELO_DO_NIVEL[f.nivel] ?? "ouro"}</strong>{" "}
            para {f.nivel}. Tirar uma habilidade daqui não retira o selo de quem
            já concluiu.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {catalogoHabs.map((h) => {
              const ativo = habs.includes(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() =>
                    setHabs((a) => (ativo ? a.filter((x) => x !== h.id) : [...a, h.id]))
                  }
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                    (ativo
                      ? "border-navy-700 bg-navy-700 text-white"
                      : "border-navy-100 text-muted hover:border-navy-200")
                  }
                >
                  {h.nome}
                </button>
              );
            })}
          </div>
          {habs.length === 0 && (
            <p className="mt-2.5 text-xs text-amber-700">
              Sem nenhuma marcada, o curso emite certificado mas não acrescenta
              nada ao perfil de quem o concluir.
            </p>
          )}
        </div>

        <Field label="Tags" hint="Separadas por vírgula. Aparecem na busca do catálogo.">
          <input
            value={tagsTexto}
            onChange={(e) => setTagsTexto(e.target.value)}
            placeholder="CBS, IBS, transição"
            className={inputCls}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
            Cor do curso
          </span>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setF((v) => ({ ...v, cor: c }))}
                className={cn(
                  "h-9 w-9 rounded-lg border-2 transition",
                  f.cor === c ? "border-gold-400 ring-2 ring-gold-400/30" : "border-transparent"
                )}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-navy-100 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={f.publicado}
              onChange={(e) => setF((v) => ({ ...v, publicado: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-[#C89F50]"
            />
            <span>
              <span className="block text-sm font-semibold text-navy-700">Publicado</span>
              <span className="mt-0.5 block text-xs text-muted">
                Desmarcado, o curso fica como rascunho: só a equipe enxerga.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={f.destaque}
              onChange={(e) => setF((v) => ({ ...v, destaque: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-[#C89F50]"
            />
            <span>
              <span className="block text-sm font-semibold text-navy-700">Destaque</span>
              <span className="mt-0.5 block text-xs text-muted">
                Aparece primeiro no catálogo e na página inicial.
              </span>
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

/**
 * O DOCENTE
 *
 * Ficava como dois campos soltos entre carga horária e pontos PEPC, com cara de
 * metadado opcional. Ele é a assinatura do certificado: quem concluir o curso
 * recebe um documento com este nome embaixo da linha. Por isso virou um bloco
 * com nome próprio, obrigatório, e com a prévia da assinatura ao lado — quem
 * cadastra vê o que vai sair impresso.
 */
function BlocoDocente({
  f, setF, slug, faltando,
}: {
  f: DadosCurso;
  setF: React.Dispatch<React.SetStateAction<DadosCurso>>;
  slug: string;
  faltando: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  async function escolher(arquivo?: File | null) {
    if (!arquivo) return;
    setErroEnvio("");
    setEnviando(true);
    const r = await enviarAssinaturaDocente(arquivo, slug);
    setEnviando(false);
    if (r.erro) return setErroEnvio(r.erro);
    setF((v) => ({ ...v, instrutorAssinaturaUrl: r.url ?? "" }));
  }

  return (
    <div className="rounded-xl border border-navy-100 bg-cream/40 p-4">
      <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
        <PenLine size={13} className="text-gold-500" /> Docente do curso
        <Badge tone="red">Obrigatório</Badge>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        É quem assina o certificado de quem concluir — e o nome que o RH vê ao
        validar o código. O registro (CRC) sai impresso sob a assinatura.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nome do docente" error={faltando ? "Preencha para salvar" : undefined}>
          <input
            value={f.instrutor}
            onChange={(e) => setF((v) => ({ ...v, instrutor: e.target.value }))}
            placeholder="Ex.: Joaquim Castelo Branco"
            className={cn(inputCls, faltando && "!border-red-300")}
          />
        </Field>
        <Field label="Cargo / titulação">
          <input
            value={f.instrutorCargo}
            onChange={(e) => setF((v) => ({ ...v, instrutorCargo: e.target.value }))}
            placeholder="Ex.: Contador · Especialista em Tributário"
            className={inputCls}
          />
        </Field>
        <Field label="Registro profissional" hint="Aparece no certificado, sob o nome.">
          <input
            value={f.instrutorRegistro ?? ""}
            onChange={(e) => setF((v) => ({ ...v, instrutorRegistro: e.target.value }))}
            placeholder="CRC BA-123456/O-1"
            className={inputCls}
          />
        </Field>

        <div>
          <p className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
            Imagem da assinatura
          </p>
          {f.instrutorAssinaturaUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-700 p-2.5">
              {/* Fundo navy porque é o fundo do certificado: assinatura escura
                  em cartão branco parece certa aqui e desaparece lá. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.instrutorAssinaturaUrl}
                alt="Assinatura do docente"
                className="h-10 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <button
                onClick={() => setF((v) => ({ ...v, instrutorAssinaturaUrl: "" }))}
                className="ml-auto rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                title="Remover a assinatura"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-white px-4 py-3 text-xs font-semibold text-navy-600 transition hover:border-gold-400 disabled:opacity-60"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {enviando ? "Enviando…" : "Enviar PNG da assinatura (opcional)"}
            </button>
          )}
          <input
            ref={arquivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void escolher(e.target.files?.[0])}
          />
          {erroEnvio && <p className="mt-1.5 text-xs text-red-600">{erroEnvio}</p>}
          {!f.instrutorAssinaturaUrl && !erroEnvio && (
            <p className="mt-1.5 text-xs text-muted">
              Sem imagem, o certificado assina em tipografia: o nome sobre a linha.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. MÓDULO
   ========================================================================== */
export function ModalModulo({
  cursoId,
  modulo,
  aoFechar,
  aoSalvar,
}: {
  cursoId: string;
  modulo?: { id: string; titulo: string; resumo?: string };
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [titulo, setTitulo] = useState(modulo?.titulo ?? "");
  const [resumo, setResumo] = useState(modulo?.resumo ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function submeter() {
    if (!titulo.trim()) return setErro("Dê um título ao módulo.");
    setSalvando(true);
    setErro("");
    const r = await salvarModulo({ id: modulo?.id, cursoId, titulo, resumo });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
    aoSalvar();
  }

  return (
    <Modal
      titulo={modulo ? "Editar módulo" : "Novo módulo"}
      aoFechar={aoFechar}
      largura="max-w-lg"
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvisoErro>{erro}</AvisoErro>
        <Field label="Título do módulo">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Fundamentos da apuração"
            className={inputCls}
          />
        </Field>
        <Field label="Resumo" hint="Uma linha sobre o que o aluno consegue fazer ao final.">
          <textarea
            rows={3}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ==========================================================================
   3. AULA — vídeo + avaliação
   ========================================================================== */
type AulaEdit = CursoAdmin["modulos"][number]["aulas"][number];

interface QuestaoForm {
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  explicacao?: string;
}

const LETRAS = ["a", "b", "c", "d"];

function questaoVazia(): QuestaoForm {
  return {
    enunciado: "",
    alternativas: LETRAS.map((id) => ({ id, texto: "" })),
    correta: "a",
    explicacao: "",
  };
}

export function ModalAula({
  cursoSlug,
  cursoTitulo,
  categoria,
  nivel,
  moduloId,
  moduloTitulo,
  aula,
  aoFechar,
  aoSalvar,
}: {
  cursoSlug: string;
  cursoTitulo: string;
  categoria: string;
  nivel: string;
  moduloId: string;
  moduloTitulo: string;
  aula?: AulaEdit;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const editando = Boolean(aula);

  const [f, setF] = useState<DadosAula>({
    id: aula?.id,
    moduloId,
    titulo: aula?.titulo ?? "",
    descricao: aula?.descricao ?? "",
    tipo: aula?.tipo ?? "video",
    duracaoMin: aula?.duracaoMin ?? 0,
    gratuita: aula?.gratuita ?? false,
    videoOrigem: aula?.videoOrigem ?? "nenhum",
    videoPath: aula?.videoPath ?? null,
    videoUrl: aula?.videoUrl ?? null,
    videoNome: aula?.videoNome ?? null,
    quizAtivo: aula?.quizAtivo ?? false,
    quizQtd: aula?.quizQtd ?? 3,
    quizMinimo: aula?.quizMinimo ?? 2,
    quizTentativas: aula?.quizTentativas ?? 2,
  });

  const [modoVideo, setModoVideo] = useState<"link" | "arquivo">(
    aula?.videoOrigem === "upload" ? "arquivo" : "link"
  );
  const [link, setLink] = useState(aula?.videoUrl ?? "");
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [pctUpload, setPctUpload] = useState(0);
  /** Título, canal e miniatura lidos do próprio link colado. */
  const [infoVideo, setInfoVideo] = useState<InfoVideo | null>(null);
  const [lendoInfo, setLendoInfo] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement | null>(null);

  /* questões ------------------------------------------------------------- */
  const [questoes, setQuestoes] = useState<QuestaoForm[]>([]);
  const [carregandoQuestoes, setCarregandoQuestoes] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [avisoIA, setAvisoIA] = useState("");
  const [questoesTocadas, setQuestoesTocadas] = useState(false);

  useEffect(() => {
    if (!aula?.id) return;
    setCarregandoQuestoes(true);
    questoesDaAula(aula.id)
      .then((r) => {
        if (r.dado?.length) {
          setQuestoes(
            r.dado.map((q) => ({
              enunciado: q.enunciado,
              alternativas: LETRAS.map(
                (id) => q.alternativas.find((a) => a.id === id) ?? { id, texto: "" }
              ),
              correta: q.correta ?? "a",
              explicacao: q.explicacao ?? "",
            }))
          );
        }
      })
      .finally(() => setCarregandoQuestoes(false));
  }, [aula?.id]);

  /* --------------------------------------------------------------- vídeo */

  // Assim que o link colado vira um endereço válido, o oEmbed devolve título,
  // canal e miniatura. Serve para duas coisas: confirmar visualmente que o
  // link é o vídeo certo e poupar a digitação do título da aula.
  useEffect(() => {
    const alvo = link.trim();
    if (!alvo || detectarOrigem(alvo) === "externo" || detectarOrigem(alvo) === "nenhum") {
      setInfoVideo(null);
      return;
    }
    let ativo = true;
    setLendoInfo(true);
    // Meio segundo de espera: sem isso a rota é chamada a cada tecla enquanto
    // a pessoa digita um link à mão.
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/video-info?url=${encodeURIComponent(alvo)}`);
        const d = (await r.json()) as InfoVideo;
        if (ativo) setInfoVideo(d);
      } catch {
        if (ativo) setInfoVideo(null);
      } finally {
        if (ativo) setLendoInfo(false);
      }
    }, 500);
    return () => { ativo = false; clearTimeout(t); };
  }, [link]);

  function escolherLink(valor: string) {
    setLink(valor);
    const origem = detectarOrigem(valor);
    setF((v) => ({
      ...v,
      videoOrigem: origem,
      videoUrl: valor.trim() || null,
      videoPath: null,
      videoNome: null,
    }));
  }

  /**
   * Devolve o id da aula, criando-a se ainda não existir.
   *
   * Vídeo e material precisam de um id para montar o caminho no storage. Sem
   * isto, quem anexa antes de salvar a aula produz arquivo órfão no bucket.
   */
  async function garantirAula(): Promise<string | null> {
    if (f.id) return f.id;
    const r = await salvarAula({ ...f, titulo: f.titulo || "Aula sem título", videoOrigem: f.videoOrigem ?? "nenhum" });
    if (!r.ok || !r.dado) {
      setErro(r.erro ?? "Não foi possível preparar a aula.");
      return null;
    }
    setF((v) => ({ ...v, id: r.dado }));
    return r.dado;
  }

  async function subirArquivo(arquivo: File) {
    setErro("");
    setEnviandoVideo(true);
    setPctUpload(0);

    let id = f.id;
    if (!id) {
      const r = await salvarAula({ ...f, titulo: f.titulo || arquivo.name, videoOrigem: "nenhum" });
      if (!r.ok || !r.dado) {
        setEnviandoVideo(false);
        return setErro(r.erro ?? "Não foi possível preparar a aula para receber o vídeo.");
      }
      id = r.dado;
      setF((v) => ({ ...v, id }));
    }

    const anterior = f.videoPath;
    const r = await enviarVideo(arquivo, cursoSlug, id, setPctUpload);
    setEnviandoVideo(false);

    if (r.erro) return setErro(r.erro);

    // Troca de arquivo com nome diferente deixaria o antigo ocupando o bucket.
    // São 1 GB no plano free: órfão aqui custa caro rápido.
    if (anterior && anterior !== r.path) await apagarVideo(anterior);

    setF((v) => ({
      ...v,
      videoOrigem: "upload",
      videoPath: r.path ?? null,
      videoNome: r.nome ?? null,
      videoBytes: r.bytes ?? null,
      videoUrl: null,
    }));
  }

  async function limparVideo() {
    if (f.videoPath) await apagarVideo(f.videoPath);
    setLink("");
    setF((v) => ({
      ...v, videoOrigem: "nenhum", videoPath: null, videoUrl: null, videoNome: null,
      videoBytes: null,
    }));
  }

  /* ------------------------------------------------------------ questões */
  async function gerarQuestoes() {
    if (!f.titulo.trim()) return setErro("Preencha o título da aula antes de gerar as questões.");
    setGerando(true);
    setErro("");
    setAvisoIA("");
    try {
      const resp = await fetch("/api/gerar-questoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: f.titulo,
          descricao: f.descricao,
          nivel,
          curso: cursoTitulo,
          modulo: moduloTitulo,
          categoria,
          quantidade: 5,
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados?.erro ?? "Falha ao gerar.");

      setQuestoes(
        (dados.questoes as QuestaoForm[]).map((q) => ({
          enunciado: q.enunciado,
          alternativas: LETRAS.map(
            (id) => q.alternativas.find((a) => a.id === id) ?? { id, texto: "" }
          ),
          correta: q.correta,
          explicacao: q.explicacao ?? "",
        }))
      );
      setQuestoesTocadas(true);
      setF((v) => ({ ...v, quizAtivo: true }));
      if (dados.aviso) setAvisoIA(dados.aviso);
      else if (dados.fonte === "n8n") setAvisoIA("Geradas pelo fluxo do n8n. Revise antes de salvar.");
      else setAvisoIA("Geradas por IA. Revise antes de salvar — a responsabilidade técnica é da escola.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar as questões.");
    } finally {
      setGerando(false);
    }
  }

  function editarQuestao(i: number, patch: Partial<QuestaoForm>) {
    setQuestoesTocadas(true);
    setQuestoes((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }

  function editarAlternativa(i: number, letra: string, texto: string) {
    setQuestoesTocadas(true);
    setQuestoes((qs) =>
      qs.map((q, j) =>
        j === i
          ? { ...q, alternativas: q.alternativas.map((a) => (a.id === letra ? { ...a, texto } : a)) }
          : q
      )
    );
  }

  /* -------------------------------------------------------------- salvar */
  async function submeter() {
    if (!f.titulo.trim()) return setErro("O título da aula é obrigatório.");

    const validas = questoes.filter(
      (q) => q.enunciado.trim() && q.alternativas.filter((a) => a.texto.trim()).length >= 2
    );

    if (f.quizAtivo && validas.length < f.quizQtd) {
      return setErro(
        `A avaliação sorteia ${f.quizQtd} questões, mas só ${validas.length} estão completas. Gere ou escreva mais.`
      );
    }
    if (f.quizMinimo > f.quizQtd) {
      return setErro("A nota mínima não pode ser maior que o número de questões sorteadas.");
    }

    setSalvando(true);
    setErro("");

    const r = await salvarAula(f);
    if (!r.ok || !r.dado) {
      setSalvando(false);
      return setErro(r.erro ?? "Não foi possível salvar a aula.");
    }

    if (questoesTocadas) {
      const rq = await salvarQuestoesDaAula(
        r.dado,
        validas.map((q) => ({
          enunciado: q.enunciado.trim(),
          alternativas: q.alternativas.filter((a) => a.texto.trim()),
          correta: q.correta,
          explicacao: q.explicacao?.trim() || undefined,
        })),
        Boolean(avisoIA)
      );
      if (!rq.ok) {
        setSalvando(false);
        return setErro(`A aula foi salva, mas as questões não: ${rq.erro}`);
      }
    }

    setSalvando(false);
    aoSalvar();
  }

  const completas = questoes.filter(
    (q) => q.enunciado.trim() && q.alternativas.filter((a) => a.texto.trim()).length >= 2
  ).length;

  return (
    <Modal
      titulo={editando ? "Editar aula" : "Nova aula"}
      subtitulo={`${cursoTitulo} · ${moduloTitulo}`}
      aoFechar={aoFechar}
      largura="max-w-3xl"
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="gold" onClick={submeter} disabled={salvando || enviandoVideo}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar aula"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <AvisoErro>{erro}</AvisoErro>

        {/* ---------------------------------------------------- dados --- */}
        <div className="space-y-5">
          <Field label="Título da aula">
            <input
              value={f.titulo}
              onChange={(e) => setF((v) => ({ ...v, titulo: e.target.value }))}
              placeholder="Ex.: Por que o sistema atual quebrou"
              className={inputCls}
            />
          </Field>

          <Field
            label="Descrição"
            hint="É esta descrição que a IA lê para gerar as questões. Quanto mais concreta, melhor a prova."
          >
            <textarea
              rows={3}
              value={f.descricao}
              onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
              className={inputCls}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Tipo">
              <select
                value={f.tipo}
                onChange={(e) => setF((v) => ({ ...v, tipo: e.target.value }))}
                className={inputCls}
              >
                <option value="video">Vídeo-aula</option>
                <option value="quiz">Avaliação</option>
                <option value="material">Material</option>
                <option value="ao-vivo">Ao vivo</option>
              </select>
            </Field>
            <Field label="Duração (min)">
              <input
                type="number" min={0}
                value={f.duracaoMin}
                onChange={(e) => setF((v) => ({ ...v, duracaoMin: Number(e.target.value) }))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end pb-2.5">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={f.gratuita}
                  onChange={(e) => setF((v) => ({ ...v, gratuita: e.target.checked }))}
                  className="h-4 w-4 accent-[#C89F50]"
                />
                <span className="text-sm font-semibold text-navy-700">Aula gratuita</span>
              </label>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- vídeo --- */}
        <div className="rounded-xl border border-navy-100 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-navy-600">Vídeo</p>
            <div className="flex rounded-full border border-navy-100 p-0.5">
              {([["link", "Link", Youtube], ["arquivo", "Arquivo", Upload]] as const).map(
                ([k, rotulo, Icone]) => (
                  <button
                    key={k}
                    onClick={() => setModoVideo(k)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                      modoVideo === k ? "bg-navy-700 text-white" : "text-muted hover:text-navy-700"
                    )}
                  >
                    <Icone size={12} /> {rotulo}
                  </button>
                )
              )}
            </div>
          </div>

          {f.videoOrigem !== "nenhum" && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <Check size={15} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate text-xs text-emerald-800">
                {rotuloOrigem(f.videoOrigem as never)}:{" "}
                {f.videoNome ?? f.videoUrl ?? f.videoPath}
              </span>
              <button
                onClick={() => void limparVideo()}
                className="shrink-0 text-emerald-700 transition hover:text-red-600"
                title="Remover vídeo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {modoVideo === "link" ? (
            <Field
              label="Link do vídeo"
              hint="Cole o link do YouTube (pode ser “não listado”) ou do Vimeo. É a opção recomendada: sem limite de tamanho e sem custo."
            >
              <div className="relative">
                <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={link}
                  onChange={(e) => escolherLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={inputCls + " pl-10"}
                />
              </div>

              {lendoInfo && (
                <p className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                  <Loader2 size={13} className="animate-spin" /> Lendo o vídeo…
                </p>
              )}

              {!lendoInfo && infoVideo?.erro && (
                <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {infoVideo.erro}
                </p>
              )}

              {!lendoInfo && infoVideo?.titulo && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-navy-100 bg-cream/60 p-3">
                  {infoVideo.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={infoVideo.thumb}
                      alt=""
                      className="h-14 w-24 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-700">
                      {infoVideo.titulo}
                    </p>
                    {infoVideo.canal && (
                      <p className="mt-0.5 text-xs text-muted leading-snug">{infoVideo.canal}</p>
                    )}
                  </div>
                  {f.titulo !== infoVideo.titulo && (
                    <button
                      type="button"
                      onClick={() => setF((v) => ({ ...v, titulo: infoVideo.titulo! }))}
                      className="shrink-0 rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-gold-400 hover:text-gold-600"
                    >
                      Usar como título
                    </button>
                  )}
                </div>
              )}
            </Field>
          ) : (
            <div>
              <input
                ref={inputArquivo}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const arq = e.target.files?.[0];
                  if (arq) void subirArquivo(arq);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => inputArquivo.current?.click()}
                disabled={enviandoVideo}
                className="w-full rounded-xl border-2 border-dashed border-navy-200 bg-cream/50 p-6 text-center transition hover:border-gold-400 disabled:opacity-60 sm:p-8"
              >
                {enviandoVideo ? (
                  <>
                    <Loader2 size={26} className="mx-auto animate-spin text-gold-500" />
                    <p className="mt-3 text-sm font-semibold text-navy-700">Enviando… {pctUpload}%</p>
                  </>
                ) : (
                  <>
                    <FileVideo size={26} className="mx-auto text-gold-400" />
                    <p className="mt-3 text-sm font-semibold text-navy-700">
                      Clique para escolher o arquivo
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      MP4, WebM ou MOV até {LIMITE_UPLOAD_BYTES / 1024 / 1024} MB — teto do plano
                      free do Supabase. Vídeo maior, use o link.
                    </p>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------- materiais --- */}
        <EditorMateriais
          aulaId={f.id}
          cursoSlug={cursoSlug}
          garantirAula={garantirAula}
        />

        {/* ------------------------------------------------- avaliação --- */}
        <div className="rounded-xl border border-navy-100 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={f.quizAtivo}
              onChange={(e) => setF((v) => ({ ...v, quizAtivo: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-[#C89F50]"
            />
            <span>
              <span className="block text-sm font-semibold text-navy-700">
                Avaliação ao final da aula
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Com a avaliação ativa, a aula só é concluída pela nota — o botão de marcar
                à mão some para o aluno.
              </span>
            </span>
          </label>

          {f.quizAtivo && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Questões sorteadas">
                <input
                  type="number" min={1} max={10}
                  value={f.quizQtd}
                  onChange={(e) => setF((v) => ({ ...v, quizQtd: Number(e.target.value) }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Acertos mínimos">
                <input
                  type="number" min={1} max={f.quizQtd}
                  value={f.quizMinimo}
                  onChange={(e) => setF((v) => ({ ...v, quizMinimo: Number(e.target.value) }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Tentativas">
                <input
                  type="number" min={1} max={5}
                  value={f.quizTentativas}
                  onChange={(e) => setF((v) => ({ ...v, quizTentativas: Number(e.target.value) }))}
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </div>

        {/* --------------------------------------------------- questões -- */}
        <div className="rounded-xl border border-navy-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
                Banco de questões da aula
              </p>
              <p className="mt-1 text-xs text-muted">
                {completas} completa{completas === 1 ? "" : "s"} · o aluno recebe {f.quizQtd}{" "}
                sorteadas
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={gerarQuestoes} disabled={gerando}>
              {gerando ? (
                <><Loader2 size={13} className="animate-spin" /> Gerando…</>
              ) : (
                <><Sparkles size={13} /> Gerar 5 perguntas</>
              )}
            </Button>
          </div>

          {avisoIA && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-gold-200 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
              <Bot size={14} className="mt-0.5 shrink-0" />
              <span>{avisoIA}</span>
            </div>
          )}

          {carregandoQuestoes && (
            <p className="mt-4 text-xs text-muted">Carregando questões salvas…</p>
          )}

          <div className="mt-4 space-y-4">
            {questoes.map((q, i) => (
              <div key={i} className="rounded-xl border border-navy-100 bg-cream/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone="navy">Questão {i + 1}</Badge>
                  <button
                    onClick={() => {
                      setQuestoesTocadas(true);
                      setQuestoes((qs) => qs.filter((_, j) => j !== i));
                    }}
                    className="text-navy-300 transition hover:text-red-600"
                    title="Remover questão"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={q.enunciado}
                  onChange={(e) => editarQuestao(i, { enunciado: e.target.value })}
                  placeholder="Enunciado"
                  className={inputCls + " bg-white"}
                />

                <div className="mt-3 space-y-2">
                  {q.alternativas.map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2 transition",
                        q.correta === a.id ? "border-emerald-300 bg-emerald-50/60" : "border-navy-100"
                      )}
                    >
                      <input
                        type="radio"
                        name={`correta-${i}`}
                        checked={q.correta === a.id}
                        onChange={() => editarQuestao(i, { correta: a.id })}
                        className="h-4 w-4 shrink-0 accent-[#10b981]"
                        title="Marcar como correta"
                      />
                      <span className="shrink-0 text-xs font-bold uppercase text-navy-500">
                        {a.id})
                      </span>
                      <input
                        value={a.texto}
                        onChange={(e) => editarAlternativa(i, a.id, e.target.value)}
                        placeholder={`Alternativa ${a.id.toUpperCase()}`}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
                      />
                    </label>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={q.explicacao ?? ""}
                  onChange={(e) => editarQuestao(i, { explicacao: e.target.value })}
                  placeholder="Explicação mostrada quando o aluno erra"
                  className={inputCls + " mt-3 bg-white"}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setQuestoesTocadas(true);
              setQuestoes((qs) => [...qs, questaoVazia()]);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-navy-200 py-3 text-sm font-semibold text-muted transition hover:border-gold-400 hover:text-navy-700"
          >
            <Plus size={14} /> Escrever questão manualmente
          </button>
        </div>
      </div>
    </Modal>
  );
}
