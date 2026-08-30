# Vídeo das aulas

Como o vídeo entra na plataforma hoje, por que foi escolhido assim, e o que
muda quando houver orçamento.

---

## A pergunta que isso responde

"Quero colocar vídeo nas aulas agora, sem pagar nada, e o aluno precisa
conseguir assistir."

A resposta são **duas origens**, escolhidas pelo admin em cada aula:

| Origem | Custo | Limite | Quando usar |
|---|---|---|---|
| **Link do YouTube** | zero | nenhum | **Padrão.** É o que resolve o MVP inteiro. |
| **Upload de arquivo** | zero até 1 GB | 50 MB por arquivo | Quando o vídeo não pode passar pelo YouTube. |

Na área administrativa: **Cursos › expandir o curso › editar a aula › Vídeo**.
A chave `[ Link | Arquivo ]` alterna entre as duas.

---

## Por que YouTube não listado é a melhor escolha agora

O YouTube tem três modos de visibilidade. O do meio é o que interessa:

| Modo | Quem vê |
|---|---|
| Público | qualquer um; aparece em busca e recomendação |
| **Não listado** | **só quem tem o link; não aparece em busca, canal ou recomendação** |
| Privado | só contas que você autorizar, uma a uma |

Com **não listado**, o vídeo não é encontrável — mas quem tiver o link assiste.
Em troca, sem gastar nada, você recebe:

- transcodificação automática em todas as resoluções;
- qualidade adaptativa (o aluno com internet ruim continua assistindo);
- CDN global, com presença forte no Brasil;
- player com legenda, velocidade e picture-in-picture prontos;
- banda ilimitada.

Contratar isso custa a partir de uns R$ 300/mês. Para provar a ideia ao CEO,
não faz sentido.

O embed usa `youtube-nocookie.com`, que não grava cookie de rastreamento antes
de o aluno dar play — um detalhe que importa quando o time jurídico ler a
política de privacidade.

### O que você aceita ao escolher isso

- **Link vazado é vídeo vazado.** Não listado não é privado.
- A marca do YouTube aparece no player.
- O YouTube pode sugerir outro vídeo ao final (o `rel=0` reduz, não elimina).
- Não há como saber quanto do vídeo o aluno assistiu.

Nada disso impede o piloto. Tudo isso impede a venda com exclusividade de
conteúdo — e é por isso que a lista de pendências mantém o streaming pago.

---

## Como fazer o upload no YouTube (passo a passo)

1. Entre no <https://studio.youtube.com> com a conta da Castelo Branco.
2. **Criar › Enviar vídeos** e escolha o arquivo.
3. Em **Visibilidade**, marque **Não listado**.
4. Marque "Não, não é conteúdo para crianças".
5. Publique e copie o link.
6. Cole na aula, em Cursos › editar aula › Vídeo › Link.

A plataforma reconhece o formato sozinha — `youtu.be/...`,
`youtube.com/watch?v=...`, `/embed/`, `/shorts/` e `/live/` funcionam igual.
Link do Vimeo também.

---

## Upload direto (bucket `videos`)

O arquivo vai para o Storage do próprio Supabase. É o caminho mais parecido com
o que a produção vai fazer, e serve para testar o fluxo completo.

**Limites do plano free:** 50 MB por arquivo, 1 GB no total. Isso dá umas cinco
aulas curtas — o suficiente para uma demonstração, insuficiente para um curso.
O aviso está na própria tela de upload.

Como funciona:

1. O arquivo sobe para `videos/<slug-do-curso>/<id-da-aula>-<arquivo>.mp4`.
   Acento e espaço são removidos do nome; o Storage recusa.
2. O bucket é **privado**. Ninguém acessa por URL direta.
3. Na hora de assistir, a plataforma gera uma **URL assinada válida por 2h**.
4. O player é o `<video>` nativo. O Storage responde a *range request*, então
   arrastar a barra funciona.

O que **não** existe aqui: qualidade adaptativa, transcodificação, proteção
contra download depois que a URL assinada está na mão. É MP4 progressivo.

> **Nunca aumente o limite do bucket para servir curso inteiro daqui.** O custo
> de banda do Storage do Supabase é caro para vídeo, e sem transcodificação o
> aluno com internet fraca simplesmente não assiste.

### Trocar ou remover o vídeo

Ao substituir um arquivo por outro de nome diferente, o antigo é apagado do
bucket automaticamente. O mesmo vale para o botão de remover. São 1 GB: arquivo
órfão consome a cota rápido.

**Ainda não é automático:** apagar a *aula* ou o *curso* não apaga os vídeos
correspondentes. Está na lista de pendências.

---

## O caminho para produção

Quando houver orçamento, a decisão continua entre dois:

| | Bunny Stream | Cloudflare Stream |
|---|---|---|
| Custo estimado | ~R$ 300/mês no início | ~2× o Bunny |
| Cobrança | storage + banda | minuto armazenado + minuto assistido |
| Proteção | token na URL, marca d'água | signed URL, DRM opcional |
| Vantagem | mais barato, CDN boa no Brasil | um fornecedor só para tudo |

**Recomendação: Bunny Stream.** A economia paga o resto da infra do MVP e a
diferença técnica não aparece nesse volume.

### O que muda no código

Pouca coisa, e de propósito. A coluna `video_origem` já aceita mais um valor, e
todo o resto está isolado em [src/lib/video.ts](../src/lib/video.ts) e
[src/components/player-aula.tsx](../src/components/player-aula.tsx):

1. Acrescentar `'bunny'` ao `check` de `aulas_video_origem_chk`.
2. Em `enviarVideo`, pedir a URL de upload assinada à API do provedor em vez de
   chamar o Storage.
3. Guardar o `video_id` devolvido em `video_asset_id` — a coluna já existe desde
   o `01_schema.sql`.
4. Em `PlayerAula`, mais um caso: montar o embed HLS do provedor.
5. Webhook de "vídeo pronto" gravando em `video_status`, que também já existe.

O que **não** muda: a tela do admin, a tela do aluno, o progresso, a avaliação e
o certificado.

---

## Sobre o progresso da aula

Hoje a aula é marcada como concluída quando:

- o aluno clica em "Marcar como concluída" (aulas sem avaliação); **ou**
- o vídeo de upload chega ao fim (evento `ended` do `<video>`); **ou**
- o aluno passa na avaliação — e aí é o **banco** que grava, não o navegador.

No YouTube o fim do vídeo não é detectado: saber isso exigiria carregar a IFrame
API do Google na página, e o ganho não paga o script de terceiro. Quando o
streaming próprio entrar, o player passa a reportar o tempo assistido de
verdade, e aí dá para exigir 90% antes de liberar a avaliação.
