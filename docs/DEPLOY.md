# Deploy — do zero ao ar, sem quebrar nada

Guia de subida do MVP para **Git + Vercel + Supabase**. Foi escrito para ser
seguido de cima para baixo, uma vez, sem improviso no meio.

> **Regra que vale para o guia inteiro:** nada de chave real em arquivo
> versionado. As chaves vivem no `.env.local` (que o `.gitignore` já protege) e
> no painel da Vercel. O `.env.local.example` é modelo, e modelo vai vazio.

Última revisão: 30/08/2026 — inclui a área da empresa (migração 18).

---

## Índice

1. [O que existe hoje](#1-o-que-existe-hoje)
2. [Antes de começar](#2-antes-de-começar)
3. [Passo 1 — Git](#3-passo-1--git)
4. [Passo 2 — Supabase](#4-passo-2--supabase)
5. [Passo 3 — Variáveis de ambiente](#5-passo-3--variáveis-de-ambiente)
6. [Passo 4 — Vercel](#6-passo-4--vercel)
7. [Passo 5 — Depois do primeiro deploy](#7-passo-5--depois-do-primeiro-deploy)
8. [Teste de fumaça](#8-teste-de-fumaça)
9. [O que ainda não funciona em produção](#9-o-que-ainda-não-funciona-em-produção)
10. [Como voltar atrás](#10-como-voltar-atrás)

---

## 1. O que existe hoje

| Item | Situação |
|---|---|
| Next.js | 15.5.4 (App Router), React 19, TypeScript, Tailwind v4 |
| Rotas | 58, sendo 8 rotas de API (`/api/*`) |
| Banco | Supabase Postgres 17, projeto `castelo-branco-academy` (região `sa-east-1`) |
| Migrações SQL | `supabase/01_…` até `supabase/18_area_da_empresa.sql` |
| Buckets | `avatares`, `capas` (públicos); `materiais`, `videos`, `certificados` (privados) |
| IA | n8n (`/webhook/tino-ia`) com fallback para a API da Anthropic e, por fim, reserva local por regras |

**Build limpo é pré-requisito.** Antes de qualquer coisa:

```bash
npm run build
```

Se falhar com `Cannot find module for page: /cadastro`, o `.next` está sujo
porque o `next dev` rodou em paralelo. Apague e refaça:

```bash
rm -rf .next && npm run build
```

---

## 2. Antes de começar

Tenha em mãos:

- Conta no GitHub e no Vercel (pode ser o login pelo GitHub).
- Acesso ao painel do Supabase do projeto **castelo-branco-academy**.
- As chaves do n8n / Anthropic que já estão no seu `.env.local` local.
- Um domínio, se for usar um (opcional no primeiro deploy — a Vercel dá um
  `*.vercel.app` que serve para tudo, inclusive para o OAuth do Google).

---

## 3. Passo 1 — Git — **feito**

> **Estado em 30/08/2026:** o repositório existe e está sincronizado em
> **https://github.com/Joaaomottaa/castelo-branco-academy** (branch `main`,
> privado). O `push` desta máquina funciona pelo Git Credential Manager. Os
> comandos abaixo ficam como referência para recriar o repositório do zero.

O restante desta seção descreve a criação inicial.

### 3.1 Inicializar

```bash
git init -b main
```

### 3.2 Conferir o que vai subir

O `.gitignore` já cobre `node_modules`, `.next`, `*.tsbuildinfo` e **todos** os
`.env*` exceto o `.env.local.example`. Confirme antes de commitar:

```bash
git add -A && git status --short | head -40
```

Se aparecer `.env.local` nessa lista, **pare** e corrija o `.gitignore` antes
de seguir. Nenhuma chave pode entrar no histórico — remover depois exige
reescrever commits.

### 3.3 Primeiro commit

```bash
git commit -m "MVP da Castelo Branco Academy"
```

### 3.4 Criar o repositório no GitHub

Pelo site: **github.com/new** → nome `castelo-branco-academy` → **Private** →
sem README, sem .gitignore, sem licença (o projeto já tem os arquivos).

Depois, com a URL que o GitHub mostrar:

```bash
git remote add origin https://github.com/SEU_USUARIO/castelo-branco-academy.git
```

```bash
git push -u origin main
```

> Se o GitHub pedir senha, use um **Personal Access Token** (Settings →
> Developer settings → Tokens) no lugar da senha da conta.

---

## 4. Passo 2 — Supabase

Você tem duas situações possíveis. Leia as duas e escolha.

### Situação A — usar o projeto atual como produção

É o caminho mais rápido, e o banco já está com o schema completo e testado.
**Mas ele tem as contas de demonstração com senha `123456`**, incluindo uma
com papel `admin`. Antes de apontar o domínio:

```sql
delete from auth.users
where email in (
  'aluno@castelobranco.com.br',
  'empresa@castelobranco.com.br',
  'admin@castelobranco.com.br'
) or email like '%@exemplo.com';
```

Depois crie o admin real em **Authentication › Users › Add user** e promova:

```sql
update public.perfis set role = 'admin' where id = '<uuid-do-novo-usuario>';
```

> Atenção: apagar as contas de demonstração remove junto os dados de vitrine
> (equipe da TransLog, candidaturas, certificados de exemplo). É o certo para
> produção, mas você perde a demo. Se quiser manter a demo para o comercial,
> vá para a Situação B.

### Situação B — criar um projeto novo para produção

Recomendado se você quer manter o projeto atual como **ambiente de vitrine**.

1. **Criar o projeto**: Supabase → New project → região `South America (São
   Paulo)` → guardar a senha do banco.

2. **Rodar as migrações em ordem**, uma de cada vez, no **SQL Editor**:

   | Ordem | Arquivo | O que faz |
   |---|---|---|
   | 1 | `01_schema.sql` | Tabelas, enums, RLS base |
   | 2 | `02_seed.sql` | Cursos, trilhas e catálogo |
   | 3 | `03_usuarios_demo.sql` | **Pule em produção** — cria as contas com senha `123456` |
   | 4 | `04_storage.sql` | Buckets e policies de arquivo |
   | 5 | `05_corrigir_auth.sql` | Gatilho de criação de perfil |
   | 6 | `06_modulos_avancados.sql` | Trilhas, gamificação, comunidade |
   | 7 | `07_seed_avancado.sql` | Seed dos módulos avançados |
   | 8 | `08_video_e_quiz.sql` | Vídeo da aula e avaliação |
   | 9 | `09_duvidas_ferramentas_metricas.sql` | Dúvidas, ferramentas, métricas |
   | 10 | `10_cupons_comunicacao_vagas.sql` | Cupons, campanhas, vagas |
   | 11 | `11_selos_avaliacao_questoes.sql` | Selos de habilidade |
   | 12 | `12_simulados_salvos.sql` | Simulados |
   | 13 | `13_questao_como_lugar.sql` | Banco de questões |
   | 14 | `14_historico_da_questao.sql` | Histórico de respostas |
   | 15 | `15_perfil_do_login_social.sql` | Perfil vindo do Google |
   | 16 | `16_cadastro_certificado_revisao.sql` | Cadastro completo, validação, revisão espaçada |
   | 17 | `17_endereco_materiais_duvida_da_questao.sql` | Endereço por CEP, materiais, dúvida na questão |
   | 18 | `18_area_da_empresa.sql` | **Área da empresa** — licenças, convites, formações, PEPC |

   Todos são idempotentes: rodar duas vezes não quebra. Se um deles falhar,
   **pare e leia o erro** — seguir adiante com um schema pela metade é o que
   gera bug difícil depois.

3. **Conferir**: `select count(*) from public.cursos;` deve devolver o número
   de cursos do seed.

### 4.1 Autenticação (vale para as duas situações)

Em **Authentication › Sign In / Providers**:

| Configuração | Valor em produção | Por quê |
|---|---|---|
| **Email › Confirm email** | **Ligado** | Em desenvolvimento está desligado. Ligado, o cadastro exige confirmação — a tela já trata esse caso e mostra "Confirme seu e-mail". |
| **Google** | Ligado, com Client ID e Secret do Google Cloud | Ver 4.2. |
| **Leaked Password Protection** | **Ligado** (Authentication › Policies) | O advisor do Supabase aponta isso como pendência. É um clique. |

Em **Authentication › URL Configuration**:

- **Site URL**: `https://SEU-DOMINIO` (ou a URL `.vercel.app`).
- **Redirect URLs**: acrescente
  - `https://SEU-DOMINIO/auth/callback`
  - `https://SEU-DOMINIO/**` (cobre os previews de branch se você usar)
  - `http://localhost:3000/auth/callback` (para continuar desenvolvendo)

> **Sem isso o login pelo Google volta para `localhost` em produção.** É o erro
> mais comum deste deploy.

### 4.2 Google OAuth

No **Google Cloud Console** → APIs & Services → Credentials → o OAuth Client
do projeto:

- **Authorized JavaScript origins**: `https://SEU-DOMINIO`
- **Authorized redirect URIs**:
  `https://SEU-PROJETO.supabase.co/auth/v1/callback`
  (é a URL do **Supabase**, não a do site — o Supabase é quem recebe o retorno
  do Google e depois manda para o `/auth/callback` da aplicação)

Se a tela de consentimento estiver em **Testing**, só os e-mails listados
conseguem entrar. Publique-a antes de abrir para clientes.

### 4.3 Buckets

O `04_storage.sql` já cria os cinco. Confirme em **Storage**:

| Bucket | Público | Limite | Conteúdo |
|---|---|---|---|
| `avatares` | sim | 2 MB | foto de perfil |
| `capas` | sim | 5 MB | capa de curso |
| `materiais` | **não** | 50 MB | PDF, planilha, slides da aula |
| `videos` | **não** | 50 MB | vídeo hospedado |
| `certificados` | **não** | 5 MB | PDF do certificado |

Os privados só saem por **URL assinada**, gerada no clique. Não torne nenhum
deles público "para facilitar" — a URL assinada é o que impede o link de
circular fora da plataforma.

### 4.4 Depois de tudo, rode os advisors

Supabase → **Advisors › Security**. O esperado hoje:

- **0 erros.**
- Avisos de `SECURITY DEFINER function executable by authenticated`: são as
  RPCs da aplicação, e é assim de propósito — cada uma checa a permissão
  dentro do corpo.
- `convite_publico`, `validar_certificado`, `is_admin`, `is_membro_empresa`,
  `is_gestor_empresa` executáveis por `anon`: também de propósito. As duas
  primeiras são telas públicas; as três `is_*` são chamadas pelo próprio RLS
  ao avaliar policies de leitura pública (tirar o EXECUTE quebra o mural de
  vagas para visitante).
- `Leaked Password Protection Disabled`: resolva pelo painel (4.1).

---

## 5. Passo 3 — Variáveis de ambiente

Todas entram na Vercel em **Settings › Environment Variables**, marcadas para
**Production**, **Preview** e **Development**.

### Obrigatórias

| Nome | Onde encontrar | Público? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API › Project URL | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase › API Keys › publishable / anon | sim |

Sem essas duas a aplicação sobe, mas cai no **modo demonstração** (seed local).
Ela não quebra — só não é o produto.

### Recomendadas

| Nome | Para quê | Se faltar |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Rotas de servidor que ignoram RLS | Alguns fluxos administrativos ficam sem efeito |
| `N8N_WEBHOOK_URL` | Tino, o assistente | Cai num atendimento de reserva por regras, sem IA |
| `N8N_DUVIDAS_WEBHOOK_URL` | Dúvida com IA dentro da aula | Resposta honesta dizendo que a IA não está ligada |
| `N8N_QUESTOES_WEBHOOK_URL` | "Gerar 5 perguntas" da aula | Modelo local sem IA, para o admin reescrever |
| `N8N_QUESTOES_BANCO_WEBHOOK_URL` | `/admin/questoes/gerar` | Tenta a variável acima antes de desistir |
| `N8N_FEEDBACK_WEBHOOK_URL` | Análise do simulado | Análise local por regras |
| `N8N_DUVIDA_QUESTAO_WEBHOOK_URL` | Dúvida com IA na questão | Explicação montada a partir do gabarito |
| `ANTHROPIC_API_KEY` | Alternativa ao n8n | Só é usada quando o n8n não responde |
| `ANTHROPIC_MODEL` | Padrão `claude-sonnet-5` | — |

> **`SUPABASE_SERVICE_ROLE_KEY` nunca leva o prefixo `NEXT_PUBLIC_`.** Com o
> prefixo, o Next.js embute a chave no JavaScript do navegador e qualquer
> visitante passa a ignorar todo o RLS do banco.

### Opcional

| Nome | Efeito |
|---|---|
| `NEXT_PUBLIC_MODO_DEMO=true` | Trava o modo demonstração para todo mundo e some com a chave "Supabase / Demo". Use num ambiente exclusivo de apresentação — **nunca** na produção real. |

---

## 6. Passo 4 — Vercel

> **Estado em 30/08/2026 — atenção, há um projeto pela metade.**
>
> Existe um projeto chamado `castelo-branco-academy` na conta Vercel, criado
> pela integração, mas **sem link de Git válido e sem nenhum deployment**
> (`castelo-branco-academy.vercel.app` responde 404).
>
> A causa é o repositório ser **privado**: o GitHub App da Vercel precisa estar
> instalado na conta `Joaaomottaa` **e com acesso concedido a este repositório
> específico**. Sem isso a Vercel não enxerga o repo e o link falha em silêncio.
>
> **Como resolver, no painel da Vercel:**
>
> 1. Abra o projeto `castelo-branco-academy` → **Settings › Git**.
> 2. **Connect Git Repository** → GitHub → se pedir, **Install/Configure** o
>    GitHub App e marque `castelo-branco-academy` em *Only select repositories*.
> 3. Se o projeto estiver em estado inconsistente, apague-o
>    (Settings › Advanced › Delete Project) e refaça por **Add New › Project ›
>    Import**, que é o caminho que instala o App na hora.
>
> Não crie um segundo projeto com o mesmo nome antes de apagar o primeiro.

1. **vercel.com/new** → Import Git Repository → escolha o repositório.
2. A Vercel detecta Next.js sozinha. Não mude nada:
   - Framework Preset: **Next.js**
   - Build Command: `next build` (padrão)
   - Output Directory: padrão
   - Install Command: `npm install`
3. **Antes de clicar em Deploy**, cole as variáveis do Passo 3.

   O jeito rápido e sem digitar segredo à mão: em **Settings › Environment
   Variables** a Vercel aceita colar um bloco `.env` inteiro de uma vez —
   abra o seu `.env.local`, copie o conteúdo e cole ali. Marque
   **Production**, **Preview** e **Development**.

   Confira só uma coisa depois de colar: que `SUPABASE_SERVICE_ROLE_KEY`
   **não** ganhou o prefixo `NEXT_PUBLIC_`.
4. Deploy.

O build leva ~2 minutos. Se falhar, o log da Vercel aponta o arquivo; o erro
mais comum é variável de ambiente faltando em `Production`.

### Node

O `package.json` não fixa versão de Node. A Vercel usa a LTS atual, que atende
o Next 15. Se quiser travar, acrescente ao `package.json`:

```json
"engines": { "node": "22.x" }
```

---

## 7. Passo 5 — Depois do primeiro deploy

Com a URL de produção em mãos, volte e ajuste **nesta ordem**:

1. **Supabase › Authentication › URL Configuration**
   Site URL e Redirect URLs com o domínio real (item 4.1). Para o projeto
   atual, os valores são:

   - **Site URL:** `https://castelo-branco-academy.vercel.app`
   - **Redirect URLs:**
     - `https://castelo-branco-academy.vercel.app/auth/callback`
     - `https://castelo-branco-academy.vercel.app/**`
     - `https://castelo-branco-academy-*.vercel.app/**` (os previews de cada
       commit têm hash no nome; sem o curinga, o login pelo Google só funciona
       na URL de produção)
     - `http://localhost:3000/auth/callback`

2. **Google Cloud › Credentials**
   Origins e redirect URI (item 4.2).

3. **Contratar as licenças das empresas piloto**
   `/admin/vagas` → aba **Empresas** → editar → campo **Licenças
   contratadas**. Sem assento contratado, o gestor não consegue emitir convite
   de licença (só de desconto). O número **só** muda por aqui: o banco recusa
   a alteração vinda de qualquer outra sessão, por gatilho.

4. **Criar o gestor de cada empresa**
   Ainda não há tela para isso. Enquanto não houver, é uma linha de SQL:

   ```sql
   insert into public.empresa_membros (empresa_id, perfil_id, papel, status, entrou_em)
   values ('<uuid-da-empresa>', '<uuid-do-perfil>', 'gestor', 'ativo', now())
   on conflict (empresa_id, perfil_id) do update set papel = 'gestor', status = 'ativo';
   ```

   Desse ponto em diante o gestor se vira sozinho: convida o time em
   `/empresa/equipe`, e cada convite gera um link `/convite/CB-XXXX-XXXX`.

---

## 8. Teste de fumaça

Rode esta lista na produção, na ordem. Leva dez minutos e pega 90% do que
costuma quebrar num deploy.

### Visitante (sem login)

- [ ] A home abre e lista cursos **vindos do banco** (não o seed local).
- [ ] `/validar` aceita um código real e mostra o certificado.
- [ ] `/validar/CODIGO-INEXISTENTE` mostra o painel âmbar, não um erro.
- [ ] `/convite/CB-XXXX-XXXX` de um convite válido mostra o nome da empresa.
- [ ] O Tino abre no canto e responde sem sessão.

### Aluno

- [ ] Cadastro por e-mail → tela "Confirme seu e-mail" (com confirmação ligada).
- [ ] Login pelo Google → cai em `/completar-cadastro`, **não** em `localhost`.
- [ ] `/completar-cadastro`: CEP preenche rua, bairro, cidade e UF.
- [ ] `/app` mostra painel, ofensiva e — se houver empresa — o cartão
      "Formações da sua empresa".
- [ ] `/app/questoes` → responder uma questão → abas Gabarito, Estatísticas,
      **Ferramentas** e **Tirar dúvida com IA**.
- [ ] Aba **Ferramentas**: a calculadora soma, a fita registra, as tabelas de
      INSS e IRRF abrem.
- [ ] Concluir um curso emite certificado e o código valida em `/validar`.

### Empresa

- [ ] Login do gestor → aparece "Painel da <empresa>" na barra lateral.
- [ ] `/empresa` mostra assentos, alertas e os números do ano.
- [ ] `/empresa/equipe` → **Convidar** → gera código e o link copia.
- [ ] Abrir o link do convite noutro navegador → aceitar → a pessoa entra no
      time e vira **Pro**.
- [ ] Remover a pessoa → o plano dela volta ao que era.
- [ ] `/empresa/formacoes` → atribuir uma trilha com prazo → a pessoa recebe
      notificação e vê o cartão em `/app`.
- [ ] `/empresa/relatorios` → **Exportar CSV** abre no Excel com as colunas
      separadas.
- [ ] `/empresa/vagas` → publicar uma vaga → ela aparece em `/app/vagas`.
- [ ] Um **membro** (não gestor) que tente abrir `/empresa` é mandado para
      `/app`.

### Admin

- [ ] `/admin` abre só para `role = 'admin'`.
- [ ] `/admin/cursos` → anexar um material → o aluno baixa na aba Materiais.
- [ ] `/admin/vagas` → aba Empresas → alterar licenças contratadas salva.

---

## 9. O que ainda não funciona em produção

Lista curta do que **vai** aparecer como limitação. A lista completa, com
prioridade e o que fazer, está em [`PENDENCIAS.md`](./PENDENCIAS.md).

| Item | Impacto |
|---|---|
| **Termos de uso e política de privacidade não existem** | O cadastro pede aceite de documentos que não estão escritos. É o único item que realmente bloqueia o go-live com cliente pagante. |
| **Pagamento é simulado** | `/app/planos/assinar` gera PIX e boleto de mentira e grava a assinatura. Nenhum centavo é cobrado. |
| **E-mail não é enviado** | Convite de empresa, campanha e notificação ficam na plataforma. O gestor manda o link do convite por WhatsApp. |
| **Certificado não baixa em PDF** | O diploma renderiza na tela e imprime; não há geração de arquivo. O QR code também é decorativo. |
| **Upload de vídeo passa pela Vercel** | O limite de corpo da função serverless é ~4,5 MB. Vídeo maior precisa ir direto ao bucket ou ao YouTube. |
| **Sem envio de logotipo da empresa** | O selo usa cor + iniciais. |

Nenhum desses quebra a aplicação — todos degradam com aviso na tela.

---

## 10. Como voltar atrás

**Aplicação:** Vercel → Deployments → o deploy anterior → **Promote to
Production**. Leva segundos e não toca no banco.

**Banco:** não há "desfazer" de migração. Antes de rodar qualquer coisa nova
em produção:

1. Supabase → Database → **Backups** → confirme que o backup diário está
   ligado (planos pagos) ou faça um dump manual:

   ```bash
   npx supabase db dump --db-url "postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres" -f backup.sql
   ```

2. Teste a migração num **branch** do Supabase (Database → Branches) antes de
   aplicar na `main`.

**Regra de ouro:** aplicação e banco sobem em momentos diferentes. Suba a
migração **antes** do deploy da aplicação quando ela adiciona coisas (é o caso
da 18); suba o deploy **antes** da migração quando ela remove coisas.
