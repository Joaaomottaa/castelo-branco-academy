-- ============================================================================
--  CASTELO BRANCO ACADEMY — 01. SCHEMA
--  Cole este arquivo inteiro no SQL Editor do Supabase e rode UMA vez.
--  É idempotente: pode rodar de novo sem quebrar.
-- ============================================================================

-- ---------------------------------------------------------------- extensões
-- pgcrypto (gen_random_uuid, crypt) e pg_trgm (busca por similaridade) já vêm
-- disponíveis no Supabase; aqui só garantimos que estão ativas.
create extension if not exists pgcrypto  with schema extensions;
create extension if not exists pg_trgm   with schema extensions;

-- -------------------------------------------------------------------- enums
-- Criados com DO block porque "create type if not exists" não existe no PG.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('aluno','empresa','admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'senioridade') then
    create type public.senioridade as enum ('Estagiário','Júnior','Pleno','Sênior','Especialista');
  end if;
  if not exists (select 1 from pg_type where typname = 'nivel_curso') then
    create type public.nivel_curso as enum ('Iniciante','Intermediário','Avançado');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_aula') then
    create type public.tipo_aula as enum ('video','quiz','material','ao-vivo');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_video') then
    create type public.status_video as enum ('enviando','processando','pronto','erro');
  end if;
  if not exists (select 1 from pg_type where typname = 'plano_tipo') then
    create type public.plano_tipo as enum ('Free','Pro','Enterprise');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_assinatura') then
    create type public.status_assinatura as enum ('trial','ativa','cancelada','inadimplente');
  end if;
  if not exists (select 1 from pg_type where typname = 'modelo_trabalho') then
    create type public.modelo_trabalho as enum ('Presencial','Híbrido','Remoto');
  end if;
  if not exists (select 1 from pg_type where typname = 'contrato_tipo') then
    create type public.contrato_tipo as enum ('CLT','PJ','Estágio','Freelance');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_candidatura') then
    create type public.status_candidatura as enum ('enviada','em_analise','entrevista','aprovada','recusada');
  end if;
end $$;

-- ======================================================================
--  TABELAS
-- ======================================================================

-- ------------------------------------------------------------------ perfis
create table if not exists public.perfis (
  id               uuid primary key references auth.users on delete cascade,
  nome             text not null,
  email            text not null,
  role             public.user_role not null default 'aluno',
  avatar_url       text,
  telefone         text,
  cidade           text,
  uf               char(2),
  crc              text,
  cargo            text,
  bio              text,
  senioridade      public.senioridade,
  pretensao        text,
  linkedin         text,
  -- banco de talentos
  disponivel       boolean not null default false,
  perfil_publico   boolean not null default false,
  -- gamificação
  pontos           integer not null default 0,
  nivel            integer not null default 1,
  ofensiva         integer not null default 0,
  ultimo_estudo    date,
  -- assinatura
  plano            public.plano_tipo not null default 'Free',
  -- LGPD
  consentimento_em timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index if not exists perfis_talentos_idx
  on public.perfis (disponivel, uf, senioridade) where perfil_publico;

create index if not exists perfis_busca_idx on public.perfis
  using gin ((coalesce(nome,'') || ' ' || coalesce(cargo,'') || ' ' || coalesce(bio,'')) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- empresas
create table if not exists public.empresas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  cnpj      text unique,
  logo_url  text,
  cor       text default '#00204D',
  site      text,
  cidade    text,
  uf        char(2),
  owner_id  uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.empresa_membros (
  empresa_id uuid references public.empresas(id) on delete cascade,
  perfil_id  uuid references public.perfis(id)  on delete cascade,
  papel      text not null default 'membro',
  primary key (empresa_id, perfil_id)
);

-- ------------------------------------------------------------------ cursos
create table if not exists public.cursos (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  titulo         text not null,
  subtitulo      text,
  descricao      text,
  categoria      text not null,
  nivel          public.nivel_curso not null default 'Iniciante',
  capa_url       text,
  cor            text not null default '#00204D',
  instrutor      text,
  instrutor_cargo text,
  carga_horaria  integer not null default 0,
  pontos_pepc    integer not null default 0,
  preco_centavos integer,                       -- null = incluso na assinatura
  publicado      boolean not null default false,
  destaque       boolean not null default false,
  novo           boolean not null default false,
  nota           numeric(2,1) not null default 5.0,
  alunos         integer not null default 0,
  nota_minima    integer not null default 70,
  tags           text[] not null default '{}',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.modulos (
  id       uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo   text not null,
  resumo   text,
  ordem    integer not null default 0,
  unique (curso_id, ordem)
);

create table if not exists public.aulas (
  id             uuid primary key default gen_random_uuid(),
  modulo_id      uuid not null references public.modulos(id) on delete cascade,
  titulo         text not null,
  descricao      text,
  tipo           public.tipo_aula not null default 'video',
  duracao_min    integer not null default 0,
  ordem          integer not null default 0,
  gratuita       boolean not null default false,
  -- vídeo (preenchido pelo provedor de streaming)
  video_asset_id text,
  video_status   public.status_video,
  playback_id    text,
  transcricao    text,
  resumo_ia      text,
  criado_em      timestamptz not null default now(),
  unique (modulo_id, ordem)
);

create table if not exists public.materiais (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references public.aulas(id) on delete cascade,
  nome          text not null,
  arquivo_path  text not null,
  tamanho_bytes bigint,
  criado_em     timestamptz not null default now()
);

-- ------------------------------------------------------------- matrículas
create table if not exists public.matriculas (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  curso_id  uuid not null references public.cursos(id) on delete cascade,
  origem    text not null default 'assinatura',   -- assinatura | avulsa | empresa | cortesia
  criada_em timestamptz not null default now(),
  unique (perfil_id, curso_id)
);

create table if not exists public.progresso_aulas (
  perfil_id       uuid not null references public.perfis(id) on delete cascade,
  aula_id         uuid not null references public.aulas(id) on delete cascade,
  concluida       boolean not null default false,
  segundos_vistos integer not null default 0,
  atualizado_em   timestamptz not null default now(),
  primary key (perfil_id, aula_id)
);

create index if not exists progresso_perfil_idx on public.progresso_aulas (perfil_id);

-- ------------------------------------------------------------- avaliações
create table if not exists public.questoes (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references public.aulas(id) on delete cascade,
  enunciado     text not null,
  alternativas  jsonb not null,          -- [{ "id":"a", "texto":"..." }]
  correta       text not null,
  explicacao    text,
  gerada_por_ia boolean not null default false,
  revisada      boolean not null default false
);

create table if not exists public.tentativas (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  aula_id   uuid not null references public.aulas(id) on delete cascade,
  nota      numeric(5,2) not null,
  respostas jsonb not null,
  criada_em timestamptz not null default now()
);

-- ----------------------------------------------------------- certificados
create table if not exists public.certificados (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  curso_id      uuid not null references public.cursos(id) on delete cascade,
  codigo        text not null unique,
  carga_horaria integer not null,
  pontos_pepc   integer not null default 0,
  pdf_path      text,
  emitido_em    timestamptz not null default now(),
  unique (perfil_id, curso_id)
);

-- ------------------------------------------------------------ assinaturas
create table if not exists public.assinaturas (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid references public.perfis(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  plano      public.plano_tipo not null default 'Free',
  status     public.status_assinatura not null default 'trial',
  gateway_id text,
  licencas   integer not null default 1,
  inicia_em  timestamptz not null default now(),
  expira_em  timestamptz,
  constraint assinatura_tem_dono check (perfil_id is not null or empresa_id is not null)
);

create table if not exists public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  assinatura_id  uuid references public.assinaturas(id) on delete set null,
  perfil_id      uuid references public.perfis(id) on delete set null,
  valor_centavos integer not null,
  metodo         text,
  status         text not null,
  gateway_ref    text unique,             -- garante idempotência do webhook
  criado_em      timestamptz not null default now()
);

-- ------------------------------------------------------ banco de talentos
create table if not exists public.habilidades (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  grupo text
);

create table if not exists public.perfil_habilidades (
  perfil_id     uuid references public.perfis(id) on delete cascade,
  habilidade_id uuid references public.habilidades(id) on delete cascade,
  nivel         integer not null default 50,
  verificada    boolean not null default false,
  primary key (perfil_id, habilidade_id)
);

create table if not exists public.vagas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  titulo           text not null,
  descricao        text,
  cidade           text,
  uf               char(2),
  modelo           public.modelo_trabalho not null default 'Presencial',
  contrato         public.contrato_tipo not null default 'CLT',
  faixa            text,
  senioridade      public.senioridade,
  requisitos       text[] not null default '{}',
  cursos_desejados uuid[] not null default '{}',
  ativa            boolean not null default true,
  publicada_em     timestamptz not null default now()
);

create index if not exists vagas_filtro_idx on public.vagas (ativa, uf, modelo, contrato);

create table if not exists public.candidaturas (
  id        uuid primary key default gen_random_uuid(),
  vaga_id   uuid not null references public.vagas(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  status    public.status_candidatura not null default 'enviada',
  score     integer,
  mensagem  text,
  criada_em timestamptz not null default now(),
  unique (vaga_id, perfil_id)
);

create table if not exists public.favoritos (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  alvo_id   uuid not null,
  tipo      text not null check (tipo in ('talento','vaga')),
  criado_em timestamptz not null default now(),
  primary key (perfil_id, alvo_id, tipo)
);

-- ------------------------------------------------------------ gamificação
create table if not exists public.conquistas (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  nome      text not null,
  descricao text,
  icone     text,
  xp        integer not null default 0
);

create table if not exists public.perfil_conquistas (
  perfil_id    uuid references public.perfis(id) on delete cascade,
  conquista_id uuid references public.conquistas(id) on delete cascade,
  obtida_em    timestamptz not null default now(),
  primary key (perfil_id, conquista_id)
);

-- -------------------------------------------------------------- auditoria
create table if not exists public.eventos (
  id        bigserial primary key,
  perfil_id uuid references public.perfis(id) on delete set null,
  tipo      text not null,
  payload   jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists eventos_perfil_idx on public.eventos (perfil_id, criado_em desc);


-- ======================================================================
--  FUNÇÕES E TRIGGERS
-- ======================================================================

-- Mantém atualizado_em em dia -----------------------------------------------
create or replace function public.set_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_perfis_atualizado on public.perfis;
create trigger trg_perfis_atualizado before update on public.perfis
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_cursos_atualizado on public.cursos;
create trigger trg_cursos_atualizado before update on public.cursos
  for each row execute function public.set_atualizado_em();

-- É admin? -------------------------------------------------------------------
-- SECURITY DEFINER de propósito: a função é dona da tabela, então o RLS de
-- "perfis" NÃO se aplica dentro dela. É isso que evita a recursão infinita
-- quando ela é usada dentro de uma policy da própria tabela perfis.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfis where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_membro_empresa(p_empresa uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.empresa_membros
    where empresa_id = p_empresa and perfil_id = auth.uid()
  );
$$;

-- Cria o perfil automaticamente quando alguém se cadastra --------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, role, consentimento_em)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'aluno'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Emite o certificado ao concluir 100% do curso ------------------------------
create or replace function public.checar_conclusao_curso()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_curso_id      uuid;
  v_carga         integer;
  v_pepc          integer;
  v_total_aulas   integer;
  v_aulas_feitas  integer;
begin
  select c.id, c.carga_horaria, c.pontos_pepc
    into v_curso_id, v_carga, v_pepc
  from public.aulas a
  join public.modulos m on m.id = a.modulo_id
  join public.cursos  c on c.id = m.curso_id
  where a.id = new.aula_id;

  if v_curso_id is null then
    return new;
  end if;

  select count(*) into v_total_aulas
  from public.aulas a
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = v_curso_id;

  select count(*) into v_aulas_feitas
  from public.progresso_aulas p
  join public.aulas a   on a.id = p.aula_id
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = v_curso_id
    and p.perfil_id = new.perfil_id
    and p.concluida;

  if v_total_aulas > 0 and v_aulas_feitas >= v_total_aulas then
    insert into public.certificados (perfil_id, curso_id, codigo, carga_horaria, pontos_pepc)
    values (
      new.perfil_id,
      v_curso_id,
      'CBA-' || to_char(now(),'YYYY') || '-' ||
        upper(substr(md5(new.perfil_id::text || v_curso_id::text),1,4)) || '-' ||
        upper(substr(md5(random()::text),1,4)),
      v_carga,
      coalesce(v_pepc,0)
    )
    on conflict (perfil_id, curso_id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists trg_conclusao_curso on public.progresso_aulas;
create trigger trg_conclusao_curso
  after insert or update on public.progresso_aulas
  for each row when (new.concluida) execute function public.checar_conclusao_curso();

-- Matrícula automática ao começar a assistir ---------------------------------
create or replace function public.matricular_automatico()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_curso uuid;
begin
  select m.curso_id into v_curso
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where a.id = new.aula_id;

  if v_curso is not null then
    insert into public.matriculas (perfil_id, curso_id, origem)
    values (new.perfil_id, v_curso, 'assinatura')
    on conflict (perfil_id, curso_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_matricula_auto on public.progresso_aulas;
create trigger trg_matricula_auto
  after insert on public.progresso_aulas
  for each row execute function public.matricular_automatico();


-- ======================================================================
--  PERMISSÕES DAS FUNÇÕES
--
--  No Postgres toda função nasce com EXECUTE concedido a PUBLIC, e o
--  PostgREST expõe tudo que está no schema `public` como /rest/v1/rpc/<nome>.
--  Sem revogar, qualquer pessoa com a chave anônima (que vive no frontend)
--  consegue chamar essas funções pela API.
--
--  Funções de trigger não precisam ser chamáveis por ninguém: o trigger roda
--  com os direitos do dono, não do usuário que fez a consulta.
-- ======================================================================
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.checar_conclusao_curso() from public, anon, authenticated;
revoke execute on function public.matricular_automatico()  from public, anon, authenticated;
revoke execute on function public.set_atualizado_em()      from public, anon, authenticated;

-- is_admin() e is_membro_empresa() são usadas DENTRO das policies de RLS, que
-- são avaliadas com o papel de quem consulta. Precisam continuar executáveis,
-- senão todo acesso quebra. São seguras: só devolvem um booleano sobre o
-- próprio chamador (auth.uid()).
revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to anon, authenticated;

revoke execute on function public.is_membro_empresa(uuid) from public;
grant  execute on function public.is_membro_empresa(uuid) to anon, authenticated;


-- ======================================================================
--  ROW LEVEL SECURITY — habilitada em TODAS as tabelas
-- ======================================================================
alter table public.perfis             enable row level security;
alter table public.empresas           enable row level security;
alter table public.empresa_membros    enable row level security;
alter table public.cursos             enable row level security;
alter table public.modulos            enable row level security;
alter table public.aulas              enable row level security;
alter table public.materiais          enable row level security;
alter table public.matriculas         enable row level security;
alter table public.progresso_aulas    enable row level security;
alter table public.questoes           enable row level security;
alter table public.tentativas         enable row level security;
alter table public.certificados       enable row level security;
alter table public.assinaturas        enable row level security;
alter table public.pagamentos         enable row level security;
alter table public.habilidades        enable row level security;
alter table public.perfil_habilidades enable row level security;
alter table public.vagas              enable row level security;
alter table public.candidaturas       enable row level security;
alter table public.favoritos          enable row level security;
alter table public.conquistas         enable row level security;
alter table public.perfil_conquistas  enable row level security;
alter table public.eventos            enable row level security;

-- Limpa policies anteriores para o script poder rodar de novo ---------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------ perfis
create policy "perfis: leitura própria"      on public.perfis for select using (id = auth.uid());
create policy "perfis: leitura pública"      on public.perfis for select using (perfil_publico = true);
create policy "perfis: admin lê tudo"        on public.perfis for select using (public.is_admin());
create policy "perfis: atualiza o próprio"   on public.perfis for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "perfis: admin atualiza"       on public.perfis for update using (public.is_admin());

-- ---------------------------------------------------------------- empresas
create policy "empresas: leitura pública"    on public.empresas for select using (true);
create policy "empresas: admin escreve"      on public.empresas for all
  using (public.is_admin()) with check (public.is_admin());
create policy "membros: vê o próprio time"   on public.empresa_membros for select
  using (perfil_id = auth.uid() or public.is_membro_empresa(empresa_id) or public.is_admin());

-- --------------------------------------------------- catálogo (leitura livre)
create policy "cursos: publicados são públicos" on public.cursos for select
  using (publicado = true or public.is_admin());
create policy "cursos: admin escreve" on public.cursos for all
  using (public.is_admin()) with check (public.is_admin());

create policy "modulos: segue o curso" on public.modulos for select
  using (exists (select 1 from public.cursos c where c.id = curso_id and (c.publicado or public.is_admin())));
create policy "modulos: admin escreve" on public.modulos for all
  using (public.is_admin()) with check (public.is_admin());

create policy "aulas: segue o módulo" on public.aulas for select
  using (exists (
    select 1 from public.modulos m join public.cursos c on c.id = m.curso_id
    where m.id = modulo_id and (c.publicado or public.is_admin())
  ));
create policy "aulas: admin escreve" on public.aulas for all
  using (public.is_admin()) with check (public.is_admin());

-- Materiais só para quem está matriculado -----------------------------------
create policy "materiais: só matriculado" on public.materiais for select
  using (exists (
    select 1
    from public.aulas a
    join public.modulos m   on m.id = a.modulo_id
    join public.matriculas mt on mt.curso_id = m.curso_id
    where a.id = aula_id and mt.perfil_id = auth.uid()
  ) or public.is_admin());
create policy "materiais: admin escreve" on public.materiais for all
  using (public.is_admin()) with check (public.is_admin());

create policy "questoes: só matriculado" on public.questoes for select
  using (exists (
    select 1
    from public.aulas a
    join public.modulos m     on m.id = a.modulo_id
    join public.matriculas mt on mt.curso_id = m.curso_id
    where a.id = aula_id and mt.perfil_id = auth.uid()
  ) or public.is_admin());
create policy "questoes: admin escreve" on public.questoes for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------- dados do usuário
create policy "matriculas: próprias" on public.matriculas for all
  using (perfil_id = auth.uid() or public.is_admin())
  with check (perfil_id = auth.uid());

create policy "progresso: próprio" on public.progresso_aulas for all
  using (perfil_id = auth.uid() or public.is_admin())
  with check (perfil_id = auth.uid());

create policy "tentativas: próprias" on public.tentativas for all
  using (perfil_id = auth.uid() or public.is_admin())
  with check (perfil_id = auth.uid());

create policy "certificados: próprios" on public.certificados for select
  using (perfil_id = auth.uid() or public.is_admin());
create policy "certificados: de quem é público" on public.certificados for select
  using (exists (select 1 from public.perfis p where p.id = perfil_id and p.perfil_publico));

create policy "assinaturas: própria" on public.assinaturas for select
  using (perfil_id = auth.uid() or public.is_admin());
create policy "pagamentos: próprios" on public.pagamentos for select
  using (perfil_id = auth.uid() or public.is_admin());

create policy "favoritos: próprios" on public.favoritos for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "eventos: próprios" on public.eventos for select
  using (perfil_id = auth.uid() or public.is_admin());
create policy "eventos: qualquer um registra" on public.eventos for insert
  with check (perfil_id = auth.uid() or perfil_id is null);

-- ------------------------------------------------------ banco de talentos
create policy "habilidades: leitura livre" on public.habilidades for select using (true);
create policy "habilidades: admin escreve" on public.habilidades for all
  using (public.is_admin()) with check (public.is_admin());

create policy "perfil_habilidades: leitura" on public.perfil_habilidades for select
  using (
    perfil_id = auth.uid()
    or exists (select 1 from public.perfis p where p.id = perfil_id and p.perfil_publico)
    or public.is_admin()
  );
create policy "perfil_habilidades: escreve as próprias" on public.perfil_habilidades for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "vagas: ativas são públicas" on public.vagas for select
  using (ativa = true or public.is_admin() or public.is_membro_empresa(empresa_id));
create policy "vagas: empresa e admin escrevem" on public.vagas for all
  using (public.is_admin() or public.is_membro_empresa(empresa_id))
  with check (public.is_admin() or public.is_membro_empresa(empresa_id));

create policy "candidaturas: próprias" on public.candidaturas for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "candidaturas: empresa vê as das suas vagas" on public.candidaturas for select
  using (exists (
    select 1 from public.vagas v
    where v.id = vaga_id and (public.is_membro_empresa(v.empresa_id) or public.is_admin())
  ));

-- ------------------------------------------------------------ gamificação
create policy "conquistas: leitura livre" on public.conquistas for select using (true);
create policy "conquistas: admin escreve" on public.conquistas for all
  using (public.is_admin()) with check (public.is_admin());
create policy "perfil_conquistas: leitura" on public.perfil_conquistas for select
  using (
    perfil_id = auth.uid()
    or exists (select 1 from public.perfis p where p.id = perfil_id and p.perfil_publico)
    or public.is_admin()
  );

-- ======================================================================
--  Fim do 01_schema.sql — rode agora o 02_seed.sql
-- ======================================================================
