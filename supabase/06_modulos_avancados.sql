-- ============================================================================
--  CASTELO BRANCO ACADEMY — 06. MÓDULOS AVANÇADOS
--  Rode DEPOIS do 05_corrigir_auth.sql. Idempotente.
--
--  Adiciona quatro módulos:
--    1. Trilhas de carreira  (sequência de cursos por cargo + selo)
--    2. Gamificação          (conquistas, missões, XP, ofensiva)
--    3. Comunidade           (feed, curtidas, comentários, conexões, mensagens)
--    4. Banco de questões    (questões, cadernos, simulados)
-- ============================================================================

-- ============================================================================
--  1. TRILHAS DE CARREIRA
-- ============================================================================
create table if not exists public.trilhas (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nome           text not null,
  subtitulo      text,
  descricao      text,
  cargo_alvo     text not null,
  area           text not null,
  nivel_entrada  public.nivel_curso not null default 'Iniciante',
  nivel_saida    public.nivel_curso not null default 'Avançado',
  cor            text not null default '#00204D',
  icone          text default 'target',
  faixa_salarial text,
  ordem          integer not null default 0,
  publicada      boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table if not exists public.trilha_cursos (
  trilha_id   uuid not null references public.trilhas(id) on delete cascade,
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  ordem       integer not null default 0,
  obrigatorio boolean not null default true,
  primary key (trilha_id, curso_id),
  unique (trilha_id, ordem)
);

create table if not exists public.trilha_habilidades (
  trilha_id      uuid not null references public.trilhas(id) on delete cascade,
  habilidade_id  uuid not null references public.habilidades(id) on delete cascade,
  nivel_esperado integer not null default 70,
  primary key (trilha_id, habilidade_id)
);

create table if not exists public.certificados_trilha (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  trilha_id     uuid not null references public.trilhas(id) on delete cascade,
  codigo        text not null unique,
  carga_horaria integer not null default 0,
  pontos_pepc   integer not null default 0,
  emitido_em    timestamptz not null default now(),
  unique (perfil_id, trilha_id)
);

-- A vaga pode exigir trilha completa, não só curso avulso
alter table public.vagas
  add column if not exists trilhas_desejadas uuid[] not null default '{}';

create index if not exists trilha_cursos_idx on public.trilha_cursos (trilha_id, ordem);

-- ============================================================================
--  2. GAMIFICAÇÃO
-- ============================================================================
alter table public.conquistas
  add column if not exists categoria  text not null default 'geral',
  add column if not exists raridade   text not null default 'comum',
  add column if not exists criterio   jsonb,
  add column if not exists recompensa text,
  add column if not exists ordem      integer not null default 0;

create table if not exists public.eventos_xp (
  id         bigserial primary key,
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  tipo       text not null,
  xp         integer not null,
  descricao  text,
  referencia uuid,
  criado_em  timestamptz not null default now()
);
create index if not exists eventos_xp_perfil_idx on public.eventos_xp (perfil_id, criado_em desc);

create table if not exists public.missoes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  titulo     text not null,
  descricao  text,
  icone      text default 'target',
  periodo    text not null default 'semanal',
  metrica    text not null,
  meta       integer not null default 1,
  xp         integer not null default 100,
  recompensa text,
  ativa      boolean not null default true,
  ordem      integer not null default 0
);

create table if not exists public.perfil_missoes (
  perfil_id    uuid not null references public.perfis(id) on delete cascade,
  missao_id    uuid not null references public.missoes(id) on delete cascade,
  ciclo        date not null,
  progresso    integer not null default 0,
  concluida_em timestamptz,
  resgatada_em timestamptz,
  primary key (perfil_id, missao_id, ciclo)
);

create table if not exists public.estudo_diario (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  dia       date not null,
  minutos   integer not null default 0,
  aulas     integer not null default 0,
  quizzes   integer not null default 0,
  primary key (perfil_id, dia)
);

-- ============================================================================
--  3. COMUNIDADE
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_post') then
    create type public.tipo_post as enum ('texto','conquista','certificado','vaga','artigo','anuncio');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_conexao') then
    create type public.status_conexao as enum ('pendente','aceita','recusada');
  end if;
end $$;

create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  autor_id       uuid not null references public.perfis(id) on delete cascade,
  empresa_id     uuid references public.empresas(id) on delete set null,
  tipo           public.tipo_post not null default 'texto',
  conteudo       text not null,
  link_url       text,
  imagem_path    text,
  certificado_id uuid references public.certificados(id) on delete set null,
  conquista_id   uuid references public.conquistas(id) on delete set null,
  trilha_id      uuid references public.trilhas(id) on delete set null,
  fixado         boolean not null default false,
  -- Desnormalizados: o RLS de `perfis` não deixa ler o perfil de quem não é
  -- público, e o feed precisa exibir o nome de quem publicou.
  autor_nome     text,
  autor_cargo    text,
  autor_nivel    integer,
  criado_em      timestamptz not null default now()
);
create index if not exists posts_feed_idx  on public.posts (criado_em desc);
create index if not exists posts_autor_idx on public.posts (autor_id, criado_em desc);

create table if not exists public.post_curtidas (
  post_id   uuid not null references public.posts(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, perfil_id)
);

create table if not exists public.post_comentarios (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  conteudo    text not null,
  autor_nome  text,
  autor_cargo text,
  criado_em   timestamptz not null default now()
);
create index if not exists comentarios_post_idx on public.post_comentarios (post_id, criado_em);

create table if not exists public.conexoes (
  id              uuid primary key default gen_random_uuid(),
  solicitante_id  uuid not null references public.perfis(id) on delete cascade,
  destinatario_id uuid not null references public.perfis(id) on delete cascade,
  status          public.status_conexao not null default 'pendente',
  criado_em       timestamptz not null default now(),
  respondido_em   timestamptz,
  unique (solicitante_id, destinatario_id),
  constraint conexao_nao_reflexiva check (solicitante_id <> destinatario_id)
);
create index if not exists conexoes_dest_idx on public.conexoes (destinatario_id, status);

create table if not exists public.conversas (
  id            uuid primary key default gen_random_uuid(),
  a_id          uuid not null references public.perfis(id) on delete cascade,
  b_id          uuid not null references public.perfis(id) on delete cascade,
  atualizado_em timestamptz not null default now(),
  unique (a_id, b_id),
  constraint conversa_nao_reflexiva check (a_id <> b_id)
);

create table if not exists public.mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversas(id) on delete cascade,
  remetente_id uuid not null references public.perfis(id) on delete cascade,
  conteudo     text not null,
  lida         boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists mensagens_conversa_idx on public.mensagens (conversa_id, criado_em);

-- ============================================================================
--  4. BANCO DE QUESTÕES
-- ============================================================================
create table if not exists public.questoes_banco (
  id           uuid primary key default gen_random_uuid(),
  enunciado    text not null,
  alternativas jsonb not null,
  correta      text not null,
  explicacao   text,
  area         text not null,
  assunto      text not null,
  nivel        public.nivel_curso not null default 'Intermediário',
  banca        text,
  ano          integer,
  curso_id     uuid references public.cursos(id) on delete set null,
  trilha_id    uuid references public.trilhas(id) on delete set null,
  tags         text[] not null default '{}',
  ativa        boolean not null default true,
  criado_em    timestamptz not null default now()
);
create index if not exists questoes_filtro_idx on public.questoes_banco (area, assunto, nivel) where ativa;

create table if not exists public.respostas_questoes (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  questao_id  uuid not null references public.questoes_banco(id) on delete cascade,
  alternativa text not null,
  correta     boolean not null,
  segundos    integer,
  criado_em   timestamptz not null default now()
);
create index if not exists respostas_perfil_idx on public.respostas_questoes (perfil_id, criado_em desc);

create table if not exists public.cadernos (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  nome      text not null,
  descricao text,
  cor       text not null default '#00204D',
  criado_em timestamptz not null default now()
);

create table if not exists public.caderno_questoes (
  caderno_id uuid not null references public.cadernos(id) on delete cascade,
  questao_id uuid not null references public.questoes_banco(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (caderno_id, questao_id)
);

create table if not exists public.simulados (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  nome          text not null,
  filtros       jsonb,
  total         integer not null default 0,
  acertos       integer not null default 0,
  nota          numeric(5,2),
  iniciado_em   timestamptz not null default now(),
  finalizado_em timestamptz
);
create index if not exists simulados_perfil_idx on public.simulados (perfil_id, iniciado_em desc);

-- ============================================================================
--  FUNÇÕES E TRIGGERS
-- ============================================================================

-- Selo de trilha: emitido quando todos os cursos obrigatórios têm certificado
create or replace function public.checar_conclusao_trilha()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; v_obrig integer; v_feitos integer; v_carga integer; v_pepc integer;
begin
  for t in
    select tc.trilha_id from public.trilha_cursos tc
    where tc.curso_id = new.curso_id and tc.obrigatorio
  loop
    select count(*) into v_obrig
    from public.trilha_cursos where trilha_id = t.trilha_id and obrigatorio;

    select count(*) into v_feitos
    from public.trilha_cursos tc
    join public.certificados c on c.curso_id = tc.curso_id and c.perfil_id = new.perfil_id
    where tc.trilha_id = t.trilha_id and tc.obrigatorio;

    if v_obrig > 0 and v_feitos >= v_obrig then
      select coalesce(sum(cu.carga_horaria),0), coalesce(sum(cu.pontos_pepc),0)
        into v_carga, v_pepc
      from public.trilha_cursos tc
      join public.cursos cu on cu.id = tc.curso_id
      where tc.trilha_id = t.trilha_id;

      insert into public.certificados_trilha (perfil_id, trilha_id, codigo, carga_horaria, pontos_pepc)
      values (new.perfil_id, t.trilha_id,
        'CBA-T-' || to_char(now(),'YYYY') || '-' ||
          upper(substr(md5(new.perfil_id::text || t.trilha_id::text),1,6)),
        v_carga, v_pepc)
      on conflict (perfil_id, trilha_id) do nothing;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists trg_conclusao_trilha on public.certificados;
create trigger trg_conclusao_trilha after insert on public.certificados
  for each row execute function public.checar_conclusao_trilha();

-- Ofensiva: RECALCULADA a partir de estudo_diario (não incremental — a versão
-- incremental quebrava quando os registros chegavam fora de ordem)
create or replace function public.calcular_ofensiva(p_perfil uuid)
returns integer language sql stable security definer set search_path = public as $$
  with dias as (
    select dia, (row_number() over (order by dia desc))::integer as rn
    from public.estudo_diario where perfil_id = p_perfil
  ), ancora as (select max(dia) as ultimo from dias)
  select coalesce(count(*),0)::integer
  from dias d cross join ancora a
  where a.ultimo >= current_date - 1 and d.dia = a.ultimo - (d.rn - 1);
$$;

create or replace function public.atualizar_ofensiva()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.perfis
  set ofensiva = public.calcular_ofensiva(new.perfil_id),
      ultimo_estudo = greatest(coalesce(ultimo_estudo, new.dia), new.dia)
  where id = new.perfil_id;
  return new;
end $$;

drop trigger if exists trg_ofensiva on public.estudo_diario;
create trigger trg_ofensiva after insert or update on public.estudo_diario
  for each row execute function public.atualizar_ofensiva();

-- XP: soma no perfil e recalcula o nível. Nível = teto(raiz(xp / 250))
create or replace function public.aplicar_xp()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  update public.perfis set pontos = pontos + new.xp
  where id = new.perfil_id returning pontos into v_total;
  update public.perfis
  set nivel = greatest(1, ceil(sqrt(v_total::numeric / 250))::integer)
  where id = new.perfil_id;
  return new;
end $$;

drop trigger if exists trg_aplicar_xp on public.eventos_xp;
create trigger trg_aplicar_xp after insert on public.eventos_xp
  for each row execute function public.aplicar_xp();

-- Nome do autor no feed
create or replace function public.preencher_autor_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select nome, cargo, nivel into new.autor_nome, new.autor_cargo, new.autor_nivel
  from public.perfis where id = new.autor_id;
  return new;
end $$;

create or replace function public.preencher_autor_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select nome, cargo into new.autor_nome, new.autor_cargo
  from public.perfis where id = new.perfil_id;
  return new;
end $$;

drop trigger if exists trg_autor_post on public.posts;
create trigger trg_autor_post before insert on public.posts
  for each row execute function public.preencher_autor_post();

drop trigger if exists trg_autor_comentario on public.post_comentarios;
create trigger trg_autor_comentario before insert on public.post_comentarios
  for each row execute function public.preencher_autor_comentario();

-- ============================================================================
--  PERMISSÕES DAS FUNÇÕES
--  Toda função nasce com EXECUTE para PUBLIC e o PostgREST expõe o schema
--  `public` em /rest/v1/rpc/. Funções de trigger não precisam ser chamáveis.
-- ============================================================================
revoke execute on function public.checar_conclusao_trilha()      from public, anon, authenticated;
revoke execute on function public.calcular_ofensiva(uuid)        from public, anon, authenticated;
revoke execute on function public.atualizar_ofensiva()           from public, anon, authenticated;
revoke execute on function public.aplicar_xp()                   from public, anon, authenticated;
revoke execute on function public.preencher_autor_post()         from public, anon, authenticated;
revoke execute on function public.preencher_autor_comentario()   from public, anon, authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.trilhas             enable row level security;
alter table public.trilha_cursos       enable row level security;
alter table public.trilha_habilidades  enable row level security;
alter table public.certificados_trilha enable row level security;
alter table public.eventos_xp          enable row level security;
alter table public.missoes             enable row level security;
alter table public.perfil_missoes      enable row level security;
alter table public.estudo_diario       enable row level security;
alter table public.posts               enable row level security;
alter table public.post_curtidas       enable row level security;
alter table public.post_comentarios    enable row level security;
alter table public.conexoes            enable row level security;
alter table public.conversas           enable row level security;
alter table public.mensagens           enable row level security;
alter table public.questoes_banco      enable row level security;
alter table public.respostas_questoes  enable row level security;
alter table public.cadernos            enable row level security;
alter table public.caderno_questoes    enable row level security;
alter table public.simulados           enable row level security;

-- Limpa policies destes módulos para o script poder rodar de novo
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'trilhas','trilha_cursos','trilha_habilidades','certificados_trilha',
      'eventos_xp','missoes','perfil_missoes','estudo_diario',
      'posts','post_curtidas','post_comentarios','conexoes','conversas','mensagens',
      'questoes_banco','respostas_questoes','cadernos','caderno_questoes','simulados')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Trilhas -------------------------------------------------------------------
create policy "trilhas: publicadas são públicas" on public.trilhas for select
  using (publicada = true or public.is_admin());
create policy "trilhas: admin escreve" on public.trilhas for all
  using (public.is_admin()) with check (public.is_admin());
create policy "trilha_cursos: leitura livre" on public.trilha_cursos for select using (true);
create policy "trilha_cursos: admin escreve" on public.trilha_cursos for all
  using (public.is_admin()) with check (public.is_admin());
create policy "trilha_habilidades: leitura livre" on public.trilha_habilidades for select using (true);
create policy "trilha_habilidades: admin escreve" on public.trilha_habilidades for all
  using (public.is_admin()) with check (public.is_admin());
create policy "cert_trilha: próprios" on public.certificados_trilha for select
  using (perfil_id = auth.uid() or public.is_admin());
create policy "cert_trilha: de perfil público" on public.certificados_trilha for select
  using (exists (select 1 from public.perfis p where p.id = perfil_id and p.perfil_publico));

-- Gamificação ---------------------------------------------------------------
create policy "xp: próprio" on public.eventos_xp for all
  using (perfil_id = auth.uid() or public.is_admin()) with check (perfil_id = auth.uid());
create policy "missoes: leitura livre" on public.missoes for select using (ativa or public.is_admin());
create policy "missoes: admin escreve" on public.missoes for all
  using (public.is_admin()) with check (public.is_admin());
create policy "perfil_missoes: próprias" on public.perfil_missoes for all
  using (perfil_id = auth.uid() or public.is_admin()) with check (perfil_id = auth.uid());
create policy "estudo: próprio" on public.estudo_diario for all
  using (perfil_id = auth.uid() or public.is_admin()) with check (perfil_id = auth.uid());

-- Comunidade ----------------------------------------------------------------
create policy "posts: leitura autenticada" on public.posts for select using (auth.uid() is not null);
create policy "posts: autor escreve" on public.posts for insert with check (autor_id = auth.uid());
create policy "posts: autor edita" on public.posts for update
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());
create policy "posts: autor ou admin apaga" on public.posts for delete
  using (autor_id = auth.uid() or public.is_admin());

create policy "curtidas: leitura autenticada" on public.post_curtidas for select using (auth.uid() is not null);
create policy "curtidas: próprias" on public.post_curtidas for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "comentarios: leitura autenticada" on public.post_comentarios for select using (auth.uid() is not null);
create policy "comentarios: próprios" on public.post_comentarios for insert with check (perfil_id = auth.uid());
create policy "comentarios: autor ou admin apaga" on public.post_comentarios for delete
  using (perfil_id = auth.uid() or public.is_admin());

create policy "conexoes: das duas pontas" on public.conexoes for select
  using (solicitante_id = auth.uid() or destinatario_id = auth.uid());
create policy "conexoes: solicita" on public.conexoes for insert with check (solicitante_id = auth.uid());
create policy "conexoes: destinatário responde" on public.conexoes for update
  using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());

create policy "conversas: das duas pontas" on public.conversas for select
  using (a_id = auth.uid() or b_id = auth.uid());
create policy "conversas: participante cria" on public.conversas for insert
  with check (a_id = auth.uid() or b_id = auth.uid());
create policy "mensagens: da conversa" on public.mensagens for select
  using (exists (select 1 from public.conversas c
    where c.id = conversa_id and (c.a_id = auth.uid() or c.b_id = auth.uid())));
create policy "mensagens: participante envia" on public.mensagens for insert
  with check (remetente_id = auth.uid() and exists (
    select 1 from public.conversas c
    where c.id = conversa_id and (c.a_id = auth.uid() or c.b_id = auth.uid())));

-- Questões ------------------------------------------------------------------
-- O gabarito fica visível porque a correção acontece no cliente neste MVP.
-- Quando houver prova valendo nota, mover a correção para uma Edge Function.
create policy "questoes: leitura livre" on public.questoes_banco for select
  using (ativa or public.is_admin());
create policy "questoes: admin escreve" on public.questoes_banco for all
  using (public.is_admin()) with check (public.is_admin());
create policy "respostas: próprias" on public.respostas_questoes for all
  using (perfil_id = auth.uid() or public.is_admin()) with check (perfil_id = auth.uid());
create policy "cadernos: próprios" on public.cadernos for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "caderno_questoes: do próprio caderno" on public.caderno_questoes for all
  using (exists (select 1 from public.cadernos c where c.id = caderno_id and c.perfil_id = auth.uid()))
  with check (exists (select 1 from public.cadernos c where c.id = caderno_id and c.perfil_id = auth.uid()));
create policy "simulados: próprios" on public.simulados for all
  using (perfil_id = auth.uid() or public.is_admin()) with check (perfil_id = auth.uid());

create policy "perfil_conquistas: escreve as próprias" on public.perfil_conquistas for insert
  with check (perfil_id = auth.uid());

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name in
      ('trilhas','trilha_cursos','trilha_habilidades','certificados_trilha',
       'eventos_xp','missoes','perfil_missoes','estudo_diario','posts',
       'post_curtidas','post_comentarios','conexoes','conversas','mensagens',
       'questoes_banco','respostas_questoes','cadernos','caderno_questoes','simulados')
  ) as tabelas_criadas;
-- Esperado: 19
