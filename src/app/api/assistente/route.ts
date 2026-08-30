import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * PONTE PARA O TINO — assistente da Castelo Branco Academy
 *
 * Fluxo normal: a interface chama esta rota, que repassa para o webhook do n8n
 * (onde vive o prompt e a chamada ao modelo). O n8n devolve { resposta }.
 *
 * Se N8N_WEBHOOK_URL não estiver configurada — ou o n8n estiver fora do ar —
 * cai num atendimento local que consulta o catálogo real no Supabase e responde
 * com regras. Não é IA, mas mantém a demonstração de pé e nunca deixa a pessoa
 * sem resposta.
 */

const N8N_URL = process.env.N8N_WEBHOOK_URL ?? "";
const WHATSAPP =
  "https://api.whatsapp.com/send?phone=557531990707&text=Ol%C3%A1!%20Vim%20pela%20Castelo%20Branco%20Academy.";

export async function POST(req: Request) {
  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ resposta: "Não entendi a mensagem. Pode repetir?" });
  }

  // O nome do aluno é anexado ao corpo em três formatos antes de sair para o
  // n8n: `nome`, `usuario.nome` e uma linha de contexto colada na própria
  // mensagem. Parece redundante e é — de propósito. O fluxo do assistente vive
  // fora deste repositório e cada versão dele lê o corpo de um jeito; a linha
  // de contexto é a única que funciona mesmo quando o prompt ignora tudo o que
  // não seja a mensagem.
  const corpoParaN8N = comNomeDoAluno(corpo);

  /* ------------------------------------------------------- n8n, se houver */
  if (N8N_URL) {
    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 25_000);

      const r = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpoParaN8N),
        signal: controlador.signal,
      });
      clearTimeout(timer);

      if (r.ok) {
        const dados = await r.json();
        const resposta =
          dados.resposta ?? dados.output ?? dados.text ?? dados.message ?? null;
        if (resposta) return NextResponse.json({ resposta, origem: "n8n" });
      }
      console.error("[tino] n8n respondeu", r.status);
    } catch (e) {
      console.error("[tino] n8n indisponível:", e instanceof Error ? e.message : e);
    }
  }

  /* ------------------------------------------------ atendimento de reserva */
  const resposta = await responderLocalmente(corpo);
  return NextResponse.json({ resposta, origem: "local" });
}

/** Nome do aluno em três lugares — ver o comentário no POST. */
function comNomeDoAluno(corpo: Record<string, unknown>): Record<string, unknown> {
  const usuario = corpo.usuario as { nome?: string } | null | undefined;
  const nome = String(corpo.nome ?? usuario?.nome ?? "").trim();
  if (!nome) return corpo;

  const primeiro = nome.split(/\s+/)[0];
  const mensagem = String(corpo.mensagem ?? "");

  return {
    ...corpo,
    nome,
    primeiroNome: primeiro,
    // Instrução curta, em terceira pessoa, antes da fala real. Fica fora do
    // que a pessoa vê: a interface mostra só o que ela digitou.
    mensagem: mensagem
      ? `[contexto: o aluno se chama ${nome}. Trate-o por "${primeiro}" e comece a resposta cumprimentando-o pelo nome.]\n\n${mensagem}`
      : mensagem,
  };
}

async function responderLocalmente(corpo: Record<string, unknown>): Promise<string> {
  const tipo = String(corpo.tipo ?? "chat");
  const msg = String(corpo.mensagem ?? "").toLowerCase();
  const usuario = corpo.usuario as { nome?: string } | null | undefined;
  const primeiro = String(corpo.nome ?? usuario?.nome ?? "").trim().split(/\s+/)[0];
  /** "Claro, Mariana." / "Claro." — sem o nome, sem a vírgula pendurada. */
  const chamando = (frase: string) => (primeiro ? `${frase}, ${primeiro}` : frase);

  /* Explicação de questão errada ------------------------------------------ */
  if (tipo === "explicar_questao") {
    const explicacao = String(corpo.explicacao ?? "");
    const marcada = String(corpo.marcada ?? "");
    const correta = String(corpo.correta ?? "");
    return [
      `Você marcou a alternativa ${marcada.toUpperCase()}, mas a correta é a ${correta.toUpperCase()}.`,
      "",
      explicacao ||
        "O comentário desta questão ainda não foi cadastrado — vale revisar o curso da área.",
      "",
      "Dica: quando a alternativa parece certa mas não é, quase sempre falta um detalhe da regra. Releia o enunciado procurando a palavra que restringe (\"somente\", \"exclusivamente\", \"independentemente\").",
      "",
      "_(Resposta gerada localmente — conecte o fluxo do n8n para ter a análise completa do Tino.)_",
    ].join("\n");
  }

  /* Conversa -------------------------------------------------------------- */
  const catalogo = await buscarCatalogo();

  if (/whats|zap|contato|falar com|atendente|telefone|humano/.test(msg)) {
    return `${chamando("Claro")}. Você fala direto com a equipe da Castelo Branco por aqui:\n\n${WHATSAPP}\n\nSe preferir, me conta o que precisa que eu tento resolver aqui mesmo.`;
  }

  if (/plano|pre[çc]o|valor|quanto custa|assinar|assinatura|mensalidade/.test(msg)) {
    return [
      "Temos três planos:",
      "",
      "• **Gratuito** — aulas abertas de todos os cursos, perfil no banco de talentos e 3 questões por dia.",
      "• **Pro — R$ 89/mês** (ou R$ 71/mês no anual) — todos os cursos e trilhas, certificados com validação, pontos PEPC, questões ilimitadas e eu explicando cada erro seu.",
      "• **Empresarial** — sob consulta. Licenças por colaborador, trilhas obrigatórias por cargo e busca no banco de talentos.",
      "",
      "Quer que eu abra a comparação completa? É só ir em **Planos**, no menu do seu nome.",
    ].join("\n");
  }

  if (/trilha|carreira|seguir a [áa]rea|come[çc]ar|do zero|qual curso fa[çc]o/.test(msg)) {
    const trilhas = catalogo.trilhas.length
      ? catalogo.trilhas.map((t) => `• **${t.nome}** — ${t.cargo_alvo}, ${t.area}`).join("\n")
      : "• Analista Fiscal\n• Especialista Tributário\n• Comércio Exterior\n• Departamento Pessoal\n• Contador Consultivo";
    return [
      "Boa pergunta — o caminho muda bastante conforme onde você quer chegar. Nossas trilhas são:",
      "",
      trilhas,
      "",
      "Me conta duas coisas e eu te aponto a certa: você já trabalha na área e qual cargo quer ocupar daqui a um ano?",
    ].join("\n");
  }

  /* Busca de curso por assunto -------------------------------------------- */
  const achados = catalogo.cursos.filter((c) => {
    const texto = `${c.titulo} ${c.subtitulo ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
    return msg.length > 3 && msg.split(/\s+/).some((p) => p.length > 3 && texto.includes(p));
  });

  if (achados.length) {
    return [
      achados.length === 1
        ? "Encontrei exatamente o que você procura:"
        : "Encontrei estes cursos sobre o assunto:",
      "",
      ...achados.slice(0, 3).map(
        (c) => `• **${c.titulo}** — ${c.subtitulo ?? ""} (${c.carga_horaria}h, ${c.pontos_pepc} pts PEPC)`
      ),
      "",
      "Quer que eu explique o conteúdo de algum deles ou prefere ver a trilha completa que inclui esse curso?",
    ].join("\n");
  }

  if (/certificado|pepc|crc|educa[çc][ãa]o continuada|pontos/.test(msg)) {
    return [
      "Cada curso concluído gera certificado automático com carga horária e um **código público de validação** — a empresa consegue conferir sem depender de você.",
      "",
      "Os certificados também acumulam pontos de educação profissional continuada. A meta anual do CFC para as categorias obrigatórias é de 40 pontos, e o painel mostra quanto você já tem.",
      "",
      "Concluir uma trilha inteira gera um selo à parte, que é o que as empresas pedem nas vagas.",
    ].join("\n");
  }

  if (/vaga|emprego|contrata|talento|curr[íi]culo/.test(msg)) {
    return [
      "O banco de talentos conecta quem estuda aqui com as empresas do setor.",
      "",
      "Funciona assim: você conclui os cursos, o perfil ganha as certificações verificadas e as empresas buscam por certificação, cidade, senioridade e habilidade. A candidatura é em um clique — não precisa reescrever currículo.",
      "",
      "Vale saber: várias vagas pedem **trilha completa**, não curso avulso. Quem tem o selo aparece primeiro.",
    ].join("\n");
  }

  if (/^(oi|ol[áa]|bom dia|boa tarde|boa noite|e a[íi]|opa)/.test(msg.trim())) {
    return `${primeiro ? `Olá, ${primeiro}!` : "Oi!"} Sou o Tino, assistente da Castelo Branco Academy. Posso te ajudar a escolher um curso, montar uma trilha de carreira, tirar dúvida sobre planos e certificados, ou te passar o contato da equipe. O que você precisa?`;
  }

  return [
    "Não tenho certeza se entendi direito. Posso ajudar com:",
    "",
    "• Encontrar um curso por assunto (ex.: \"quero algo sobre Reforma Tributária\")",
    "• Recomendar uma trilha de carreira",
    "• Explicar planos, preços e certificados",
    "• Falar sobre o banco de talentos e as vagas",
    "• Te passar o contato direto da equipe",
    "",
    "Me conta com outras palavras o que você precisa?",
  ].join("\n");
}

/** Catálogo real, para a resposta de reserva não inventar curso que não existe. */
async function buscarCatalogo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cursos: [], trilhas: [] };

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [c, t] = await Promise.all([
      sb.from("cursos").select("slug, titulo, subtitulo, carga_horaria, pontos_pepc, tags").eq("publicado", true),
      sb.from("trilhas").select("slug, nome, cargo_alvo, area").eq("publicada", true).order("ordem"),
    ]);
    return {
      cursos: (c.data ?? []) as Array<{
        slug: string; titulo: string; subtitulo: string | null;
        carga_horaria: number; pontos_pepc: number; tags: string[] | null;
      }>,
      trilhas: (t.data ?? []) as Array<{ slug: string; nome: string; cargo_alvo: string; area: string }>,
    };
  } catch {
    return { cursos: [], trilhas: [] };
  }
}
