# Configurar o Supabase — passo a passo

Guia do zero até a plataforma rodando com banco real. Tempo estimado: **15 a 20 minutos**.

Ao final você terá: banco com 20 tabelas, RLS ativo, 6 cursos com 49 aulas, 5 vagas,
9 usuários de teste, buckets de arquivo e o app lendo tudo isso.

São **cinco** scripts, rodados em ordem: `01_schema` → `02_seed` → `03_usuarios_demo`
→ `04_storage` → `05_corrigir_auth`.

---

## Antes de começar

O projeto funciona **sem Supabase** (modo demo, dados locais). Você pode rodar
`npm run dev` agora e navegar. Este guia liga o banco real.

Confira o status a qualquer momento em **<http://localhost:3000/diagnostico>**.

---

## Passo 1 — Criar a conta e o projeto

1. Acesse <https://supabase.com> e clique em **Start your project**. Entre com GitHub
   ou e-mail. O plano gratuito atende o desenvolvimento inteiro.
2. Dentro do painel, clique em **New project**.
3. Preencha:

   | Campo | Valor recomendado |
   |---|---|
   | **Organization** | Castelo Branco (crie se não existir) |
   | **Project name** | `castelo-branco-academy` |
   | **Database Password** | Gere uma forte e **guarde no gerenciador de senhas** |
   | **Region** | `South America (São Paulo)` — menor latência para o Brasil |
   | **Pricing plan** | Free |

4. Clique em **Create new project** e espere ~2 minutos até o status ficar verde.

> ⚠️ A senha do banco não é a senha de login dos usuários. Ela é usada para
> conexão direta ao Postgres. Você raramente vai precisar dela, mas se perder,
> perde o acesso direto ao banco.

---

## Passo 2 — Rodar os scripts SQL

No menu lateral, abra **SQL Editor** › **New query**.

Rode **um arquivo por vez, nesta ordem**. Cole o conteúdo inteiro, clique em **Run**
(ou `Ctrl+Enter`) e confira o resultado antes de passar para o próximo.

### 2.1 — `supabase/01_schema.sql`

Cria tipos, 20 tabelas, índices, funções, triggers e todas as políticas de RLS.

Resultado esperado: **Success. No rows returned**.

### 2.2 — `supabase/02_seed.sql`

Popula o catálogo. Ao final o próprio script mostra uma tabela de conferência:

```
cursos | modulos | aulas | empresas | vagas | habilidades | conquistas
   6   |    15   |   49  |     9    |   5   |      23     |     8
```

### 2.3 — `supabase/03_usuarios_demo.sql`

Cria 9 contas (senha `123456`) e o progresso de demonstração da aluna.
Conferência esperada:

```
usuarios | perfis | perfis_publicos | habilidades_vinculadas | progresso | certificados
    9    |   9    |        7        |           28           |     22    |      2
```

Os 2 certificados aparecem porque o **trigger de conclusão** rodou sozinho ao ver
dois cursos com 100% das aulas concluídas. Se esse número vier 2, o coração da
plataforma está funcionando.

> **Se este script falhar** (ele escreve direto em `auth.users`, o que pode variar
> entre versões do Supabase): vá em **Authentication › Users › Add user**, marque
> **Auto Confirm User** e crie manualmente `admin@`, `empresa@` e
> `aluno@castelobranco.com.br` com senha `123456`. Depois rode de novo só a parte do
> arquivo a partir do comentário `ATUALIZA OS PERFIS`.

### 2.4 — `supabase/04_storage.sql`

Cria os buckets `avatares`, `capas`, `materiais`, `certificados` e `videos` com as
regras de acesso. Confira em **Storage** no menu lateral.

> A página de diagnóstico não consegue listar os buckets pelo cliente: a tabela
> `storage.buckets` pertence ao papel `supabase_storage_admin` e não aceita policy
> criada pelo SQL Editor (`ERROR: 42501: must be owner of table buckets`). Isso é
> normal. O diagnóstico contorna sondando o bucket `avatares`.

### 2.5 — `supabase/05_corrigir_auth.sql`

**Obrigatório.** O script anterior insere usuários direto em `auth.users`, e as
colunas de token ficam `NULL`. O serviço de autenticação do Supabase é escrito em Go
e lê esses campos como string simples — `NULL` quebra a leitura e **todo login passa a
falhar** com a mensagem enganosa `Database error querying schema`.

Este script troca os `NULL` por string vazia. Conferência esperada:

```
token_confirmacao_nulo | token_recuperacao_nulo | email_change_nulo | email_nao_confirmado | total_usuarios
          0            |           0            |         0         |          0           |       9
```

---

## Passo 3 — Desligar a confirmação de e-mail (desenvolvimento)

Sem isso, cada cadastro novo fica travado esperando um e-mail que não chega em ambiente local.

1. **Authentication** › **Sign In / Providers** › **Email**.
2. Desmarque **Confirm email**.
3. **Save**.

> Em produção, **religue essa opção** e configure um servidor SMTP próprio
> (Resend, SendGrid ou Amazon SES). O SMTP embutido do Supabase tem limite baixo e
> não deve ser usado com usuários reais.

---

## Passo 4 — Copiar as chaves

**Project Settings** (engrenagem) › **API**.

| O que copiar | Onde aparece |
|---|---|
| **Project URL** | `https://xxxxxxxx.supabase.co` |
| **anon / public key** | chave longa começando com `eyJ...` |

> A chave `service_role` **nunca** vai para o frontend. Ela ignora todo o RLS.
> Só use em rotas de servidor, e apenas quando realmente precisar.

---

## Passo 5 — Criar o `.env.local`

Na raiz do projeto (ao lado do `package.json`), crie o arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Sem aspas, sem espaço em volta do `=`, sem ponto e vírgula no fim.

Há um modelo pronto em `.env.local.example`.

---

## Passo 6 — Reiniciar e conferir

Pare o servidor (`Ctrl+C`) e suba de novo:

```bash
npm run dev
```

> Variáveis `NEXT_PUBLIC_*` são lidas **só na inicialização**. Editar o `.env.local`
> com o servidor rodando não tem efeito.

Abra <http://localhost:3000/diagnostico>. O esperado:

- **Origem dos dados:** Supabase
- **Variáveis de ambiente:** ✅
- **Conexão com o banco:** ✅
- **Todas as tabelas:** ✅ com as contagens do Passo 2
- **Autenticação:** ⚠️ até você entrar
- **Storage:** ✅ 5 buckets

Agora entre em <http://localhost:3000/login> com `aluno@castelobranco.com.br` / `123456`
e volte ao diagnóstico: **Autenticação**, **RLS — perfil próprio** e **Trigger de
certificado** devem ficar verdes.

---

## O modo demonstração continua disponível

Conectar o Supabase **não desliga** a demonstração. A partir daqui existe uma chave
na interface, no canto superior:

```
[ Supabase | Demo ]
```

Ela aparece no topo da área logada, na tela de login e no diagnóstico.

| Posição | O que acontece |
|---|---|
| **Supabase** | Tudo lê e grava no banco real. É o padrão. |
| **Demo** | A aplicação usa o seed local. Nenhuma consulta chega ao banco, nenhum dado é gravado. |

A escolha fica no navegador (localStorage), então **cada pessoa da equipe escolhe a
sua** — você pode estar em Demo na apresentação enquanto outro dev trabalha contra o
banco, no mesmo servidor.

Trocar de modo recarrega a página e leva você para o login, porque a sessão precisa ser
reconstruída na outra fonte. Em qualquer um dos dois modos as contas são as mesmas
(`aluno@`, `empresa@`, `admin@castelobranco.com.br` / `123456`), porque o
`03_usuarios_demo.sql` recria no banco exatamente as contas que existem no seed local.

### Travar o modo demonstração

Para um ambiente que só serve para apresentar (um deploy de vitrine, por exemplo), use
no `.env.local`:

```
NEXT_PUBLIC_MODO_DEMO=true
```

Isso força o seed local para todo mundo e esconde a chave — ninguém consegue acidentalmente
apontar a apresentação para o banco de produção.

### Quando usar cada um

- **Demo** — apresentação para o CEO, reunião comercial, internet instável, testar
  fluxos destrutivos sem sujar o banco.
- **Supabase** — desenvolvimento normal, validar RLS e triggers, testar cadastro real.

---

## O que passa a ser real

| Funciona de verdade no banco | Ainda simulado |
|---|---|
| Login, cadastro, logout, sessão persistente | Envio de e-mail de recuperação (precisa de SMTP) |
| Recuperação de senha (dispara e-mail do Supabase) | Reprodução de vídeo (falta o provedor de streaming) |
| Catálogo, módulos e aulas vindos do banco | Upload de vídeo (interface pronta, sem provedor) |
| Progresso de aula gravado em `progresso_aulas` | Geração do PDF do certificado |
| **Emissão automática de certificado por trigger** | Pagamento e assinatura |
| Perfil, habilidades e visibilidade no banco de talentos | Assistente de IA |
| Favoritos e candidaturas | |
| Banco de talentos lendo perfis públicos reais | |
| Match vaga ↔ candidato calculado pelas regras da seção 4.5 do dossiê | |

---

## Testar o fluxo completo

1. Entre como `aluno@castelobranco.com.br`.
2. Vá em **Cursos** › **Comércio Exterior e Rotina Aduaneira**.
3. Marque **todas** as aulas como concluídas (são 6).
4. Abra **Certificados**: o terceiro certificado apareceu sozinho.
5. Confirme no Supabase: **Table Editor** › `certificados` › a linha nova está lá,
   com código único.

Isso valida a cadeia inteira: RLS de escrita → trigger no banco → RLS de leitura → interface.

---

## Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `infinite recursion detected in policy for relation "perfis"` | Uma policy consulta `perfis` sem `security definer` | O `01_schema.sql` já resolve isso com `public.is_admin()`. Rode-o de novo por inteiro. |
| Diagnóstico diz "Modo demo" mesmo com `.env.local` | Servidor não reiniciou, ou o arquivo está fora da raiz | Confira o caminho e reinicie o `npm run dev` |
| Catálogo vazio depois de conectar | `02_seed.sql` não rodou, ou os cursos estão com `publicado = false` | Rode o seed; confira em **Table Editor** › `cursos` |
| Login retorna "E-mail ou senha inválidos" | O `03_usuarios_demo.sql` falhou | Crie os usuários pelo painel (ver nota no Passo 2.3) |
| `Database error querying schema` no login | Colunas de token `NULL` em `auth.users` | Rode o `05_corrigir_auth.sql` |
| `Database error finding users` no painel Authentication | Mesma causa acima | Rode o `05_corrigir_auth.sql` |
| `ERROR: 42501: must be owner of table buckets` | Tentativa de criar policy em `storage.buckets` | Esperado — o script atual não faz mais isso. Puxe a versão corrigida do `04` |
| Diagnóstico mostra "0 buckets" | `storage.buckets` não é listável pelo cliente | Normal. Confira em **Storage** no painel |
| "Confirme seu e-mail antes de entrar" | **Confirm email** ainda ligado | Passo 3 |
| Usuário existe no auth mas o perfil não aparece | O trigger `on_auth_user_created` não rodou | Rode o `01_schema.sql` de novo e recrie o usuário |
| Banco de talentos vazio | Os perfis estão com `perfil_publico = false` | O `03_usuarios_demo.sql` marca 7 como públicos. Ou ative em **Meu perfil** › "Quero aparecer para empresas" |
| Progresso não salva | RLS bloqueando escrita | Veja o erro no console do navegador; confirme que está logado |
| Mudanças não aparecem no banco | A chave está em **Demo** | Clique em **Supabase** no seletor do topo |

---

## Segurança — checklist antes de qualquer deploy

- [ ] `.env.local` está no `.gitignore` (já está)
- [ ] A chave `service_role` nunca apareceu em código do cliente
- [ ] **Confirm email** religado
- [ ] SMTP próprio configurado
- [ ] RLS ativo em todas as tabelas — confira em **Authentication › Policies**
- [ ] Senha do banco guardada no gerenciador de senhas
- [ ] Backup diário ativo (Free tem 7 dias; considere o Pro em produção)
- [ ] Contas de demonstração **removidas** antes de ir ao ar

---

## Próximo passo

Com o banco de pé, o passo seguinte é **vídeo**: contratar Cloudflare Stream ou Bunny
Stream e substituir o player de demonstração pelo HLS real. É a decisão técnica mais
cara de errar no projeto (seção 3.1 do dossiê).

---

## Cadastro de conta — as duas fontes

O formulário de cadastro se comporta de forma diferente conforme a chave
`[ Supabase | Demo ]`, e a tela avisa qual está ativa:

| Modo | O que acontece |
|---|---|
| **Supabase** | `auth.users` criado, trigger `on_auth_user_created` cria a linha em `perfis`, login posterior funciona normalmente |
| **Demo** | Conta gravada só no `localStorage` deste navegador. Login posterior funciona, mas **nada vai para o banco** |

Se você criar uma conta e ela não aparecer no banco, a causa é quase sempre a
mesma: a chave estava em **Demo**. Um aviso amarelo aparece no topo do formulário
justamente para isso.

### Confirmação de e-mail

Se **Confirm email** estiver ligado, o cadastro não devolve sessão. A tela mostra
"Confirme seu e-mail" em vez de tentar entrar — antes ela navegava para `/app` e
a pessoa era devolvida ao login sem explicação.

---

## Segurança — o que já foi corrigido no banco

Rodando o verificador do Supabase (**Advisors › Security**) encontramos e corrigimos:

| Achado | Gravidade | Correção |
|---|---|---|
| `criar_usuario_demo` exposta em `/rest/v1/rpc/` | **Crítica** — permitia criar conta com role `admin` usando só a chave anônima | Função removida (`03_usuarios_demo.sql` agora faz `drop` no fim) |
| Funções de trigger executáveis por `anon`/`authenticated` | Média | `revoke execute ... from public` no `01_schema.sql` |
| `set_atualizado_em` com `search_path` mutável | Baixa | `set search_path = public` |

> **Por que revogar de `public` e não de `anon`?** No Postgres toda função nasce
> com `EXECUTE` concedido a `PUBLIC`, e `anon`/`authenticated` herdam disso.
> Revogar só desses papéis não tem efeito.

> `is_admin()` e `is_membro_empresa()` **continuam executáveis de propósito**: as
> policies de RLS são avaliadas com o papel de quem consulta, então revogar
> quebraria todo o acesso. São seguras — devolvem apenas um booleano sobre o
> próprio chamador.

Ainda pendente, e é um clique no painel: **Authentication › Policies › Leaked
password protection**. Liga a checagem contra o HaveIBeenPwned.

---

## Entrar com Google

O botão **Google** na tela de login já está ligado no código: ele checa se o
provedor está habilitado, redireciona para o Google, volta em `/auth/callback`
e cria o perfil automaticamente (o gatilho `handle_new_user` lê `full_name` e
`avatar_url` que o Google manda).

Falta apenas a parte que só existe fora do código — as credenciais do Google.
São cinco minutos:

### 1. No Google Cloud Console

1. <https://console.cloud.google.com> › crie ou escolha um projeto.
2. **APIs e serviços › Tela de permissão OAuth**: tipo **Externo**, nome do app
   "Castelo Branco Academy", e-mail de suporte e o domínio do site.
3. **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**
   › tipo **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, cole exatamente:

   ```
   https://adwsvfhjqrldlliabmfd.supabase.co/auth/v1/callback
   ```

   É o endereço do **Supabase**, não o do site — quem recebe o retorno do
   Google é ele. Errar isso dá `redirect_uri_mismatch`.
5. Guarde o **Client ID** e o **Client Secret**.

### 2. No Supabase

**Authentication › Sign In / Providers › Google**: ligue, cole Client ID e
Client Secret, salve.

### 3. Ainda no Supabase, as URLs de retorno

**Authentication › URL Configuration**:

- **Site URL**: o endereço de produção (ex.: `https://academy.castelobranco...`)
- **Redirect URLs**: acrescente uma linha por ambiente —

  ```
  http://localhost:3000/auth/callback
  https://SEU-DOMINIO/auth/callback
  ```

Sem isso o Supabase recusa o retorno com "requested path is invalid".

### Como conferir

Abra `/login` e clique em **Google**. Enquanto o provedor estiver desligado, a
tela responde na hora que ele não foi habilitado — não redireciona para uma
página de erro em inglês. Depois de configurado, o mesmo botão leva ao Google.
