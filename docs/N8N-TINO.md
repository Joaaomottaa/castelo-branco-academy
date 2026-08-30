# Tino — conectar o assistente ao n8n

O **Tino** é o assistente da Academy. O nome vem de *"ter tino"* — bom senso prático,
que é exatamente o que se espera de um contador e o que o assistente precisa entregar.

Ele já funciona **sem o n8n**: a rota `/api/assistente` tem um atendimento de reserva
que consulta o catálogo real no Supabase e responde por regras. Não é IA, mas nunca
deixa a pessoa sem resposta. Conectar o n8n troca isso por conversa de verdade.

---

## Como está montado

```
Interface (Tino / botão "explicar meu erro")
        │
        ▼
/api/assistente        ← rota Next, no seu servidor
        │
        ├── N8N_WEBHOOK_URL configurada? ──► webhook do n8n ──► Claude ──► { resposta }
        │
        └── não configurada, ou n8n fora do ar
                 └──► atendimento de reserva (regras + catálogo do Supabase)
```

A rota tem timeout de 25 segundos. Se o n8n demorar mais ou falhar, ela cai no reserva
sozinha — o usuário nunca vê erro.

---

## Passo 1 — Importar o fluxo

1. No n8n: **Workflows** › **Import from File**.
2. Selecione `n8n/tino-assistente.json`.
3. O fluxo aparece com 10 nós.

---

## Passo 2 — Preencher as três coisas que ficaram em branco

### 2.1 Credencial da Anthropic

Abra o nó **Claude** e selecione sua credencial existente do tipo `Anthropic API`.
O modelo já vem definido como `claude-sonnet-5` — rápido e barato o suficiente para
chat. Se quiser mais profundidade nas explicações, troque para `claude-opus-5` no
campo `jsonBody`.

### 2.2 URL e chave do Supabase

Nos nós **Buscar cursos** e **Buscar trilhas**, substitua:

| Onde | Trocar por |
|---|---|
| `https://SEU-PROJETO.supabase.co` | a URL do seu projeto |
| `SUA_CHAVE_ANON` (2 lugares em cada nó) | sua chave publishable/anon |

> Use a chave **anon**, não a service_role. O fluxo só lê catálogo público.

### 2.3 Ativar e copiar o webhook

Ative o workflow (**Active** no topo). Copie a **Production URL** do nó Webhook —
algo como `https://seu-n8n.com/webhook/tino`.

---

## Passo 3 — Ligar na plataforma

No `.env.local`:

```
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/tino
```

Reinicie (`npm run dev`). Pronto — o Tino passa a responder pelo modelo.

> Essa variável **não** tem prefixo `NEXT_PUBLIC_`, de propósito: ela só é lida no
> servidor. A URL do seu n8n nunca vai para o navegador.

---

## O que o fluxo faz

| Nó | Papel |
|---|---|
| **Webhook** | Recebe o POST da rota `/api/assistente` |
| **Preparar entrada** | Normaliza o payload e corta o histórico nas últimas 6 mensagens |
| **Qual pedido?** | Separa `chat` de `explicar_questao` |
| **Buscar cursos** / **Buscar trilhas** | Lê o catálogo real do Supabase |
| **Montar prompt do Tino** | Injeta catálogo + persona + contexto da Castelo Branco |
| **Montar prompt da questão** | Prompt específico do "por que errei" |
| **Claude** | Chamada à Messages API |
| **Extrair resposta** | Tira o texto do retorno; se vier torto, devolve o WhatsApp |
| **Responder** | Devolve `{ resposta }` |

### Por que o catálogo entra no prompt

Para o modelo **não inventar curso que não existe**. O prompt lista os cursos e trilhas
que estão publicados no banco naquele momento e instrui explicitamente: só recomende
o que está nesta lista; se não houver, diga com honestidade.

Isso significa que **quando você publicar um curso novo no admin, o Tino já passa a
recomendá-lo** — sem editar o fluxo.

---

## O prompt

Está dentro do nó **Montar prompt do Tino**, na variável `system`. Cobre:

- **Quem é a Castelo Branco** — contabilidade consultiva, +20 anos, Feira de Santana/BA,
  foco em transporte, logística, armazenagem e comércio exterior. O método de quatro
  fases (Diagnóstico → Estratégia → Organização → Gestão) e as camadas C1 a C4, com a
  instrução explícita de **nunca sugerir nada da camada C4** (crédito inexistente,
  passivo oculto, decisão sem sustentação legal).
- **O que é a Academy** — cursos, trilhas, certificados, PEPC, banco de talentos.
- **Os três planos** com os valores exatos.
- **Como conversar** — português brasileiro, direto, sem parecer folheto de vendas,
  no máximo uma pergunta de volta por vez, sem emoji a não ser que a pessoa use antes.
- **Regras firmes** — não dar parecer tributário definitivo, passar o WhatsApp quando
  o caso for específico, nunca inventar prazo/desconto/funcionalidade, admitir quando
  não sabe.

Edite o texto direto no nó. Vale revisar com o CEO antes de ir ao ar.

---

## Testar

Com o workflow ativo, no terminal:

```bash
curl -X POST https://seu-n8n.com/webhook/tino -H "Content-Type: application/json" -d '{"tipo":"chat","mensagem":"Quero seguir a área fiscal, por onde começo?"}'
```

Deve voltar `{ "resposta": "..." }` recomendando a trilha de Analista Fiscal.

Na plataforma, abra o botão dourado no canto inferior direito e pergunte a mesma coisa.

---

## Onde o Tino aparece

| Lugar | O que faz |
|---|---|
| Botão flutuante (toda a área logada) | Chat aberto: cursos, trilhas, planos, certificados, vagas, contato |
| Banco de questões, ao errar | Botão "Pedir para o Tino explicar por que errei" — **só plano pago** |
| Tela de planos | É o principal argumento do Pro |

O limite por plano é aplicado na interface (`src/lib/planos.ts`). Quando houver cobrança
de verdade, mover essa checagem também para o servidor — hoje um usuário técnico
conseguiria contornar pelo console.

---

## Custo

Estimativa com `claude-sonnet-5`, prompt de ~1.500 tokens (catálogo incluso) e resposta
de ~250 tokens:

| Volume | Custo mensal aproximado |
|---|---|
| 1.000 conversas/mês | US$ 6 – 9 |
| 5.000 conversas/mês | US$ 30 – 45 |

Para reduzir: cachear o bloco do catálogo no prompt (prompt caching da Anthropic) ou
buscar o catálogo só quando a pergunta parecer ser sobre curso.

---

# Segundo fluxo — gerador de questões da aula

Arquivo: `n8n/tino-questoes.json`. É independente do Tino: pode importar só ele.

## Para que serve

Na área administrativa, em **Cursos › editar aula**, existe o botão
**Gerar 5 perguntas**. Ele lê o que o admin preencheu — título, descrição,
nível, curso e módulo — e devolve cinco questões de A a D com gabarito e
explicação. O admin revisa, corrige o que quiser, apaga o que não presta e
salva. As questões só entram no banco depois dessa confirmação.

Dessas cinco, o aluno recebe **três sorteadas** ao final da aula. Duas
tentativas, precisa acertar duas. Cada tentativa sorteia de novo — repetir a
prova é estudar, não decorar a ordem.

## Importar

1. **Workflows › Import from File** → `n8n/tino-questoes.json`.
2. Abra o nó **Claude** e selecione a credencial `Anthropic API`.
   Não há nada mais para preencher: este fluxo não consulta o Supabase.
3. Ative o workflow e copie a **Production URL** do nó Webhook.
4. No `.env.local`:

```
N8N_QUESTOES_WEBHOOK_URL=https://seu-n8n.com/webhook/tino-questoes
```

## Os cinco nós

| Nó | Papel |
|---|---|
| **Webhook** | Recebe o POST de `/api/gerar-questoes` |
| **Montar prompt** | Normaliza a entrada e monta o prompt calibrado pelo nível |
| **Claude** | Messages API |
| **Validar questões** | Descarta o que não é utilizável |
| **Responder** | Devolve `{ questoes: [...] }` |

### A calibragem por nível

O prompt muda conforme o nível preenchido pelo admin, porque questão boa para
iniciante é questão ruim para avançado:

| Nível | O que a questão cobra | Como é o distrator |
|---|---|---|
| Iniciante | definição, finalidade, passo básico | engano comum de quem começa |
| Intermediário | aplicação em caso concreto, o porquê da decisão | plausível para quem sabe a teoria e nunca executou |
| Avançado | exceção, conflito de regra, consequência | a resposta certa **em outro contexto** |

### Por que o nó de validação existe

Uma questão sem gabarito válido, com menos de duas alternativas ou com a
`correta` apontando para uma letra inexistente é pior do que questão nenhuma:
o admin aprovaria sem perceber e o aluno erraria a resposta certa. O nó
descarta essas e, se sobrar zero, devolve lista vazia — o que faz a rota
`/api/gerar-questoes` seguir para o caminho seguinte em vez de entregar lixo.

## Sem o n8n

A rota tenta, nesta ordem:

1. `N8N_QUESTOES_WEBHOOK_URL`
2. `ANTHROPIC_API_KEY` — chama a Anthropic direto do servidor. Bom para
   desenvolver sem subir o n8n.
3. **Modelo local** — monta um esqueleto de questão a partir do título, com a
   explicação dizendo "reescreva". Não é IA e não esconde isso: a tela mostra
   um aviso amarelo com a origem. Existe para a demonstração nunca travar por
   falta de configuração.

## Custo

Prompt de ~900 tokens e resposta de ~1.200, com `claude-sonnet-5`:
cerca de **US$ 0,02 por aula**. Um curso de 12 aulas sai por menos de US$ 0,25.
Ao contrário do chat, isso roda uma vez por aula, não a cada conversa.

---

# Terceiro fluxo — dúvidas dentro da aula

Arquivo: `n8n/tino-duvidas.json`. Também independente: pode importar só ele.

## Para que serve

Na aula, a aba **Dúvidas e IA** tem duas vias:

| Via | Quem responde | Quem vê | Quando usar |
|---|---|---|---|
| **Tirar dúvida com IA** | o Tino, na hora | **só quem perguntou** | "não entendi", "explica de outro jeito" |
| **Fórum da turma** | instrutor e colegas | toda a turma | caso concreto, discussão, experiência de quem já passou |

A separação existe porque são dúvidas de natureza diferente. A pergunta básica —
a que a pessoa não faria na frente da turma — é justamente a que trava o estudo,
e ela só é feita se ninguém mais estiver vendo.

> **A privacidade é garantida no banco, não na interface.** A policy de RLS de
> `public.duvidas` não devolve pergunta do tipo `ia` para ninguém além do autor —
> **nem para o administrador**. Se um dia alguém "corrigir" isso adicionando
> `is_admin()`, a funcionalidade perde o sentido.

## Importar

1. **Workflows › Import from File** → `n8n/tino-duvidas.json`.
2. Abra o nó **Claude** e selecione a credencial `Anthropic API`.
3. Ative e copie a **Production URL**.
4. No `.env.local`:

```
N8N_DUVIDAS_WEBHOOK_URL=https://seu-n8n.com/webhook/tino-duvidas
```

## O que o fluxo recebe

A rota `/api/duvida-ia` envia a pergunta **junto com o contexto da aula**:

```json
{
  "tipo": "duvida_aula",
  "pergunta": "O que é cumulatividade?",
  "cursoTitulo": "Reforma Tributária na Prática",
  "moduloTitulo": "Fundamentos da EC 132/2023",
  "aulaTitulo": "Por que o sistema antigo quebrou",
  "aulaDescricao": "Cumulatividade, guerra fiscal e o custo invisível do contencioso.",
  "nivel": "Avançado",
  "categoria": "Tributário"
}
```

É esse contexto que separa uma resposta útil de uma resposta genérica de
chatbot. O prompt manda o modelo responder como o instrutor responderia **depois
daquela aula específica**, calibrando pelo nível da turma.

## O prompt

Está no nó **Montar prompt**. Além do contexto da aula, ele carrega:

- **as regras de conversa** — começar pela resposta, sem "ótima pergunta",
  exemplo concreto de escritório contábil, 3 a 8 linhas;
- **os limites** — nunca inventar número, prazo, alíquota ou artigo de lei;
  nunca dar parecer definitivo; caso concreto vai para o WhatsApp;
- **o método da casa** — camadas C1 a C4, com a instrução de nunca sugerir nada
  da C4 e de dizer o risco com clareza quando a pessoa estiver caminhando para lá.

Vale revisar com o CEO antes de ir ao ar: é a voz da Castelo Branco falando com
aluno.

## Sem o n8n

A rota tenta, nesta ordem: `N8N_DUVIDAS_WEBHOOK_URL` → `N8N_WEBHOOK_URL` →
`ANTHROPIC_API_KEY` → **reserva**.

A reserva **não finge ser IA**. Ela diz que o assistente não está conectado,
explica que não vai arriscar uma resposta técnica ("em matéria tributária,
resposta inventada custa caro") e encaminha para o fórum e para o WhatsApp. A
resposta aparece marcada com o selo *IA não conectada*.

## Custo

Prompt de ~700 tokens e resposta de ~400, com `claude-sonnet-5`: cerca de
**US$ 0,01 por dúvida**. Mil dúvidas por mês custam algo em torno de US$ 10.

Antes de abrir para a base inteira, resolva o limite de uso (item 1.8 das
pendências): a rota hoje não tem rate limiting.

---

# Quarto fluxo — gerador de questões do banco

Arquivo: `n8n/tino-questoes-banco.json`. Independente dos outros: pode importar
só ele.

## Por que é um fluxo separado

O fluxo da aula (`tino-questoes`) começa validando o **título da aula** — é o
que ele usa para escrever a prova daquele vídeo. A tela `/admin/questoes/gerar`
não tem aula nenhuma: ela manda **área, assunto e nível**.

Apontar as duas coisas para o mesmo webhook faz o fluxo antigo recusar a
chamada nova com:

```
O título da aula é obrigatório.
```

Não é bug do envio — é o fluxo certo recebendo a pergunta errada. Por isso são
dois workflows e duas variáveis de ambiente.

| | Fluxo da aula | Fluxo do banco |
|---|---|---|
| Arquivo | `n8n/tino-questoes.json` | `n8n/tino-questoes-banco.json` |
| Caminho do webhook | `tino-questoes` | `tino-questoes-banco` |
| Variável | `N8N_QUESTOES_WEBHOOK_URL` | `N8N_QUESTOES_BANCO_WEBHOOK_URL` |
| `tipo` no corpo | `gerar_questoes` | `gerar_questoes_banco` |
| Entrada | título, descrição, curso, módulo, nível | área, assunto, nível, modo, banca |
| Onde aparece | Cursos › editar aula › Gerar 5 perguntas | /admin/questoes/gerar |

## Importar

1. **Workflows › Import from File** → `n8n/tino-questoes-banco.json`.
2. Abra o nó **Claude** e selecione a credencial `Anthropic API`.
   Nada mais a preencher: este fluxo não consulta o Supabase.
3. Ative o workflow e copie a **Production URL** do nó Webhook.
4. No `.env.local`:

```
N8N_QUESTOES_BANCO_WEBHOOK_URL=https://seu-n8n.com/webhook/tino-questoes-banco
```

Mantenha o `N8N_QUESTOES_WEBHOOK_URL` apontando para o fluxo da aula. Se a
variável do banco ficar vazia, a rota tenta a da aula como reserva — e aí volta
o erro do título.

## O corpo que chega

```json
{
  "tipo": "gerar_questoes_banco",
  "quantidade": 3,
  "area": "Comex",
  "assunto": "Classificação Fiscal",
  "nivel": "Intermediário",
  "modo": "ia"
}
```

`modo` vale `"ia"` (questão autoral) ou `"prova"`. No modo `prova` chega também
`banca`, e o prompt pede que o modelo preencha `banca`, `ano` e `prova` de
referência.

> **Sobre o modo `prova`:** ele imita o **formato** da banca — não copia
> enunciado de prova real, que seria uso de material de terceiro. A instrução
> está explícita no prompt do nó *Montar prompt*.

## Os cinco nós

| Nó | Papel |
|---|---|
| **Webhook** | POST em `/webhook/tino-questoes-banco`, responde pelo nó final |
| **Montar prompt** | Valida área e assunto, calibra pelo nível e monta `system` + `user` |
| **Claude** | `claude-sonnet-5`, 4000 tokens, temperatura 0,7 |
| **Validar questões** | Descarta questão sem gabarito válido ou com menos de duas alternativas |
| **Responder** | Devolve `{ questoes: [...], fonte: "n8n" }` |

O nó de validação existe pelo mesmo motivo do fluxo da aula: uma questão cujo
`correta` não bate com nenhuma alternativa passaria despercebida na revisão e
viraria estudo errado. Ele também limita o lote à quantidade pedida e remove
`banca`/`ano`/`prova` quando o modo é autoral — esses campos só fazem sentido
no modo de prova.

## O que a resposta devolve

```json
{
  "questoes": [
    {
      "enunciado": "...",
      "alternativas": [
        { "id": "a", "texto": "..." },
        { "id": "b", "texto": "..." },
        { "id": "c", "texto": "..." },
        { "id": "d", "texto": "..." }
      ],
      "correta": "b",
      "explicacao": "..."
    }
  ],
  "fonte": "n8n",
  "area": "Comex",
  "assunto": "Classificação Fiscal",
  "nivel": "Intermediário",
  "modo": "ia"
}
```

A tela mostra esse lote para revisão. Nada entra no banco antes de o
administrador confirmar.

## Sem o n8n

Sem `N8N_QUESTOES_BANCO_WEBHOOK_URL` e sem `ANTHROPIC_API_KEY`, a rota devolve
um rascunho local marcado como tal — e a tela avisa em amarelo que não houve
IA. Serve para a demonstração não travar, não para publicar.
