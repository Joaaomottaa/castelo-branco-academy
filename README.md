# Castelo Branco Academy — MVP

Plataforma de educação contábil + banco de talentos para a **Castelo Branco Contabilidade
Avançada**. Este repositório contém o MVP navegável usado para apresentação da ideia ao CEO.

Identidade visual extraída do site oficial (`castelobrancocontabilidade.com.br`):

| Token | Hex | Uso |
|---|---|---|
| Navy | `#00204D` | Cor primária, headers, sidebar |
| Navy profundo | `#001838` | Gradientes |
| Dourado | `#C89F50` | Ação, destaque, selos |
| Dourado claro | `#D2AD73` | Gradientes e textos de apoio |
| Creme | `#F3F1EB` | Fundo de aplicação |
| Tinta | `#1F2D3D` | Texto corrido |
| Teal | `#2F6E75` | Acento secundário |
| Fonte | Montserrat | Mesma do site institucional |

---

## Como rodar

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

### Contas de demonstração

As mesmas contas funcionam nos dois modos (seed local e Supabase).
Senha para todas: `123456`.

| Perfil | E-mail |
|---|---|
| Aluno | `aluno@castelobranco.com.br` |
| Empresa | `empresa@castelobranco.com.br` |
| Admin | `admin@castelobranco.com.br` |

Na tela de login há botões que preenchem cada conta automaticamente.

---

## Telas entregues

**Público**
- `/` — landing institucional (hero, cursos, trilhas, gamificação, banco de talentos, empresas, IA, planos)
- `/login`, `/cadastro`, `/recuperar-senha` — com entrar pelo Google
- `/auth/callback` — volta do login social
- `/diagnostico` — status da instalação do Supabase

**Área do aluno**
- `/app` — painel com KPIs, continuar assistindo, progresso, ranking, agenda, gamificação
- `/app/cursos` — catálogo com busca, situação (em andamento, concluídos) e filtros avançados
- `/app/cursos/[slug]` — página do curso com módulos, aulas e progresso
- `/app/cursos/[slug]/aula/[aulaId]` — player, avaliação, materiais e dúvidas (IA privada + fórum da turma)
- `/app/certificados` — certificados com código de validação e modal de visualização
- `/app/talentos` — banco de talentos com filtros combinados e favoritos
- `/app/talentos/[id]` — ficha do profissional: selos de habilidade, certificações de trilha, contato e mensagem
- `/app/vagas` — vagas com match, detalhe e candidatura em 1 clique
- `/app/trilhas` — trilhas de carreira por cargo, com progresso e selo
- `/app/trilhas/[slug]` — caminho da trilha, habilidades e vagas que a exigem
- `/app/questoes` — banco de questões com filtros combinados e por situação (não respondidas,
  errei, acertei); a questão abre inteira, com gabarito comentado, estatística da turma
  e histórico das suas tentativas, aulas do assunto, comentários, cadernos, anotação
  privada e aviso de erro
- `/app/questoes/resultados` — desempenho por período (inclusive datas escolhidas), área, assunto e nível
- `/app/questoes/simulados` — simulados guardados, com as questões erradas e a análise do Tino
- `/app/questoes/cadernos` — cadernos de questões
- `/app/ferramentas` — 18 calculadoras contábeis (folha, tributos, frete, importação, gestão)
- `/app/ferramentas/[slug]` — a calculadora, com memória de cálculo e o que observar
- `/app/comunidade` — feed, curtidas, comentários e conexões
- `/app/conquistas` — conquistas, missões, ofensiva e extrato de XP
- `/app/planos` — comparativo de planos, com troca de plano e cancelamento
- `/app/planos/assinar` — checkout com cupom, Pix, boleto e cartão (pagamento simulado)
- `/app/perfil` — edição de perfil, selos conquistados, contato, força do perfil, LGPD

**Administração**
- `/admin` — painel com recorte por dia, semana e mês, gráfico de métrica selecionável, funil com taxa de passagem, ranking de ferramentas e saúde da operação
- `/admin/cursos` — CRUD de cursos, módulos e aulas; filtros, ordenação, upload de vídeo e geração de questões
- `/admin/trilhas` — CRUD de trilhas: cursos na ordem, obrigatórios, habilidades e selo
- `/admin/questoes` — CRUD do banco de questões, com filtros e percentual de acerto por questão
- `/admin/questoes/gerar` — geração em lote com IA, com revisão obrigatória antes de gravar
- `/admin/alunos` — filtros, ficha completa, edição de perfil, mudança de plano, ativação e mensagem
- `/admin/alunos/[id]` — ficha do aluno dentro da área administrativa
- `/admin/comunicacao` — campanhas em massa com filtro de público e prévia
- `/admin/cupons` — cupons de desconto com regras, limites e acompanhamento de resgates
- `/admin/vagas` — CRUD de vagas e empresas, candidatos ordenados por compatibilidade

---

## Conectando o Supabase

Guia completo em **[docs/SUPABASE.md](docs/SUPABASE.md)**. Resumo:

1. Crie o projeto em <https://supabase.com> (região São Paulo).
2. No SQL Editor, rode os quatro arquivos **nesta ordem**:

   | Arquivo | O que faz |
   |---|---|
   | `supabase/01_schema.sql` | 20 tabelas, enums, índices, RLS e triggers |
   | `supabase/02_seed.sql` | 6 cursos, 15 módulos, 49 aulas, 9 empresas, 5 vagas |
   | `supabase/03_usuarios_demo.sql` | 9 contas de teste + progresso de demonstração |
   | `supabase/04_storage.sql` | Buckets de avatar, capa, material, certificado e vídeo |
   | `supabase/05_corrigir_auth.sql` | Corrige as colunas de token do `auth.users` — sem isso o login falha |
   | `supabase/06_modulos_avancados.sql` | Trilhas, gamificação, comunidade e banco de questões (19 tabelas) |
   | `supabase/07_seed_avancado.sql` | 4 cursos, 5 trilhas, 21 conquistas, 7 missões, 27 questões, feed |
   | `supabase/08_video_e_quiz.sql` | Vídeo na aula, avaliação pós-aula corrigida no servidor |
   | `supabase/09_duvidas_ferramentas_metricas.sql` | Dúvidas com IA e fórum, uso das ferramentas, métricas do painel |
   | `supabase/10_cupons_comunicacao_vagas.sql` | Cupons, contratação de plano, notificações e campanhas |
   | `supabase/11_selos_avaliacao_questoes.sql` | Selos de habilidade por curso, avaliação do curso, contato do talento e administração do banco de questões |
   | `supabase/12_simulados_salvos.sql` | Simulado guardado com as respostas e o feedback do Tino |
   | `supabase/13_questao_como_lugar.sql` | Comentários, anotações e avisos de erro na questão; estatística e aulas relacionadas |
   | `supabase/14_historico_da_questao.sql` | Histórico das tentativas do aluno dentro da estatística da questão |
   | `supabase/15_perfil_do_login_social.sql` | Nome e foto do Google no perfil criado por login social |

3. Desligue **Confirm email** em Authentication › Sign In / Providers › Email.
4. Copie `.env.local.example` para `.env.local` e preencha URL e anon key.
5. Reinicie (`npm run dev`) e confira em **<http://localhost:3000/diagnostico>**.

### Modo demonstração

Conectar o Supabase **não desliga** a demonstração. Existe uma chave `[ Supabase | Demo ]`
no topo da área logada, no login e no diagnóstico:

- **Supabase** — lê e grava no banco real (padrão).
- **Demo** — usa o seed local; nenhuma consulta chega ao banco.

A escolha fica no navegador, então cada pessoa da equipe escolhe a sua. As contas de
teste são as mesmas nos dois modos, porque o `03_usuarios_demo.sql` recria no banco
exatamente as contas do seed local.

Para travar a demonstração num ambiente de vitrine, use `NEXT_PUBLIC_MODO_DEMO=true`.

### Como a troca acontece

`src/lib/repo.ts` é a única camada que fala com o banco. Se o Supabase estiver
configurado ela consulta o Postgres; senão devolve o seed de `src/lib/data.ts`.
`src/lib/dados.tsx` distribui o resultado para as páginas via `useDados()`, então
nenhuma tela precisa saber de onde o dado veio.

---

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/SSG para SEO do blog e das vagas, RSC reduz JS no cliente |
| Linguagem | TypeScript | Contrato de tipos entre 5 devs juniores evita boa parte dos bugs |
| Estilo | Tailwind CSS v4 | Design tokens da marca centralizados em `globals.css` |
| Ícones | lucide-react | Leve, consistente, tree-shakeable |
| Auth + DB | Supabase (Postgres + RLS) | Auth pronta, RLS resolve multi-tenant sem backend próprio |
| Vídeo | YouTube não listado + Storage do Supabase | Gratuito e suficiente para o MVP. Bunny Stream quando houver contrato — ver [docs/VIDEO.md](docs/VIDEO.md) |

---

## Estrutura

```
src/
  app/
    page.tsx                     landing
    (auth)/                      login, cadastro, recuperar-senha
    app/                         área do aluno (layout com AppShell)
    admin/                       área administrativa
  components/
    ui.tsx                       Button, Card, Badge, Progress, Field, Avatar…
    site-chrome.tsx              header e footer públicos
    app-shell.tsx                sidebar agrupada + topbar + guarda de rota
    tino.tsx                     assistente de IA (widget flutuante)
    player-aula.tsx              player: upload assinado ou embed
    quiz-aula.tsx                avaliação de 3 questões ao fim da aula
    modal.tsx                    modal e confirmação de exclusão
    questao-card.tsx             a questão inteira, com as abas de apoio
    paginacao.tsx                paginação usada no admin e no banco de questões
    selos.tsx                    chips de habilidade e selo dourado de trilha
    perfil-talento.tsx           ficha do profissional (aluno e admin usam a mesma)
    conclusao-curso.tsx          certificado, selos e avaliação ao fechar o curso
    quiz-aula.tsx                avaliação em modal, uma questão por página
    duvidas.tsx                  abas de IA e fórum dentro da aula
    ferramenta-form.tsx          formulário genérico das calculadoras
    graficos.tsx                 barras, área, rosca, funil e sparkline em SVG
    texto-rico.tsx               markdown mínimo das respostas
    notificacoes.tsx             sino e painel de notificações
    seletor-modo.tsx             chave Supabase / Demo
  lib/
    ferramentas/
      tabelas.ts                 INSS, IRRF, Simples, presunções — tudo num lugar só
      nucleo.ts                  tipos, formatação e os cálculos reaproveitados
      catalogo.ts                as 18 ferramentas, declarativas
    brand.ts                     tokens de marca
    types.ts                     tipos do domínio
    data.ts                      seed de demonstração (fallback)
    supabase.ts                  clientes browser e anônimo
    repo.ts                      catálogo, talentos, vagas + cálculo de match
    repo-admin.ts                CRUD de cursos, módulos, aulas e trilhas
    repo-quiz.ts                 avaliação pós-aula (lado do aluno)
    repo-conclusao.ts            resumo da conclusão e avaliação do curso/trilha
    repo-duvidas.ts              dúvidas com IA e fórum da aula
    repo-ferramentas.ts          registro de uso das calculadoras
    metricas.ts                  agregações do painel (real e demonstração)
    repo-cupons.ts               cupons, validação e contratação de plano
    repo-pessoas.ts              ativação, e-mail, campanhas e notificações
    repo-vagas.ts                vagas, empresas e candidatos
    pagamento.ts                 Pix (EMV + CRC16), boleto e cartão simulados
    tino-abrir.ts                abre o chat do Tino de qualquer tela
    video.ts                     upload, URL assinada e embed de vídeo
    repo-trilhas.ts              trilhas de carreira e selos
    repo-gamificacao.ts          conquistas, missões, XP, ofensiva
    repo-comunidade.ts           feed, curtidas, comentários, conexões
    repo-questoes.ts             questões, cadernos, simulados, CRUD do admin e desempenho
    planos.ts                    planos e limites por plano
    dados.tsx                    provider do catálogo (useDados)
    session.tsx                  sessão, progresso, favoritos, candidaturas
supabase/
  01_schema.sql                  tabelas, enums, RLS, triggers
  02_seed.sql                    catálogo, empresas, vagas
  03_usuarios_demo.sql           contas de teste
  04_storage.sql                 buckets e políticas
  05_corrigir_auth.sql           correção do auth
  06_modulos_avancados.sql       trilhas, gamificação, comunidade, questões
  07_seed_avancado.sql           conteúdo dos módulos novos
  08_video_e_quiz.sql            vídeo na aula e avaliação corrigida no servidor
  09_duvidas_ferramentas_metricas.sql  dúvidas com IA, uso das ferramentas, métricas
  10_cupons_comunicacao_vagas.sql      cupons, planos, campanhas, candidatos
  11_selos_avaliacao_questoes.sql      selos de habilidade, avaliação e banco de questões
  12_simulados_salvos.sql              simulado com respostas e feedback do Tino
  13_questao_como_lugar.sql            comentários, anotações, avisos de erro, estatística
  14_historico_da_questao.sql          histórico das tentativas do aluno na questão
  15_perfil_do_login_social.sql        nome e foto do Google no cadastro por OAuth
n8n/
  tino-assistente.json           fluxo do assistente (importar no n8n)
  tino-questoes.json             fluxo que gera as questões da aula
  tino-duvidas.json              fluxo que responde a dúvida dentro da aula
  tino-questoes-banco.json       fluxo que gera as questões do banco (/admin/questoes/gerar)
  tino-ia.json                   ponte de IA: recebe prompt pronto e devolve a resposta
docs/
  DEPLOY.md                      passo a passo de subida: Git, Supabase, Vercel
  SUPABASE.md                    passo a passo de configuração
  N8N-TINO.md                    como conectar o assistente
  VIDEO.md                       como o vídeo entra na aula
  FERRAMENTAS.md                 as calculadoras e como manter as tabelas
  PENDENCIAS.md                  o que falta para ir a produção
```

---

## O que é demonstração e o que é real

| Real e funcional (com Supabase conectado) | Simulado nesta versão |
|---|---|
| Login, cadastro, logout, guarda de rota | Envio de e-mail de recuperação |
| Progresso de aulas gravado em `progresso_aulas` | Streaming próprio com qualidade adaptativa |
| **Vídeo na aula: YouTube ou upload no Storage** | Telemetria de quanto do vídeo foi assistido |
| Favoritos e candidaturas | Geração de PDF do certificado |
| Edição de perfil e força do perfil | Pagamentos e assinatura |
| **Certificado emitido por trigger no banco** | Assistente de IA |
| **Avaliação pós-aula corrigida no servidor** | Envio de e-mail transacional |
| **18 calculadoras contábeis, cálculo no navegador** | |
| **Fórum de dúvidas por aula, com melhor resposta** | |
| **Cupons de desconto com regra e limite de uso** | Cobrança de verdade (gateway) |
| **Troca de plano gravada em assinatura e pagamento** | |
| **Campanhas em massa com filtro de público** | Disparo de e-mail (sem SMTP) |
| **CRUD completo de cursos, módulos, aulas e trilhas** | |
| Match vaga ↔ candidato por regras explicáveis | |
| **Trilhas com selo emitido por trigger** | Cobrança dos planos |
| Gamificação: XP, níveis, ofensiva, missões | |
| Feed com curtidas, comentários e conexões | |
| Banco de questões, cadernos e simulados | |
| Assistente Tino (reserva local; IA via n8n) | |

---

## Antes de ir a produção

**[docs/DEPLOY.md](docs/DEPLOY.md)** é o passo a passo da subida — Git, Supabase,
variáveis de ambiente, Vercel e o teste de fumaça que se roda depois.

**[docs/PENDENCIAS.md](docs/PENDENCIAS.md)** é a lista completa do que ficou pendente,
simulado ou provisório — com prioridade, motivo e o que fazer em cada item.

Os que bloqueiam o go-live, em resumo:

| | Item |
|---|---|
| 🔴 | Colocar o projeto em Git (nada está versionado) |
| 🔴 | Remover as contas de demonstração (senha `123456`, uma delas é admin) |
| 🔴 | Religar a confirmação de e-mail e configurar SMTP próprio |
| 🔴 | Mover os limites de plano para o servidor |
| 🔴 | Contratar streaming de vídeo (Bunny ou Cloudflare) |
| 🔴 | Termos de uso, política de privacidade e exclusão de conta real |
| 🔴 | Fazer o primeiro deploy |

Item novo que aparecer no desenvolvimento, registrar lá.
