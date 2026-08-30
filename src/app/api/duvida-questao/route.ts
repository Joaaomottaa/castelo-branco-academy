import { NextResponse } from "next/server";

/* ==========================================================================
   DÚVIDA SOBRE UMA QUESTÃO

   O gabarito comentado explica a questão. Isto explica o **erro**: por que a
   alternativa que a pessoa marcou parecia certa e onde exatamente o raciocínio
   virou. São coisas diferentes, e a segunda é a que faz a pessoa não repetir.

   Ordem das fontes:
     1. N8N_DUVIDA_QUESTAO_WEBHOOK_URL — se houver fluxo dedicado
     2. N8N_QUESTOES_WEBHOOK_URL       — a ponte `tino-ia`, que recebe
                                         { system, user } e devolve { resposta }
     3. ANTHROPIC_API_KEY              — para desenvolver sem o n8n de pé
     4. Reserva local                  — explica a diferença entre as duas
                                         alternativas a partir do gabarito, sem
                                         inventar nada

   Não foi criado um quarto fluxo no n8n de propósito: a ponte já faz
   exatamente isto (prompt vem pronto, ela só chama o modelo), e um fluxo a
   mais seria mais um lugar para o `temperature` voltar a derrubar tudo.
   ========================================================================== */

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPO_LIMITE_MS = 40_000;

const WHATSAPP =
  "https://api.whatsapp.com/send?phone=557531990707&text=Ol%C3%A1!%20Vim%20pela%20Castelo%20Branco%20Academy.";

interface Entrada {
  pergunta: string;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  marcada?: string;
  explicacao?: string;
  area?: string;
  assunto?: string;
  nivel?: string;
  banca?: string;
  nome?: string;
}

function letra(id?: string) {
  return (id ?? "").toUpperCase();
}

function montarSystem(e: Entrada): string {
  return `Você é o Tino, assistente de estudos da Castelo Branco Academy — escola da
Castelo Branco Contabilidade Avançada, mais de 20 anos em Feira de Santana/BA,
com foco em tributário, transporte, logística e comércio exterior.

Agora você está ao lado de um aluno que acabou de responder uma questão do
banco e ficou com dúvida. O gabarito comentado ele já leu. O que falta é
entender o próprio raciocínio.

COMO RESPONDER
1. Se ele errou, comece pela armadilha: por que a alternativa que ele marcou
   parece certa e o que exatamente a torna errada. Essa é a parte que importa.
2. Depois, o caminho até a correta em uma ou duas frases — a regra, não a
   decoreba.
3. Fecha com uma dica de como reconhecer esse tipo de pegadinha da próxima vez.
4. Se ele acertou e só quer entender melhor, aprofunde: exceção, caso de
   fronteira, como o tema cai em prova.
5. Fale como instrutor, não como enunciado. Português brasileiro, direto, sem
   "ótima pergunta" e sem emoji.
6. Nunca invente alíquota, prazo, artigo de lei ou número. Sem certeza,
   explique o raciocínio e diga onde conferir.
7. Entre 3 e 8 linhas. Lista só quando a resposta for mesmo uma sequência.
8. Caso concreto da empresa dele (autuação, contrato, números reais) exige
   análise: responda o que é geral e passe o WhatsApp ${WHATSAPP}

O MÉTODO DA CASA
A Castelo Branco trabalha por camadas de segurança, da C1 (pacífico e
documentado) à C4 (crédito inexistente, passivo oculto). Nunca sugira nada da
C4; se o aluno estiver caminhando para lá, diga o risco com clareza.`;
}

function montarUser(e: Entrada): string {
  const alts = e.alternativas
    .map((a) => `${letra(a.id)}) ${a.texto}`)
    .join("\n");

  const situacao = !e.marcada
    ? "O aluno ainda não marcou alternativa."
    : e.marcada === e.correta
      ? `O aluno marcou ${letra(e.marcada)} e ACERTOU.`
      : `O aluno marcou ${letra(e.marcada)} e ERROU. A correta é ${letra(e.correta)}.`;

  return [
    e.nome ? `Aluno: ${e.nome}.` : "",
    `Área: ${e.area || "—"} · Assunto: ${e.assunto || "—"} · Nível: ${e.nivel || "—"}${
      e.banca ? ` · Banca: ${e.banca}` : ""
    }`,
    "",
    "QUESTÃO",
    e.enunciado,
    "",
    alts,
    "",
    `Gabarito: ${letra(e.correta)}`,
    e.explicacao ? `Comentário oficial: ${e.explicacao}` : "",
    "",
    situacao,
    "",
    "DÚVIDA DO ALUNO",
    e.pergunta,
  ]
    .filter(Boolean)
    .join("\n");
}

async function viaWebhook(url: string, e: Entrada): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Os dois formatos no mesmo corpo: `system`/`user` para a ponte de IA e
      // os campos soltos para um fluxo dedicado que venha a existir.
      body: JSON.stringify({
        tipo: "duvida_questao",
        system: montarSystem(e),
        user: montarUser(e),
        max_tokens: 1200,
        ...e,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[duvida-questao] webhook respondeu", r.status);
      return null;
    }
    const d = await r.json();
    const texto = d?.resposta ?? d?.output ?? d?.text ?? null;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch (err) {
    console.error("[duvida-questao] webhook falhou:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaAnthropic(chave: string, e: Entrada): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 1200,
        system: montarSystem(e),
        messages: [{ role: "user", content: montarUser(e) }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[duvida-questao] Anthropic respondeu", r.status);
      return null;
    }
    const d = await r.json();
    // O conteúdo pode vir com blocos de raciocínio antes do texto.
    const blocos = (d?.content ?? []) as Array<{ type: string; text?: string }>;
    const texto = blocos.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    return texto || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Sem IA, ainda dá para dizer algo verdadeiro — a partir do próprio gabarito. */
function reserva(e: Entrada): string {
  const alt = (id?: string) =>
    e.alternativas.find((a) => a.id === id)?.texto ?? "";

  const linhas: string[] = [];

  if (e.marcada && e.marcada !== e.correta) {
    linhas.push(
      `Você marcou a **${letra(e.marcada)}** — “${alt(e.marcada)}” — e a correta é a **${letra(
        e.correta
      )}**: “${alt(e.correta)}”.`,
      ""
    );
  } else if (e.marcada) {
    linhas.push(`Você acertou: a **${letra(e.correta)}** é “${alt(e.correta)}”.`, "");
  }

  linhas.push(
    e.explicacao ||
      "O comentário desta questão ainda não foi cadastrado — vale revisar o curso da área."
  );

  linhas.push(
    "",
    "Dica de leitura: quando duas alternativas parecem certas, quase sempre a diferença está numa palavra que restringe — “somente”, “exclusivamente”, “independentemente”, “desde que”. Releia o enunciado procurando por ela.",
    "",
    "_(Resposta montada a partir do gabarito — a IA não está conectada agora.)_"
  );

  return linhas.join("\n");
}

export async function POST(req: Request) {
  let e: Entrada;
  try {
    e = (await req.json()) as Entrada;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!e?.pergunta?.trim()) {
    return NextResponse.json({ erro: "Escreva a sua dúvida." }, { status: 400 });
  }
  if (!e.enunciado || !Array.isArray(e.alternativas)) {
    return NextResponse.json({ erro: "Faltou o contexto da questão." }, { status: 400 });
  }

  const dedicado = process.env.N8N_DUVIDA_QUESTAO_WEBHOOK_URL;
  const ponte = process.env.N8N_QUESTOES_WEBHOOK_URL;
  const chave = process.env.ANTHROPIC_API_KEY;

  for (const url of [dedicado, ponte]) {
    if (!url) continue;
    const r = await viaWebhook(url, e);
    if (r) return NextResponse.json({ resposta: r, fonte: "n8n" });
  }

  if (chave) {
    const r = await viaAnthropic(chave, e);
    if (r) return NextResponse.json({ resposta: r, fonte: "anthropic" });
  }

  return NextResponse.json({ resposta: reserva(e), fonte: "local" });
}
