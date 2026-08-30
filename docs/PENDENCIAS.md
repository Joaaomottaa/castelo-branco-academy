# Pendências para produção

Tudo que ficou de fora, simulado ou provisório no MVP. Este arquivo é a lista que
precisa estar zerada — ou conscientemente aceita — antes de a plataforma receber o
primeiro aluno pagante.

> **Como usar:** cada item tem o porquê, o impacto se for ignorado e o que fazer.
> Marque `[x]` conforme resolver. Item novo que aparecer no desenvolvimento, jogue aqui.

Legenda de prioridade:

| | Significado |
|---|---|
| 🔴 | **Bloqueia o go-live.** Não sobe para produção com isso em aberto. |
| 🟡 | Precisa existir para a plataforma ser vendável, mas não impede um piloto fechado. |
| 🟢 | Melhoria. Pode ir para a segunda rodada. |

Última revisão: 30/08/2026 — ferramentas de cálculo dentro da questão e a
área da empresa (licenças, convites, formações e relatório PEPC). O passo a
passo de subida está em [DEPLOY.md](./DEPLOY.md).

Itens marcados **RESOLVIDO** ficam no arquivo de propósito: eles contam o que
foi feito e por quê, e é isso que evita a regressão silenciosa seis meses depois.

---

## 1. Segurança e acesso

### 🔴 1.1 — Contas de demonstração com senha `123456`

O `03_usuarios_demo.sql` cria 9 contas reais no `auth.users`, todas com a mesma senha.
Três delas têm papel elevado, incluindo `admin@castelobranco.com.br`, que enxerga todos
os alunos e modera vagas.

**Impacto:** qualquer pessoa que já viu a apresentação entra como administrador.

**O que fazer:** antes de apontar o domínio para produção, rodar em SQL:

```sql
delete from auth.users
where email in (
  'aluno@castelobranco.com.br',
  'empresa@castelobranco.com.br',
  'admin@castelobranco.com.br'
) or email like '%@exemplo.com';
```

Depois criar o admin real pelo painel do Supabase (Authentication › Add user) e promover
o perfil com `update public.perfis set role = 'admin' where id = '<uuid>';`.

> Se quiser manter um ambiente de vitrine para comercial, use um **projeto Supabase
> separado**, não o de produção.

---

### 🔴 1.2 — Confirmação de e-mail desligada

Está desligada em Authentication › Sign In / Providers › Email para facilitar o
desenvolvimento. Em produção significa que qualquer um cria conta com e-mail de terceiro.

**O que fazer:**

1. Religar **Confirm email**.
2. Configurar SMTP próprio em Authentication › Emails › SMTP Settings. O SMTP embutido do
   Supabase tem limite de 2 e-mails/hora e não serve para produção.
   - **Resend** — mais simples, plano free de 3.000 e-mails/mês.
   - **Amazon SES** — mais barato em volume, configuração mais chata.
3. Traduzir os templates (chegam em inglês por padrão).
4. Verificar o domínio (SPF, DKIM e DMARC) ou os e-mails caem em spam.
5. Testar o fluxo inteiro: cadastro → e-mail → confirmação → login.

A tela de "Confirme seu e-mail" já existe no app e já trata esse caso.

---

### 🔴 1.3 — Limites de plano aplicados só no navegador

`src/lib/planos.ts` decide no cliente quantas questões o usuário Free pode responder por
dia (3), quantos cadernos pode ter (1) e se a explicação por IA está liberada.

**Impacto:** enquanto não há cobrança, é irrelevante. No dia em que houver, um usuário com
o console aberto libera o plano Pro sozinho.

**O que fazer:** mover a checagem para uma Edge Function (ou rota de servidor) que:

- lê o plano do perfil pelo JWT, não por parâmetro vindo do cliente;
- conta as respostas do dia direto no banco;
- devolve 402/403 quando estourar.

Manter a checagem no cliente também — ela existe para dar uma boa mensagem, não para
proteger.

---

### 🟢 1.4 — Gabarito das questões — **resolvido na avaliação por aula**

Ficou registrado aqui para a distinção não se perder, porque **são dois bancos
de questões diferentes**:

**Avaliação pós-aula (`public.questoes`) — corrigida no servidor.**
A tabela só é legível pelo admin. O aluno recebe as questões por
`quiz_da_aula()`, que não devolve a coluna `correta`, e envia as respostas para
`corrigir_quiz()`, que corrige dentro do banco, grava a tentativa e só então
devolve o gabarito com a explicação. O limite de tentativas também é conferido
lá — não no navegador. Verificado: um perfil `aluno` autenticado enxerga zero
linhas em `public.questoes`.

**Banco de questões de estudo (`public.questoes_banco`) — ainda no cliente.**
Continua trafegando a resposta correta, porque a correção acontece no navegador
para dar retorno imediato. Para estudo isso é aceitável: a pessoa só engana a si
mesma. **Deixa de ser aceitável no dia em que o simulado valer nota ou
classificação** — aí a correção precisa migrar para o mesmo desenho da avaliação
por aula.

---

### 🟡 1.5 — Leaked password protection desligado

Supabase › Authentication › Policies. Compara a senha contra a base do
HaveIBeenPwned no cadastro. É um clique e evita senha reciclada de vazamento.

Vale ligar junto: exigir mínimo de 8 caracteres.

---

### 🟢 1.6 — `is_admin()` e `is_membro_empresa()` executáveis por `anon`

**Isso não é bug.** Está documentado aqui para não ser "corrigido" por engano numa
auditoria futura.

Todas as demais funções tiveram `EXECUTE` revogado de `PUBLIC` — o Postgres concede isso
por padrão e o PostgREST expunha cada uma em `/rest/v1/rpc/`. Essas duas ficaram porque
as policies de RLS as chamam, e policy é avaliada com o papel de quem consulta. Revogar
derrubaria o acesso de todo mundo.

Elas são `SECURITY DEFINER`, não recebem parâmetro controlado pelo usuário e só devolvem
booleano sobre o próprio requisitante. Chamar direto não vaza nada.

**O mesmo vale para as funções da avaliação.** O verificador do Supabase avisa
sobre `quiz_da_aula`, `quiz_status`, `corrigir_quiz` e `backfill_selos_trilha`
estarem executáveis por `authenticated` — **é o propósito delas**. São a única
porta pela qual o aluno alcança as questões, justamente porque a tabela ficou
fechada. Cada uma se defende sozinha:

| Função | Guarda interna |
|---|---|
| `quiz_da_aula` | recusa `auth.uid() is null`; nunca devolve a coluna `correta` |
| `quiz_status` | recusa `auth.uid() is null`; só lê o próprio histórico |
| `corrigir_quiz` | recusa não autenticado; confere o limite de tentativas no banco |
| `backfill_selos_trilha` | recusa quem não é `is_admin()` |
| `metricas_resumo` | recusa quem não é `is_admin()` |
| `metricas_mensais` | recusa quem não é `is_admin()` |
| `metricas_cursos` | recusa quem não é `is_admin()` |
| `metricas_ferramentas` | recusa quem não é `is_admin()` |
| `metricas_periodo` · `metricas_cursos` · `metricas_ano_inicial` | recusam quem não é `is_admin()` |
| `publico_da_campanha` · `disparar_campanha` | recusam quem não é `is_admin()` |
| `definir_status_perfil` | recusa não-admin e impede desativar a própria conta |
| `enfileirar_email` · `candidatos_da_vaga` | recusam quem não é `is_admin()` |
| `validar_cupom` | recusa não autenticado; devolve só "vale ou não" e o desconto |
| `contratar_plano` · `cancelar_plano` | operam **apenas** sobre `auth.uid()` — ninguém contrata para outro |

Revogar qualquer uma delas quebra a avaliação ou o painel. O aviso do
verificador fica — e deve ficar — em amarelo. O que importa auditar é a **guarda
dentro** de cada função, não a lista.

---

### 🟡 1.7 — Rotacionar a `service_role` key

Durante o desenvolvimento a chave passou por um arquivo que não estava no `.gitignore`.
O arquivo foi restaurado como modelo vazio e o `.gitignore` foi endurecido, mas a chave em
si **não foi trocada**.

**O que fazer:** Project Settings › API Keys › Reveal › Rotate. Depois atualizar o
`.env.local` de cada dev e a variável no ambiente de deploy.

Fazer isso de qualquer forma antes do go-live — 5 devs juniores já rodaram o projeto na
máquina deles.

---

### 🟡 1.8 — Sem rate limiting na `/api/assistente`

A rota do Tino aceita POST sem autenticação nem limite. Com o n8n conectado, cada chamada
custa dinheiro na Anthropic.

**O que fazer:** exigir sessão válida, limitar por usuário (ex.: 30 mensagens/hora, 10 no
Free) e limitar por IP na borda. Sem isso, um script mantém a conta sangrando.

---

### 🟢 1.9 — JWT continua válido após deletar o usuário no servidor

Se um usuário é apagado direto no painel, o token que já está no navegador dele segue
funcionando até expirar (1h por padrão).

**O que fazer:** ao remover ou banir alguém, chamar também
`supabase.auth.admin.signOut(userId)`. Vale encapsular numa função de "desativar aluno" no
admin, junto com a exclusão LGPD (item 5.2).

---

## 2. Funcionalidades simuladas

O que a interface mostra completo mas ainda não acontece de verdade.

### 🟡 2.1 — Streaming profissional de vídeo

**Resolvido para o MVP.** A aula já aceita vídeo por duas vias, ambas gratuitas:
link do YouTube não listado (padrão) e upload no bucket `videos` do Supabase
(50 MB por arquivo, 1 GB no total no plano free). Passo a passo em
**[VIDEO.md](VIDEO.md)**.

O que continua pendente é o streaming pago, e por três motivos concretos:

- **link não listado vazado é vídeo vazado** — não dá para vender exclusividade;
- **sem qualidade adaptativa no upload próprio** — MP4 progressivo trava em
  internet fraca;
- **sem telemetria de quanto o aluno assistiu** — hoje não há como exigir 90%
  do vídeo antes de liberar a avaliação.

Decisão pendente:

| | Bunny Stream | Cloudflare Stream |
|---|---|---|
| Custo estimado | ~R$ 300/mês no início | ~2× o Bunny |
| Cobrança | storage + banda | minuto armazenado + minuto assistido |
| Proteção | token na URL, marca d'água | signed URL, DRM opcional |
| Vantagem | mais barato, CDN boa no Brasil | um fornecedor só |

**Recomendação: Bunny Stream.** O que muda no código está listado no fim do
[VIDEO.md](VIDEO.md) — é pouco, porque `video_origem`, `video_asset_id` e
`video_status` já existem no schema.

---

### 🟡 2.1b — Vídeo órfão no Storage ao apagar aula ou curso

Trocar ou remover o vídeo de uma aula já apaga o arquivo antigo do bucket.
**Apagar a aula ou o curso, não.** O arquivo fica ocupando a cota de 1 GB sem
nada apontando para ele.

**O que fazer:** trigger `after delete on public.aulas` que registra o
`video_path` numa fila, e uma Edge Function agendada que chama a Storage API
para remover. Não dá para apagar objeto de Storage direto por SQL — o Supabase
bloqueia (`storage.protect_delete`).

Enquanto isso: ao apagar uma aula com vídeo enviado, remova o arquivo à mão em
Storage › videos.

---

### 🔴 2.2 — Cobrança de verdade (gateway)

**O fluxo já existe inteiro.** `/app/planos/assinar` tem cupom, escolha entre Pix,
boleto, cartão de crédito e débito, e a confirmação grava de verdade: assinatura,
pagamento, uso do cupom e o plano no perfil, tudo numa transação pela RPC
`contratar_plano`.

O que é simulado — e a tela diz isso em cada etapa:

| Artefato | O que é real | O que é falso |
|---|---|---|
| **Pix** | payload EMV do Banco Central com CRC16 calculado | a chave, e o QR não é legível por app |
| **Boleto** | 47 dígitos com verificadores por módulo 10 | banco, agência e a cobrança |
| **Cartão** | máscara, bandeira e parcelamento | nada é validado nem enviado |

**O que falta:** escolher o gateway — para recorrência no Brasil, **Asaas** ou
**Iugu** (boleto e Pix nativos, que é como PJ pequena paga) ou **Stripe** se
houver cartão internacional. Depois: checkout hospedado ou tokenização, webhook
chamando `contratar_plano` em vez do navegador, régua de cobrança e bloqueio no
vencimento.

**Detalhe importante:** hoje quem chama `contratar_plano` é o cliente. Com
gateway, essa chamada precisa sair do navegador e virar webhook — senão qualquer
pessoa ativa o Pro pelo console. A função já está pronta para isso; só muda quem
a invoca.

Detalhe fiscal a alinhar com o CEO: emissão de NF-e de serviço por assinatura.

---

### 🟡 2.2b — QR do Pix não é legível

O QR desenhado na tela tem os três marcadores de posicionamento e módulos
derivados do payload, mas **não é um QR code válido** — gerar um exigiria um
codificador Reed-Solomon completo, e não vale o peso enquanto não há gateway.

O payload "copia e cola" ao lado dele, esse é bem formado. Quando o gateway
entrar, o QR vem pronto da API do provedor e este código sai.

---

### 🟡 2.3 — PDF do certificado

A tela mostra o certificado, o código de validação existe e o trigger no banco emite de
verdade — o que falta é o arquivo baixável.

**O que fazer:** gerar em Edge Function (`@react-pdf/renderer` ou Puppeteer), salvar no
bucket `certificados`, guardar a URL na linha e criar a página pública
`/validar/[codigo]` para o RH conferir. Essa página vale mais que o próprio PDF — é o que
torna o certificado verificável.

---

### 🟡 2.4 — E-mail transacional

Nada é enviado hoje: nem boas-vindas, nem certificado emitido, nem candidatura recebida,
nem recuperação de senha (a tela existe e finge sucesso).

Depende do SMTP do item 1.2. Mínimo para o go-live: boas-vindas, recuperação de senha,
certificado emitido, nova candidatura para a empresa e retorno da candidatura para o aluno.

---

### 🟡 2.5 — Mensagens diretas

As tabelas `conversas` e `mensagens` existem com RLS correto. **Não há interface.**

Ficou de fora de propósito: chat sem tempo real fica ruim, e realtime exigiria mais do que
cabia nesta rodada. Quando for fazer, usar Supabase Realtime (já incluso no plano),
com indicador de não lidas na sidebar e notificação por e-mail se a pessoa estiver offline.

---

### 🟢 2.6 — Tino no atendimento de reserva — **resolvido**

`N8N_WEBHOOK_URL` está vazia, então a rota responde por regras consultando o catálogo real.
Funciona e nunca deixa ninguém sem resposta, mas não é IA.

**O que fazer:** importar `n8n/tino-assistente.json`, preencher três campos e colar a URL
no `.env`. Passo a passo em **[N8N-TINO.md](N8N-TINO.md)**.

Antes de ligar: revisar o prompt com o CEO (item 4.1) e resolver o rate limiting (1.8).

**RESOLVIDO — 29/08/2026: o fluxo `tino` responde com IA de verdade, testado por webhook (`{"resposta":"Ok"}` em 4,6 s). O atendimento de reserva continua como rede de proteção quando o n8n cai.**

---

### 🟢 2.7 — Geração de questões sem IA — **resolvido**

O botão **Gerar 5 perguntas** (Cursos › editar aula) tenta três caminhos nesta
ordem: `N8N_QUESTOES_WEBHOOK_URL` → `ANTHROPIC_API_KEY` → modelo local.

Hoje nenhuma das duas variáveis está preenchida, então ele cai no **modelo
local**: um esqueleto de questão montado a partir do título, com a explicação
dizendo "reescreva". Serve para o admin não ficar com a tela vazia e para a
demonstração não travar — **não serve para publicar**.

**O que fazer:** importar `n8n/tino-questoes.json`, ativar e colar a URL em
`N8N_QUESTOES_WEBHOOK_URL`. Instruções em [N8N-TINO.md](N8N-TINO.md).
Para desenvolver sem n8n, basta `ANTHROPIC_API_KEY` no `.env.local`.

O aviso amarelo na tela já diz de qual fonte vieram as questões. Vale manter:
questão gerada por IA que ninguém revisou é responsabilidade técnica da escola.

**RESOLVIDO — 29/08/2026: os dois geradores (aula e banco) passam pela ponte `n8n/tino-ia.json` e devolvem `fonte: n8n`. O rascunho local segue como reserva, e a tela diz quando ele foi usado.**

---

### 🟢 2.8 — `cursos.alunos` é um número fixo, não a matrícula real

A coluna vem do seed e nunca é recalculada. Ela aparece no catálogo, no card do
curso e na ordenação **"Mais alunos"** do admin — que hoje ordena por um número
decorativo.

**O que fazer:** trocar por `count` de `public.matriculas`, ou manter a coluna
como cache atualizado por trigger na matrícula. A segunda opção é melhor para a
landing, que é estática e não deveria contar linha a cada visita.

---

### 🟢 2.9 — Sem registro de quem alterou o quê no admin

Cinco pessoas com acesso administrativo e nenhum log. Se um curso for
despublicado ou uma aula apagada por engano, não há como saber quem foi.

**O que fazer:** tabela `auditoria` (quem, quando, tabela, id, ação, diff) com
trigger nas tabelas do catálogo. Barato de fazer e impagável no dia em que
precisar.

---

### 🟢 2.10 — Dúvidas com IA — **resolvido**

A aba **Tirar dúvida com IA** dentro da aula funciona, grava e mostra o
histórico — mas hoje devolve a **resposta de reserva**: um texto honesto dizendo
que a IA não está conectada, que não vai arriscar resposta técnica, e
encaminhando para o fórum e o WhatsApp. A tela marca a resposta com o selo
*IA não conectada*.

**O que fazer:** importar `n8n/tino-duvidas.json` e preencher
`N8N_DUVIDAS_WEBHOOK_URL`. Passo a passo em [N8N-TINO.md](N8N-TINO.md).
Custo estimado: ~US$ 0,01 por dúvida.

O **fórum da turma**, ao lado, já funciona por inteiro: publicar, responder,
votar em útil, marcar melhor resposta, badge de instrutor.

**RESOLVIDO — 29/08/2026: `tino-duvidas` respondeu em 8,6 s com resposta completa sobre CT-e. A resposta honesta de "IA não conectada" continua para quando o fluxo cair.**

---

### 🟡 2.11 — A resposta da IA é gravada pelo cliente

Em `perguntarParaIA`, quem grava a linha em `public.duvidas` com o texto da
resposta é o **navegador**, depois de receber da rota. A policy só permite
escrever no próprio perfil, então ninguém escreve na dúvida de outro — mas um
usuário técnico consegue gravar como resposta da IA um texto que a IA não disse.

**Impacto hoje:** baixo. A dúvida da IA é privada: a pessoa só enganaria a si
mesma.

**Quando vira problema:** se um dia o histórico de dúvidas virar insumo de
relatório pedagógico ou de auditoria de qualidade.

**O que fazer:** mover a gravação para a própria rota `/api/duvida-ia`,
autenticando com o JWT do usuário e escrevendo do servidor.

---

### 🟢 2.12 — Notificação de resposta no fórum

Quem pergunta no fórum não é avisado quando alguém responde: precisa voltar na
aula e conferir. É o que mais reduz a taxa de retorno num fórum.

**O que fazer:** e-mail ao autor quando chega resposta (depende do SMTP,
item 2.4) e um indicador de não lidas no menu lateral.

---

### 🟡 2.13 — Tabelas fiscais das ferramentas precisam de dono

As 18 calculadoras fazem a conta certa, mas dependem de tabelas que mudam por
portaria: INSS, IRRF, anexos do Simples e percentuais de presunção. Todas estão
em [`src/lib/ferramentas/tabelas.ts`](../src/lib/ferramentas/tabelas.ts), e a
vigência aparece na tela de toda ferramenta que usa tabela oficial.

**O que fazer:** definir **quem** revisa e **quando**. Sugestão: a pessoa
responsável pelo DP confere INSS e IRRF em janeiro e a cada portaria; a
tributária confere Simples e presunções uma vez por ano. Sem dono definido, a
tabela envelhece e a ferramenta passa a entregar número errado com cara de
número certo — que é pior do que não ter ferramenta.

Detalhes de manutenção em [FERRAMENTAS.md](FERRAMENTAS.md).

---

### 🟢 2.14 — Métricas do painel marcadas como estimativa

Duas do painel administrativo não são contadas, são derivadas de modelo — e
aparecem marcadas como tal na tela:

| Indicador | Modelo hoje | Vira medido quando |
|---|---|---|
| Receita recorrente | base de planos × preço do plano | houver cobrança de verdade (item 2.2) |
| Visitantes (topo do funil) | 4 × cadastros | houver analytics na landing |

**O que fazer para os visitantes:** Plausible ou Umami (ambos leves e sem
cookie, o que evita o banner de consentimento) gravando visita por dia numa
tabela própria. Meia hora de trabalho e o funil fica inteiro medido.

O painel tem uma chave **Dados reais / Demonstração**. O cenário de demonstração
existe para apresentar a leitura que o painel entrega com a base cheia — não
para maquiar número. Ele é determinístico e está em `src/lib/metricas.ts`.

---

### 🟡 2.15 — E-mail do admin fica na fila, não sai

Tanto a mensagem individual (Alunos › ✉) quanto a campanha com canal de e-mail
gravam em `emails_admin` com status `pendente`. **Nada é enviado** — não há SMTP.

Para compensar, as duas também criam **notificação no app**, que é o canal que
chega de verdade hoje. A tela avisa isso nos dois lugares.

**O que fazer:** depende do item 2.4 (SMTP). Quando o provedor existir, um job
lê a fila, envia e marca `enviado`. A tabela já tem a coluna de status.

---

### 🟡 2.16 — Reativar conta não devolve o perfil ao banco de talentos

Desativar uma conta zera `perfil_publico` — a pessoa sai do banco de talentos na
hora, como deve ser. Ao reativar, o campo **não volta sozinho**: a pessoa precisa
marcar de novo em Meu perfil.

É o comportamento mais seguro (o consentimento de exposição pública é
re-solicitado), mas precisa estar claro para quem reativa. Vale escrever isso na
tela de reativação.

---

### 🟢 2.17 — Cupom não trava contratação concorrente

`contratar_plano` confere o limite de usos e incrementa o contador na mesma
transação, mas sem `select ... for update` no cupom. Duas contratações no mesmo
milissegundo poderiam estourar o limite em uma unidade.

**Impacto:** desprezível no volume atual. **Quando resolver:** junto com o
gateway, trocando por `update ... where usos < limite_usos returning` — que
resolve o problema com uma linha.

---

### 🟡 2.18 — Contato do talento é filtrado só na interface

`perfis` tem policy de leitura pública para quem marcou `perfil_publico`, e ela
devolve a **linha inteira** — telefone e e-mail incluídos. A caixa "Mostrar meu
contato para quem abrir meu perfil" (`perfis.contato_publico`) esconde o campo
na tela, mas quem chamar `/rest/v1/perfis` direto continua vendo o número.

**Impacto:** LGPD. A pessoa desmarcou, a plataforma diz que respeitou, e o dado
sai pela API mesmo assim.

**O que fazer:** trocar a leitura pública por uma view `talentos_publicos` com
as colunas permitidas (sem telefone quando `contato_publico = false`), dar
SELECT só nela e remover a policy de leitura pública da tabela. As telas já
consomem por `carregarPerfilPorId`, então o ajuste fica concentrado no repo.

---

### 🟡 2.19 — Mensagem entre pessoas não tem caixa de entrada

`mensagem_para_talento()` grava em `conversas`/`mensagens` e avisa por
notificação — o contato chega. O que não existe é a tela para **ler a conversa**
e responder dentro da plataforma: quem recebe vê o texto na notificação e
responde por fora (WhatsApp, e-mail).

**Impacto:** a conversa acontece fora da Academy, e a empresa não tem histórico.

**O que fazer:** uma tela `/app/mensagens` lendo `conversas` + `mensagens` (o RLS
já está pronto e testado) com resposta em linha. É trabalho de tela, não de banco.

---

### 🟢 2.20 — Uma avaliação sobrescreve a nota do catálogo

`trg_nota_curso` recalcula `cursos.nota` como média simples das avaliações.
Com uma única avaliação, o curso passa a exibir a nota daquela pessoa — foi o
que aconteceu no teste: 4,9 do seed virou 5,0 com um voto.

**Impacto:** nenhum risco, mas a nota fica volátil enquanto a base é pequena.

**O que fazer:** média bayesiana com um prior (por exemplo, cinco votos
imaginários na nota 4,5) até o curso ter volume. Uma linha na função.

---

### 🟢 2.21 — Modo "provas anteriores" não busca prova nenhuma

A opção "No estilo de provas anteriores" (`/admin/questoes/gerar`) instrui o
modelo a **imitar o formato** da banca e a preencher banca, ano e prova de
referência. Ela não consulta acervo de prova e não copia enunciado — copiar
prova de terceiro seria uso de material que não é nosso. A tela diz isso ao
administrador, e a questão nasce marcada como `origem = 'prova'`.

**Impacto:** a referência ("Exame de Suficiência 2023.1") é plausível, não
verificada. Publicada sem revisão, a plataforma afirma uma procedência que não
conferiu.

**O que fazer:** ou licenciar um acervo de provas e importar de verdade, ou
trocar o rótulo na interface do aluno para "no estilo de" em vez de nomear a
prova. Enquanto isso, a revisão do admin é o controle.

---

### 🟢 2.22 — Feedback do simulado — **resolvido**

`/api/feedback-simulado` tenta, nesta ordem: `N8N_FEEDBACK_WEBHOOK_URL`,
`ANTHROPIC_API_KEY`, o fluxo geral do Tino (`N8N_WEBHOOK_URL`) e, por último,
uma análise local por regras.

Hoje o caminho real é o terceiro: a análise viaja como mensagem para o
assistente, que responde bem porque o prompt vai pronto. Funciona, mas o
assistente carrega o catálogo de cursos no contexto a cada chamada — custo que
esta rota não precisa pagar.

**Impacto:** alguns centavos a mais por análise e uma resposta ocasionalmente
mais "comercial" do que técnica.

**O que fazer:** um workflow dedicado no mesmo molde de
`n8n/tino-questoes-banco.json`, sem o bloco do catálogo, apontado por
`N8N_FEEDBACK_WEBHOOK_URL`. A rota já prefere essa variável quando ela existe.

**RESOLVIDO — 29/08/2026: passou a usar `N8N_FEEDBACK_WEBHOOK_URL` apontando para a ponte de IA, sem o custo do catálogo no contexto. Testado: `fonte: n8n`.**

---

### 🟢 2.23 — Fluxos de questões respondiam vazio — **resolvido**

Os dois webhooks de questão (`tino-questoes` e `tino-questoes-banco`) devolvem
**200 com corpo vazio** em ~1s. O fluxo do assistente (`tino`), no mesmo n8n,
responde normalmente em ~4s — então a credencial da Anthropic existe na conta,
mas não está selecionada no nó **Claude** desses dois workflows.

Quando a execução para antes do nó *Respond to Webhook*, o n8n encerra a
requisição sem corpo. É por isso que a falha era silenciosa.

**Impacto:** a geração de questões cai no rascunho local, sem IA.

**O que fazer:** abrir cada workflow, selecionar a credencial `Anthropic API`
no nó Claude, salvar e ativar. A tela agora diz exatamente isso quando o corpo
vem vazio — não mais "configure a variável".

**RESOLVIDO — 29/08/2026: a causa era `temperature` no corpo enviado à Anthropic — a API responde 400 ("`temperature` is deprecated for this model") no claude-sonnet-5, o 400 derruba a execução antes do nó *Respond to Webhook*, e o n8n encerra a requisição com 200 e corpo vazio. Não era credencial. Corrigido nos JSON do repositório e na ponte de IA nova.**

---

### 🟢 2.24 — Comentário de questão não tem moderação proativa

Qualquer aluno autenticado escreve na questão, e o texto aparece para a turma.
O admin pode apagar (a policy permite), mas não existe fila de moderação nem
aviso quando alguém comenta.

**Impacto:** baixo enquanto a base é pequena e conhecida. Numa turma aberta,
comentário errado sobre gabarito espalha erro com a autoridade de quem "já
respondeu".

**O que fazer:** reaproveitar `questao_reportes` para comentários, ou marcar
comentário de instrutor com selo — o segundo resolve mais barato, porque o
problema real é distinguir quem sabe de quem acha.

---

### 🔴 2.25 — Um segundo bloco de "temperature" pode voltar a derrubar tudo

O `temperature` foi removido dos quatro JSON do repositório e da ponte, mas os
workflows que **já estão no n8n do cliente** foram importados antes da correção.
Dois deles (`tino-questoes` e `tino-questoes-banco`) continuam com o parâmetro
e continuam devolvendo 200 vazio se alguém apontar uma variável de ambiente
para eles de novo.

**Impacto:** hoje nenhum. Amanhã, se alguém "arrumar" o `.env` apontando de
volta para o fluxo antigo, a IA some sem erro visível.

**O que fazer:** no n8n, abrir os dois fluxos, apagar `temperature: 0.7,` do
corpo do nó Claude e salvar — ou simplesmente arquivá-los, já que a ponte
`tino-ia` cobre os dois casos.

---

### 🟡 2.26 — Nenhum workflow do n8n está exposto ao MCP

`search_workflows` lista os quatro fluxos antigos, mas `get_workflow_details`
recusa com "Workflow is not available in MCP". Sem isso não dá para revisar,
corrigir nem ler execuções deles por aqui — foi por isso que a ponte nova
precisou ser criada em vez de o fluxo existente ser consertado.

**Impacto:** manutenção do n8n fica manual.

**O que fazer:** no n8n, no card de cada workflow, ligar o acesso via MCP.
A ponte `Tino — ponte de IA` já nasce com ele ligado.

---

### 🟡 5.4 — Login com Google depende de uma configuração fora do código

O botão está pronto: checa se o provedor está ligado, redireciona, volta em
`/auth/callback` e o gatilho `handle_new_user` cria o perfil com nome e foto do
Google. Falta o que só existe no painel — Client ID e Secret do Google Cloud,
o provedor ligado no Supabase e as **Redirect URLs** de cada ambiente.

**Impacto:** enquanto não for feito, o botão diz que o login social não está
habilitado e a pessoa entra por e-mail e senha. Nada quebra.

**O que fazer:** o passo a passo está em [SUPABASE.md](SUPABASE.md), seção
"Entrar com Google". Cinco minutos. **Antes do deploy**, lembrar de acrescentar
`https://SEU-DOMINIO/auth/callback` às Redirect URLs — sem isso o login social
funciona em `localhost` e falha em produção.

---

### 🔴 6.7 — Variáveis de ambiente da Vercel

O `.env.local` não sobe para o Git (e não deve). No deploy, estas precisam ser
recriadas em **Vercel › Settings › Environment Variables**:

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (chave publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (secret) — **nunca** com prefixo `NEXT_PUBLIC_` |
| `N8N_WEBHOOK_URL` | `/webhook/tino` |
| `N8N_DUVIDAS_WEBHOOK_URL` | `/webhook/tino-duvidas` |
| `N8N_QUESTOES_WEBHOOK_URL` | `/webhook/tino-ia` |
| `N8N_QUESTOES_BANCO_WEBHOOK_URL` | `/webhook/tino-ia` |
| `N8N_FEEDBACK_WEBHOOK_URL` | `/webhook/tino-ia` |

**Impacto:** sem elas o site sobe inteiro, mas em modo demonstração — catálogo
do seed local, nenhum login real. É o erro de deploy mais comum deste projeto,
e ele **não** dá erro na tela: só parece que o banco esvaziou.

**O que fazer:** conferir em `/diagnostico` logo depois do primeiro deploy.

---

### 🟡 6.8 — Supabase › Site URL ainda aponta para localhost

Depois do deploy, **Authentication › URL Configuration › Site URL** precisa
virar o domínio de produção. É o endereço que o Supabase usa nos links de
confirmação de e-mail e de recuperação de senha.

**Impacto:** o e-mail de "esqueci a senha" leva a pessoa para `localhost:3000`.

**O que fazer:** trocar a Site URL e manter as duas entradas em Redirect URLs
(local e produção) enquanto o time ainda desenvolve.

---

### 🟢 7.1 — Upload direto para o YouTube pela tela de cursos — pesquisado, não implementado

**O que foi pedido:** enviar o vídeo da aula para o canal do YouTube direto de
`/admin/cursos`, sem abrir o YouTube Studio.

**É possível?** Tecnicamente sim, pelo `videos.insert` da YouTube Data API v3.
Mas três coisas pesam contra fazer isso agora:

1. **O vídeo sobe travado em "privado".** Projetos de API não verificados
   criados depois de 28/07/2020 têm todo upload por `videos.insert` restrito a
   *private*, e vídeo privado **não toca em player incorporado** — a aula
   ficaria muda. Destravar exige uma **auditoria de conformidade** do projeto
   junto ao Google, com prazo de dias a semanas.
2. **A tela de consentimento OAuth precisa ser publicada.** Enquanto estiver em
   modo de teste, só até 100 contas listadas manualmente conseguem autorizar.
3. **O caminho do arquivo não cabe na Vercel.** Funções serverless da Vercel
   têm teto de ~4,5 MB no corpo da requisição. Um vídeo de aula não passa por
   lá: seria preciso o servidor abrir uma *sessão de upload retomável* no
   Google e o navegador enviar os bytes direto, o que é um caminho que não dá
   para testar sem as credenciais reais do canal.

**A cota deixou de ser problema.** Desde junho/2026 os uploads têm balde
próprio: cerca de 100 por dia, em vez dos ~6 do modelo antigo, quando cada
upload custava 1.600 das 10.000 unidades diárias compartilhadas.

**Impacto de não ter:** o vídeo continua sendo enviado pelo YouTube Studio e o
link colado na aula. São dois cliques a mais por aula.

**O que fazer quando for a hora, na ordem:**

1. Google Cloud › criar projeto › ativar **YouTube Data API v3**.
2. Tela de consentimento OAuth: tipo **Externo**, e **publicar** (sair do modo
   de teste).
3. Solicitar a **auditoria de API** — é o formulário que libera upload público.
   Sem ela, todo vídeo enviado nasce privado.
4. Credencial OAuth de aplicativo Web, com `redirect_uri` apontando para
   `https://SEU-DOMINIO/api/youtube/callback`.
5. Escopo necessário: `https://www.googleapis.com/auth/youtube.upload`.
6. Guardar o `refresh_token` do canal em tabela com RLS fechada, lida só pela
   `service_role` — ele dá direito de publicar no canal e **não pode** chegar
   ao navegador.
7. Implementar como upload retomável iniciado no servidor e enviado pelo
   navegador, nunca proxy pela função serverless.

---

### 🟢 7.2 — Leitura do link de vídeo — **implementado**

Colar o link do YouTube ou do Vimeo em `/admin/cursos` agora traz título, canal
e miniatura na hora, com um botão para usar o título na aula. Usa oEmbed, que é
aberto: sem chave de API e sem consumir cota. Fica em
[`/api/video-info`](../src/app/api/video-info/route.ts), com lista de hosts
permitidos — a rota não pode virar um buscador de URL arbitrária.

---

### 🟡 7.3 — O nome do aluno chega ao Tino por contexto, não pelo prompt do fluxo

O Tino já abre com "Olá, Mariana!" e as respostas do n8n vêm com o nome. Isso
funciona porque a rota `/api/assistente` cola uma linha de contexto na frente
da mensagem antes de mandar para o webhook — o fluxo do n8n não foi alterado.

**Por que assim:** o workflow do assistente (`My workflow`, id
`QtuWOs3cXUkS5PkL`) continua com **acesso via MCP desligado**, então não dá
para editar o prompt dele por aqui. `search_workflows` lista o fluxo, mas
`get_workflow_details` responde *"Workflow is not available in MCP"*.

**Impacto:** nenhum hoje. A linha de contexto é uma instrução a mais no
começo de toda mensagem — custa alguns tokens e depende de o modelo obedecer.

**O que fazer:** no n8n, no card do workflow, ligar o acesso via MCP. Com isso
o nome pode ir para o *system prompt*, que é o lugar certo dele. Vale para os
outros três fluxos antigos também (ver 2.26).

---

### 🟡 7.4 — Dúvidas da aula ainda não sabem o nome de quem pergunta

O `/api/duvida-ia` não recebe o perfil de quem está perguntando — só o texto da
dúvida e o contexto da aula. O Tino do chat cumprimenta pelo nome; o assistente
de dúvidas, não.

**Impacto:** inconsistência de tom entre duas telas.

**O que fazer:** passar `usuario` no corpo em `src/components/duvidas.tsx` e
reaproveitar o mesmo `comNomeDoAluno` da rota do assistente.

---

### 🟢 7.5 — Certificado ainda não tem QR code de verdade

A página `/validar` funciona e o link direto `/validar/CODIGO` também. O ícone
de QR no diploma, porém, continua sendo só um ícone — não é um código lido por
câmera.

**Impacto:** quem imprime o certificado precisa digitar o código.

**O que fazer:** gerar o QR apontando para `/validar/CODIGO` na hora de montar
o PDF. Como o PDF ainda não é gerado (o botão existe mas não baixa nada), as
duas coisas fecham juntas.

---

### 🟡 7.6 — Termos de uso são aceitos, mas ainda não existem

A tela `/completar-cadastro` grava `perfis.consentimento_em` com a data do
aceite — inclusive para quem entra pelo Google, que antes nunca aceitava nada.
Só que os dois links ("Termos de Uso" e "Política de Privacidade") ainda não
apontam para documento nenhum.

**Impacto:** o registro de consentimento existe, mas aponta para um texto que
não foi escrito. Ver 5.1, que continua bloqueando o go-live.

**O que fazer:** publicar os dois documentos e transformar os `<span>` em
links reais no formulário.

---

### 🟢 7.7 — Fila de revisão usa o fuso de Feira de Santana

`questoes_para_revisar` calcula "hoje" com `America/Bahia`, não com
`current_date` (que no Postgres é UTC). Sem isso a fila virava o dia às 21h e
quem estudasse à noite veria a fila de amanhã aparecer no meio da sessão.

**O que observar:** se a Academy passar a atender aluno fora do horário de
Brasília, o fuso deixa de poder ser fixo — passa a ser preferência do perfil.

---

### 🟢 8.1 — Materiais da aula — **implementado**

`/admin/cursos` ganhou o bloco **Materiais de apoio** dentro da aula: envio de
arquivo (até 50 MB, bucket privado `materiais`) ou link externo. O aluno baixa
na aba **Materiais** da aula, por URL assinada gerada no clique — o endereço
não fica no HTML e expira em uma hora.

**O que observar:** o bucket é de 1 GB no plano free do Supabase, o mesmo teto
que já vale para vídeo. Vinte planilhas de 5 MB não incomodam; um curso inteiro
em PDF de alta resolução, sim.

---

### 🟢 8.2 — Endereço por CEP — **implementado**

Cidade e UF eram campo livre, e o banco acumulava quatro grafias da mesma
cidade — o que estraga o filtro do banco de talentos. Agora a pessoa digita o
CEP em `/completar-cadastro` e em `/app/perfil`, e rua, bairro, cidade e UF vêm
prontos. Só número e complemento são digitados.

A consulta passa por [`/api/cep`](../src/app/api/cep/route.ts), que tenta a
**BrasilAPI** e cai para o **ViaCEP** — as duas gratuitas e sem chave. Há um
"corrigir à mão" para loteamento novo, cujo CEP costuma voltar incompleto.

**O que observar:** as duas APIs são de terceiros e não têm SLA. Se as duas
caírem, a tela avisa e libera o preenchimento manual — nada trava.

---

### 🟡 8.3 — Endereço antigo não foi normalizado

Quem já tinha cidade/UF preenchidos continua com o que digitou. A coluna `cep`
fica nula até a pessoa passar de novo pelo perfil.

**Impacto:** o banco tem os dois mundos convivendo por um tempo.

**O que fazer:** nada urgente. Se algum dia o filtro por cidade ficar
importante para uma empresa cliente, vale um script que consulte o CEP de quem
já tem endereço e normalize a grafia.

---

### 🟢 8.4 — Dúvida com IA dentro da questão — **implementado**

Nova aba no cartão da questão, ao lado de **Comentários** (que continua: um é a
turma, o outro é o instrutor). O Tino recebe o enunciado, as alternativas, o
gabarito **e a alternativa que a pessoa marcou** — por isso ele explica o erro,
não só a questão.

Gratuito: **uma por dia**. Pro: ilimitado. O teto está em
`status_duvida_ia_questao()`, no banco — a interface só reflete.

**Não foi criado um quarto workflow no n8n.** A ponte `Tino — ponte de IA` já
recebe `{ system, user }` e devolve `{ resposta }`, que é exatamente o que esta
rota precisa; um fluxo a mais seria mais um lugar para o `temperature` voltar a
derrubar tudo (ver 2.23 e 2.25). A variável nova é
`N8N_DUVIDA_QUESTAO_WEBHOOK_URL`, apontando para a mesma ponte.

---

### 🟢 8.5 — Tino nas telas públicas — **implementado**

O assistente saiu de dentro do `AppShell` e passou para o layout raiz: agora
existe na página inicial, no login, no cadastro e na validação de certificado.
Quem tem mais dúvida é justamente quem ainda não criou conta, e antes essa
pessoa nunca o encontrava.

Sem sessão, a saudação é genérica e as perguntas sugeridas mudam (produto, não
estudo). O botão virou pílula com o leão da marca — círculo sozinho não diz o
que é.

**O que observar:** cada conversa de visitante consome crédito da Anthropic sem
nenhum cadastro em troca. Se virar porta de spam, o caminho é um limite por IP
na rota `/api/assistente`.

---

### 🟡 8.6 — O leão do Tino é um recorte em CSS

O avatar usa `public/logoCastelo.png` deslocado dentro de um círculo, porque a
marca não tem uma versão quadrada só do brasão. Os números do recorte estão
comentados em `src/components/tino.tsx`.

**Impacto:** se a arte do logotipo mudar de proporção, o avatar corta errado.

**O que fazer:** pedir ao designer um PNG do leão isolado, quadrado e com fundo
transparente. Aí o recorte vira uma linha só.

---

### 🟢 8.7 — Certificado de trilha — **refeito**

Curso e trilha usavam desenhos diferentes, em dois arquivos. Agora existe um
componente só ([`certificado.tsx`](../src/components/certificado.tsx)) com duas
variantes, usado tanto na área do aluno quanto na validação pública — o mesmo
documento dos dois lados é metade da confiança que ele transmite.

A peça da trilha ganhou moldura dupla, medalha e as habilidades logo abaixo do
nome da trilha. Os dois carregam agora o lockup completo **Castelo Branco |
Academy**.

---

## 9. Ferramentas na questão e área da empresa

Rodada de 30/08/2026. Duas frentes: a bancada de cálculo dentro da questão e a
conta de empresa deixando de ser um papel decorativo.

### 🟢 9.1 — Ferramentas dentro da questão — **implementado**

A aba **Ferramentas** entra na barra da questão
([`ferramentas-questao.tsx`](../src/components/ferramentas-questao.tsx)) e abre
**antes** de responder, de propósito: calculadora e tabela oficial não entregam
gabarito — são o que a pessoa teria em cima da mesa numa prova de verdade.

Ela traz três coisas:

- **Calculadora com fita.** Questão de cálculo quase nunca é uma conta só; sem
  a fita a pessoa refaz tudo quando erra a última tecla. O `%` é o de
  calculadora de escritório (`200 + 10% = 220`), não o de dividir por cem
  solto. Teclado numérico funciona.
- **A ferramenta certa para o assunto.** O catálogo tem dezoito; mostrar todas
  seria o mesmo que não sugerir nada. A relevância sai de área, assunto, tags
  e enunciado ([`na-questao.ts`](../src/lib/ferramentas/na-questao.ts)), com
  rede de segurança por área — "Regimes Aduaneiros" não diz "importação", mas
  quem estuda isso quer o simulador de custo de importação por perto.
- **Tabelas oficiais.** INSS e IRRF, com vigência declarada. A questão de folha
  traz o salário e cobra o desconto; a tabela fica pressuposta.

Ficaram **de fora** duas ferramentas, e o motivo está no código: o validador de
CPF/CNPJ resolve problema de cadastro, não de prova, e o simulador de
parcelamento depende de dívida real com data de consolidação — nada disso cabe
num enunciado de múltipla escolha.

> **Pendência pequena:** as tabelas de referência mostradas são as mesmas de
> `tabelas.ts`, que precisam de dono declarado (ver 2.13). Tabela desatualizada
> dentro da questão é pior que tabela desatualizada numa calculadora avulsa,
> porque aqui a pessoa está estudando para uma prova.

---

### 🟢 9.2 — Área da empresa — **implementada**

Antes, `role = 'empresa'` só escondia a meta de PEPC na barra lateral. As
tabelas `empresas`, `empresa_membros` e `vagas.empresa_id` existiam desde o
`01_schema.sql` sem nenhuma tela.

Agora existe `/empresa` com seis telas, e a migração
[`18_area_da_empresa.sql`](../supabase/18_area_da_empresa.sql) com 25 funções:

| Tela | O que resolve |
|---|---|
| **Painel** | O que precisa de atenção primeiro (atrasados, parados, assentos ociosos), depois os números do ano e a conformidade PEPC do time. |
| **Pessoas e licenças** | Equipe, convites, licença ligada/desligada por pessoa, promoção a gestor, desligamento. |
| **Formações** | Curso ou trilha com prazo, para o time ou para uma pessoa, com o progresso de cada um. |
| **Relatório PEPC** | Pontuação por profissional no ano-base, com o código público de cada certificado, e exportação em CSV que o Excel brasileiro abre direito. |
| **Minhas vagas** | Publicar, pausar, ver candidatos e mover o status da candidatura. |
| **Cadastro** | Dados da empresa, endereço por CEP, cor da marca. |

**As decisões que valem lembrar depois:**

- **A licença é do vínculo, não da pessoa.** Aceitar um convite de licença
  guarda o plano anterior em `empresa_membros.plano_anterior` e sobe para Pro;
  sair do time devolve o plano guardado. Sem isso, o desligamento deixaria um
  Pro vitalício de graça — ou rebaixaria quem já pagava Pro sozinho antes de
  ser contratado.
- **Convite tem duas naturezas.** `licenca` consome assento e dá Pro;
  `desconto` não consome assento e abate um percentual no checkout
  (`/app/planos/assinar` já mostra a linha separada do cupom). Serve para o
  escritório que quer beneficiar mais gente do que contratou.
- **Atribuição "para o time" é regra, não atalho.** Grava `perfil_id = null` e
  é expandida na leitura, então quem for contratado mês que vem já entra com a
  formação pendente.
- **Assento é cláusula de contrato.** `licencas_contratadas` só muda pelo
  painel do admin (`/admin/vagas` → Empresas). O gatilho
  `empresas_trava_licencas` recusa a alteração vinda de sessão de usuário, então
  não há caminho pela API que contorne a tela.
- **Gestor é vínculo, não papel de usuário.** A guarda de `/empresa` consulta
  `empresa_membros`, não `perfis.role`: uma pessoa com `role = 'aluno'` pode ser
  a gestora do escritório dela, e a dona da conta pode ter sido rebaixada a
  membro.
- **O gestor lê o progresso do time por função `security definer`**
  (`pct_curso`, `pct_trilha`), porque o RLS de `progresso_aulas` — corretamente
  — só devolve a linha do próprio dono. A permissão volta explícita dentro da
  função, checada contra `empresa_membros` por `pode_ver_progresso`.

**Correção de arrasto:** `candidatos_da_vaga` exigia `is_admin()`, embora a
policy de `candidaturas` já liberasse a leitura para a empresa dona da vaga. A
tela do gestor mostrava "7 candidatos" no cartão e "ninguém se candidatou" ao
abrir. Agora a função aceita admin **ou** membro da empresa, e existe policy de
UPDATE para a empresa mover o status da candidatura.

---

### 🔴 9.3 — Não há tela para criar o primeiro gestor de uma empresa

O gestor convida o time sozinho, mas **alguém precisa criá-lo**. Hoje isso é
uma linha de SQL (documentada em [`DEPLOY.md`](./DEPLOY.md#7-passo-5--depois-do-primeiro-deploy)):

```sql
insert into public.empresa_membros (empresa_id, perfil_id, papel, status, entrou_em)
values ('<empresa>', '<perfil>', 'gestor', 'ativo', now())
on conflict (empresa_id, perfil_id) do update set papel = 'gestor', status = 'ativo';
```

**Impacto:** toda venda nova exige o desenvolvedor. Não escala nem para dez
clientes.

**O que fazer:** em `/admin/vagas` → Empresas, um botão "Vincular gestor" que
busque o perfil por e-mail e insira a linha. Meia hora de trabalho, e tira o
SQL manual do processo comercial.

---

### 🟡 9.4 — O convite não é enviado por e-mail

`empresa_criar_convites` gera o código e o link; quem envia é o gestor, pelo
canal dele. A tela diz isso com todas as letras em vez de fingir que mandou.

**Impacto:** funciona, mas parece inacabado para um comprador corporativo — e
convite anotado à mão se perde.

**O que fazer:** entra junto com 2.11 (envio de e-mail transacional). O corpo
já está pronto na cabeça: nome da empresa, o que a licença dá e o link.

---

### 🟡 9.5 — Uma pessoa só pode estar em uma empresa

`minha_empresa_id()` devolve um vínculo. Contador que atende dois escritórios,
ou consultor com dois contratos, precisaria escolher.

**Impacto:** baixo no piloto, real no médio prazo — é comum no mercado contábil.

**O que fazer:** trocar `minha_empresa_id()` por uma empresa "ativa" escolhida
na barra lateral, guardada em `perfis.empresa_ativa`. O resto das funções já
recebe o id como parâmetro implícito e não muda de forma.

---

### 🟡 9.6 — O desconto da empresa não tem validade nem teto

`empresa_membros.desconto_pct` vale enquanto o vínculo existir, sem data de
expiração e sem limite de renovações. Um desconto de 80% concedido uma vez
segue valendo para sempre.

**Impacto:** comercial, não técnico. Aparece na primeira renovação.

**O que fazer:** decidir a regra com o CEO antes de ligar a cobrança de verdade
(2.2) — a coluna aceita a data quando ela for definida.

---

### 🔴 9.8 — Os depoimentos da página inicial são inventados

A seção "Quem estudou aqui voltou para o escritório sabendo fazer" usa nomes,
textos e fotos de composição ([`depoimentos.ts`](../src/lib/depoimentos.ts)).
As fotos vêm do randomuser.me, conjunto livre para prototipagem.

**Impacto:** publicar avaliação inventada como se fosse de aluno é propaganda
enganosa. Num produto que vende **certificado com validação pública**, é
exatamente a credibilidade que está à venda — e é ela que se perde quando
alguém descobre. Enquanto o site não for divulgado, é material de composição
como o resto do seed; no dia em que a URL for para um cliente, vira problema.

**O que fazer:** trocar por depoimento real com autorização de uso de nome e
imagem — três bastam. Enquanto não houver aluno formado para depor, tirar a
seção do ar é preferível a mantê-la: `<Depoimentos />` sai de uma linha em
[`page.tsx`](../src/app/page.tsx).

> A **média e a contagem** ao lado dos depoimentos não têm esse problema: são
> calculadas do catálogo real em `page.tsx`, não do arquivo de vitrine. Número
> agregado inventado seria mentira de outra natureza, e essa dava para evitar
> de graça.

---

### 🟢 9.7 — Sem logotipo da empresa

O selo da empresa usa cor da marca + iniciais. `empresas.logo_url` existe e
está vazio; o upload entra junto com a personalização do certificado por
empresa.

---

## 3. Dados e banco

### 🟡 3.1 — Selo de trilha não retroage sozinho

O trigger emite o selo quando um **novo** certificado completa a trilha. Aluno que já tinha
todos os certificados antes da trilha existir não recebe nada.

O backfill está no fim de `supabase/07_seed_avancado.sql`. **Rodar de novo toda vez que
criar uma trilha nova com cursos já existentes** — senão os alunos veteranos ficam de fora.

Vale transformar em função (`recalcular_selos_trilha(trilha_id)`) chamada pelo admin ao
publicar trilha.

---

### 🟡 3.2 — Seed de demonstração misturado com dados reais

`02_seed.sql` e `07_seed_avancado.sql` criam catálogo real (bom, aproveitável) junto com
progresso, posts, conexões e certificados fictícios (ruim, polui).

**O que fazer:** no banco de produção, rodar `01`, `04`, `05`, `06` e a **parte de catálogo**
do `02`/`07`. Pular contas, progresso, feed e certificados de exemplo. O feed vazio no
primeiro dia é normal e melhor do que post falso de empresa que não existe.

---

### 🟢 3.3 — Sem rotina de backup testada

O Supabase faz backup diário automático (7 dias de retenção no plano Pro). **Nunca foi
testado restaurar.** Backup não testado não é backup.

**O que fazer:** uma vez por mês, restaurar num projeto descartável e conferir se os dados
voltam. Para o plano Free não há PITR — no go-live, subir para Pro.

---

### 🟢 3.4 — Sem versionamento das migrações

Os arquivos SQL são numerados na mão e rodados pelo editor do Supabase. Funciona com 5
devs e um banco; não funciona com ambiente de homologação separado.

**O que fazer:** adotar o Supabase CLI (`supabase migration new`), que versiona e aplica em
ordem, e permite subir homologação idêntico à produção com um comando.

---

### 🟢 3.5 — Habilidade autodeclarada convive com o selo

O modelo mudou: habilidade passa a vir do certificado. As linhas antigas de
`perfil_habilidades` com `origem = 'manual'` continuam no banco e aparecem no
perfil sob "Informadas pelo profissional", sem medalha, com borda tracejada.

**Impacto:** nenhum — a distinção está explícita na tela e o match continua
considerando as duas. Mas a base fica com dois tipos de dado para a mesma coisa.

**O que fazer:** decidir com o CEO se as declaradas somem depois da virada. Se
sumirem, um `delete from perfil_habilidades where origem = 'manual'` resolve —
depois de avisar quem tem perfil publicado, porque isso muda o que a empresa vê.

---

### 🟢 3.6 — Avisos de desempenho do RLS nunca foram tratados

O linter de desempenho do Supabase aponta, no schema inteiro: 135 casos de
`multiple_permissive_policies` (duas policies permissivas para o mesmo comando
na mesma tabela — as duas são avaliadas), 59 de `auth_rls_initplan`
(`auth.uid()` reavaliado linha a linha em vez de uma vez por consulta), 47
chaves estrangeiras sem índice e 1 índice duplicado. Nenhum é ERRO.

**Impacto:** irrelevante no volume atual (dezenas de linhas). Com dezenas de
milhares de alunos, cada `select` em `perfis` ou `progresso_aulas` paga esse
custo por linha.

**O que fazer:** antes do primeiro pico de uso — trocar `auth.uid()` por
`(select auth.uid())` dentro das policies, unir as policies permissivas
redundantes e indexar as FKs mais consultadas (`progresso_aulas.aula_id`,
`respostas_questoes.questao_id`, `certificados.curso_id`). É mecânico e não
muda comportamento.

---

## 4. Conteúdo e negócio

### 🟡 4.1 — Prompt do Tino não foi revisado pelo CEO

O prompt carrega o contexto institucional que extraí do site: método de quatro fases,
camadas C1–C4 com a regra de nunca sugerir nada da C4, foco em transporte, logística e
comércio exterior.

É a voz da Castelo Branco falando com cliente. **Precisa do aval de quem responde por ela.**
Ver a seção "O prompt" em [N8N-TINO.md](N8N-TINO.md).

---

### 🟡 4.2 — Valores dos planos são hipótese minha

R$ 89/mês no Pro veio de comparação com o mercado, não de decisão comercial. O comparativo
de 20 linhas e o desconto anual de 20% também.

Definir com o CEO antes de qualquer página ir ao ar com preço.

---

### 🟡 4.3 — Conteúdo dos cursos é estrutura, não aula

10 cursos, 73 aulas: títulos, durações, módulos e ementa existem e são coerentes. **O
conteúdo em si não existe** — nem vídeo, nem material, nem exercício.

As 27 questões são autorais e utilizáveis, mas 27 não sustenta um banco de questões. Meta
razoável para lançamento: 300–500, distribuídas pelas 6 áreas.

Esse é o item de maior prazo da lista inteira e não depende de código.

---

### 🟢 4.4 — Recompensas da gamificação prometem coisas reais

A conquista "Hora extra" promete **1 curso avulso à sua escolha**. Está escrito na tela e o
aluno vai cobrar.

**O que fazer:** decidir se a recompensa vale mesmo, e se valer, criar o fluxo de resgate
(hoje a conquista é concedida, mas nada acontece depois). Alternativa: trocar por algo de
custo zero — destaque no banco de talentos, selo no perfil, badge no certificado.

---

## 5. Jurídico e conformidade

### 🔴 5.1 — Sem termos de uso e política de privacidade

A tela de cadastro tem o link, mas a página não existe.

**O que fazer:** redigir com apoio jurídico. Precisa cobrir: dados coletados, finalidade,
base legal, compartilhamento com empresas no banco de talentos (esse é o ponto sensível —
o currículo do aluno fica visível para terceiros), retenção e direitos do titular.

---

### 🔴 5.2 — Exclusão de conta não apaga nada

A tela de perfil tem a seção LGPD com o botão. Ele não faz nada.

**O que fazer:** implementar exclusão de verdade — anonimizar ou remover perfil,
progresso, certificados, posts, comentários e candidaturas; deslogar todas as sessões
(item 1.9); confirmar por e-mail; responder em até 15 dias, como manda a LGPD.

Decidir também o que fazer com certificados já emitidos: o normal é manter o registro de
validação com o nome, porque é documento — mas isso precisa estar escrito na política.

---

### 🟡 5.3 — Consentimento do banco de talentos

Hoje o perfil vira público no banco de talentos por um campo booleano, sem consentimento
registrado.

**O que fazer:** guardar data, hora, IP e versão do termo aceito no momento em que o aluno
libera o perfil. Sem esse registro, não há como provar o consentimento.

---

## 6. Infraestrutura e operação

### 🔴 6.1 — Nunca foi feito deploy

O projeto só rodou em `localhost`. Não há domínio, ambiente de homologação nem pipeline.

**O que fazer:** Vercel (é Next.js, o encaixe é natural), domínio próprio — sugestão
`academy.castelobrancocontabilidade.com.br` —, variáveis de ambiente configuradas lá (não
no repositório) e preview automático por branch, que resolve boa parte da revisão entre 5
devs.

---

### 🔴 6.2 — O projeto não está em Git

Não há repositório. Cinco pessoas mexendo em código sem controle de versão termina em
arquivo sobrescrito.

**O que fazer, antes de qualquer outra coisa desta lista:**

```bash
git init && git add -A && git commit -m "MVP Castelo Branco Academy"
```

Depois subir para GitHub privado. O `.gitignore` já está correto — ignora `.env`, `.env.*`
e mantém o `.env.local.example`. **Confirmar que nenhuma chave real entrou no primeiro
commit** antes de dar push.

---

### 🟡 6.3 — Sem monitoramento

Erro em produção hoje só aparece se o usuário reclamar.

**O que fazer:** Sentry no free tier (erro de cliente e de servidor), alerta de erro no
Supabase e um uptime check simples. Meia hora de trabalho que evita descobrir a queda pelo
WhatsApp do CEO.

---

### 🟡 6.4 — Sem testes automatizados

Zero testes. Toda a validação até aqui foi manual, feita por mim contra o banco real.

**O que fazer, na ordem de retorno:** Playwright cobrindo os caminhos que não podem quebrar
— login, concluir aula, emitir certificado, responder questão, candidatar-se — e testes de
unidade em `calcularMatch` e nos limites de plano, que são regra de negócio pura e fácil de
testar. Não perseguir cobertura; cobrir o que dói.

---

### 🟢 6.5 — Acessibilidade não auditada

Contraste, navegação por teclado, leitor de tela e foco visível nunca foram verificados.
O contraste do dourado `#C89F50` sobre branco é o suspeito principal.

Rodar Lighthouse e axe DevTools nas telas principais.

---

### 🟢 6.6 — SEO e compartilhamento

A landing tem título e descrição. Faltam: imagem OG (link no WhatsApp vai aparecer sem
prévia), `sitemap.xml`, `robots.txt` e dados estruturados nas vagas — que é o que faz vaga
aparecer no Google for Jobs, e isso traz tráfego de graça.

---

## Ordem sugerida

**Antes de qualquer coisa:** 6.2 (Git). É o único item que, se ficar para depois, faz
perder trabalho já feito.

**Semana 1 — destravar o ambiente:** 6.1 deploy (passo a passo em
[DEPLOY.md](./DEPLOY.md)), 1.7 rotação de chave, 6.3 monitoramento, e 9.3 — o
botão que vincula o gestor de uma empresa, sem o qual toda venda nova depende
de um SQL escrito à mão.

**Semana 2 — o produto de verdade:** conectar os três fluxos de n8n de uma vez —
2.6 o Tino, 2.7 a geração de questões e 2.10 as dúvidas na aula. É o mesmo
trabalho de configuração e triplica o valor percebido. O vídeo já funciona pelo
YouTube (2.1); o streaming pago pode esperar o primeiro contrato.

**Semana 3 — segurança do go-live:** 1.1 contas demo, 1.2 confirmação de e-mail, 1.3
limites no servidor, 1.5 senha vazada.

**Semana 4 — jurídico:** 5.1 termos, 5.2 exclusão, 5.3 consentimento. Começar cedo, porque
depende de terceiro.

**Definir esta semana, custa uma conversa:** 2.13 quem é o dono das tabelas
fiscais das ferramentas.

**Em paralelo, do começo ao fim:** 4.3 conteúdo dos cursos. É o que leva mais tempo e não
depende de nenhum dos outros — se esperar os itens técnicos, atrasa o lançamento sozinho.

**Só quando houver cobrança:** 2.2 pagamento, 1.3 limites no servidor e a
correção server-side do banco de questões de estudo (1.4).

**Quando o primeiro contrato fechar:** 2.1 streaming pago — é a única forma de
vender conteúdo com exclusividade.
