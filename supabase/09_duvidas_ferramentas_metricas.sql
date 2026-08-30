-- ============================================================================
--  CASTELO BRANCO ACADEMY — 09. DÚVIDAS, FERRAMENTAS E MÉTRICAS
--  Rode DEPOIS do 08_video_e_quiz.sql. Idempotente.
--
--   1. Dúvidas da aula em duas vias: IA (privada) e fórum (pública)
--   2. Registro de uso das ferramentas de cálculo
--   3. Funções de métrica para o painel administrativo
-- ============================================================================

-- ============================================================================
--  1. DÚVIDAS DA AULA
-- ============================================================================
-- Duas vias, de propósito:
--
--   'ia'    → pergunta particular, respondida na hora pelo Tino com o contexto
--             da aula. Ninguém mais vê. É onde a pessoa pergunta o que teria
--             vergonha de perguntar na frente da turma.
--   'forum' → pergunta aberta, respondida por colega ou instrutor. Fica no
--             histórico da aula e serve para quem vier depois.
--
-- Quem escolhe é o aluno, na hora de enviar.
create table if not exists public.duvidas (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references public.aulas(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  -- denormalizado: o RLS de `perfis` impede ler quem não é público, e o nome
  -- do autor precisa aparecer na thread. Mesma solução usada em `posts`.
  autor_nome    text,
  autor_cargo   text,
  autor_role    text,
  tipo          text not null default 'forum' check (tipo in ('ia','forum')),
  pergunta      text not null,
  -- só para tipo 'ia'
  resposta_ia   text,
  fonte_ia      text,
  respondida_em timestamptz,
  -- só para tipo 'forum'
  resolvida     boolean not null default false,
  criado_em     timestamptz not null default now()
);

create index if not exists duvidas_aula_idx on public.duvidas (aula_id, criado_em desc);
create index if not exists duvidas_perfil_idx on public.duvidas (perfil_id, criado_em desc);

create table if not exists public.duvida_respostas (
  id          uuid primary key default gen_random_uuid(),
  duvida_id   uuid not null references public.duvidas(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  autor_nome  text,
  autor_cargo text,
  autor_role  text,
  conteudo    text not null,
  -- o autor da pergunta marca a resposta que resolveu
  melhor      boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index if not exists duvida_respostas_idx
  on public.duvida_respostas (duvida_id, criado_em);

create table if not exists public.duvida_votos (
  resposta_id uuid not null references public.duvida_respostas(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (resposta_id, perfil_id)
);

-- ------------------------------------------------- autor desnormalizado ----
create or replace function public.preencher_autor_duvida()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  select nome, cargo, role::text into new.autor_nome, new.autor_cargo, new.autor_role
  from public.perfis where id = new.perfil_id;
  return new;
end $fn$;

drop trigger if exists trg_autor_duvida on public.duvidas;
create trigger trg_autor_duvida before insert on public.duvidas
  for each row execute function public.preencher_autor_duvida();

drop trigger if exists trg_autor_duvida_resposta on public.duvida_respostas;
create trigger trg_autor_duvida_resposta before insert on public.duvida_respostas
  for each row execute function public.preencher_autor_duvida();

-- ============================================================================
--  2. USO DAS FERRAMENTAS
-- ============================================================================
-- Serve para o painel responder "que ferramenta a base realmente usa" — que é
-- o melhor indicador de qual curso vender em seguida.
create table if not exists public.ferramenta_usos (
  id        bigserial primary key,
  slug      text not null,
  perfil_id uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists ferramenta_usos_idx on public.ferramenta_usos (slug, criado_em desc);

-- ============================================================================
--  3. RLS
-- ============================================================================
alter table public.duvidas          enable row level security;
alter table public.duvida_respostas enable row level security;
alter table public.duvida_votos     enable row level security;
alter table public.ferramenta_usos  enable row level security;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('duvidas','duvida_respostas','duvida_votos','ferramenta_usos')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Pergunta para a IA é particular. Pergunta de fórum é da turma.
-- A pergunta feita à IA é o lugar onde a pessoa admite que não entendeu. Se o
-- administrador puder ler, ela deixa de perguntar — e a funcionalidade perde o
-- motivo de existir. Por isso o `is_admin()` NÃO aparece aqui.
create policy "duvidas: fórum é público, IA é privada" on public.duvidas for select
  using (
    (tipo = 'forum' and auth.uid() is not null)
    or perfil_id = auth.uid()
  );
create policy "duvidas: pergunta a própria" on public.duvidas for insert
  with check (perfil_id = auth.uid());
create policy "duvidas: autor ou admin edita" on public.duvidas for update
  using (perfil_id = auth.uid() or public.is_admin())
  with check (perfil_id = auth.uid() or public.is_admin());
-- Apagar continua possível para o admin no fórum: moderação de conteúdo
-- impróprio não pode depender do autor.
create policy "duvidas: autor apaga; admin modera o fórum" on public.duvidas for delete
  using (perfil_id = auth.uid() or (tipo = 'forum' and public.is_admin()));

create policy "respostas: seguem a dúvida" on public.duvida_respostas for select
  using (exists (
    select 1 from public.duvidas d
    where d.id = duvida_id
      and ((d.tipo = 'forum' and auth.uid() is not null)
           or d.perfil_id = auth.uid() or public.is_admin())
  ));
-- Só se responde em dúvida de fórum: a via da IA não é thread.
create policy "respostas: responde no fórum" on public.duvida_respostas for insert
  with check (
    perfil_id = auth.uid()
    and exists (select 1 from public.duvidas d where d.id = duvida_id and d.tipo = 'forum')
  );
create policy "respostas: autor da dúvida marca a melhor" on public.duvida_respostas for update
  using (
    exists (select 1 from public.duvidas d where d.id = duvida_id and d.perfil_id = auth.uid())
    or public.is_admin()
  );
create policy "respostas: autor ou admin apaga" on public.duvida_respostas for delete
  using (perfil_id = auth.uid() or public.is_admin());

create policy "votos: leitura autenticada" on public.duvida_votos for select
  using (auth.uid() is not null);
create policy "votos: próprios" on public.duvida_votos for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "ferramentas: registra o próprio uso" on public.ferramenta_usos for insert
  with check (perfil_id = auth.uid());
create policy "ferramentas: admin lê" on public.ferramenta_usos for select
  using (public.is_admin());

-- ============================================================================
--  4. MÉTRICAS DO PAINEL
-- ============================================================================
-- O painel precisa de agregação por mês, e agregar no navegador exigiria puxar
-- a base inteira. Duas funções, ambas restritas a admin.

create or replace function public.metricas_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  select jsonb_build_object(
    'perfis',            (select count(*) from public.perfis),
    'alunos',            (select count(*) from public.perfis where role = 'aluno'),
    'perfis_publicos',   (select count(*) from public.perfis where perfil_publico),
    'matriculas',        (select count(*) from public.matriculas),
    'cursos',            (select count(*) from public.cursos where publicado),
    'cursos_rascunho',   (select count(*) from public.cursos where not publicado),
    'aulas',             (select count(*) from public.aulas),
    'aulas_com_video',   (select count(*) from public.aulas where video_origem <> 'nenhum'),
    'certificados',      (select count(*) from public.certificados),
    'selos_trilha',      (select count(*) from public.certificados_trilha),
    'trilhas',           (select count(*) from public.trilhas where publicada),
    'vagas',             (select count(*) from public.vagas where ativa),
    'candidaturas',      (select count(*) from public.candidaturas),
    'posts',             (select count(*) from public.posts),
    'duvidas_ia',        (select count(*) from public.duvidas where tipo = 'ia'),
    'duvidas_forum',     (select count(*) from public.duvidas where tipo = 'forum'),
    'duvidas_sem_resposta', (
      select count(*) from public.duvidas d
      where d.tipo = 'forum' and not d.resolvida
        and not exists (select 1 from public.duvida_respostas r where r.duvida_id = d.id)),
    'tentativas',        (select count(*) from public.tentativas),
    'aprovacao_quiz',    (select coalesce(round(avg(case when aprovada then 100 else 0 end)), 0)
                            from public.tentativas),
    'planos',            (select coalesce(jsonb_object_agg(plano, n), '{}'::jsonb)
                            from (select plano::text as plano, count(*) as n
                                  from public.perfis group by plano) p),
    'ferramentas_usos',  (select count(*) from public.ferramenta_usos)
  ) into v;

  return v;
end $fn$;

-- Série por janela livre e granularidade escolhida (dia, semana ou mês).
-- Os baldes vazios são preenchidos: gráfico com dia faltando mente sobre a
-- tendência.
create or replace function public.metricas_periodo(
  p_inicio date,
  p_fim    date,
  p_gran   text default 'mes'
)
returns table (
  balde        date,
  matriculas   bigint,
  certificados bigint,
  cadastros    bigint,
  candidaturas bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_unit text;
  v_step interval;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  if p_fim < p_inicio then
    raise exception 'A data final não pode ser anterior à inicial';
  end if;

  v_unit := case p_gran when 'dia' then 'day' when 'semana' then 'week' else 'month' end;
  v_step := case p_gran when 'dia' then interval '1 day'
                        when 'semana' then interval '1 week'
                        else interval '1 month' end;

  return query
  with baldes as (
    select generate_series(
             date_trunc(v_unit, p_inicio::timestamp),
             date_trunc(v_unit, p_fim::timestamp),
             v_step
           )::date as b
  )
  select
    baldes.b,
    (select count(*) from public.matriculas x
      where date_trunc(v_unit, x.criada_em)::date = baldes.b),
    (select count(*) from public.certificados x
      where date_trunc(v_unit, x.emitido_em)::date = baldes.b),
    (select count(*) from public.perfis x
      where date_trunc(v_unit, x.criado_em)::date = baldes.b),
    (select count(*) from public.candidaturas x
      where date_trunc(v_unit, x.criada_em)::date = baldes.b)
  from baldes
  order by baldes.b;
end $fn$;

-- Conclusão real por curso: média do progresso de quem se matriculou.
create or replace function public.metricas_cursos()
returns table (
  curso_id uuid, titulo text, cor text, alunos integer,
  matriculados bigint, concluintes bigint, conclusao integer, nota numeric
)
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;

  return query
  with aulas_por_curso as (
    select m.curso_id, count(a.id)::numeric as total
    from public.modulos m join public.aulas a on a.modulo_id = m.id
    group by m.curso_id
  ),
  progresso as (
    select m.curso_id, p.perfil_id,
           count(*) filter (where p.concluida)::numeric as feitas
    from public.progresso_aulas p
    join public.aulas a   on a.id = p.aula_id
    join public.modulos m on m.id = a.modulo_id
    group by m.curso_id, p.perfil_id
  )
  select c.id, c.titulo, c.cor, c.alunos,
    (select count(*) from public.matriculas mt where mt.curso_id = c.id),
    (select count(*) from public.certificados ct where ct.curso_id = c.id),
    coalesce(round(avg(least(100, pr.feitas * 100 / nullif(apc.total, 0))))::integer, 0),
    c.nota
  from public.cursos c
  left join aulas_por_curso apc on apc.curso_id = c.id
  left join progresso pr        on pr.curso_id = c.id
  where c.publicado
  group by c.id, c.titulo, c.cor, c.alunos, c.nota, apc.total
  order by c.alunos desc;
end $fn$;

-- O seletor de ano precisa saber desde quando existe dado.
create or replace function public.metricas_ano_inicial()
returns integer
language sql stable security definer set search_path = public
as $fn$
  select coalesce(
    extract(year from least(
      (select min(criado_em) from public.perfis),
      (select min(criado_em) from public.cursos),
      (select min(criada_em) from public.matriculas)
    ))::integer,
    extract(year from now())::integer
  );
$fn$;

-- Ferramentas mais usadas no período — alimenta o painel e diz qual curso
-- tem demanda represada.
create or replace function public.metricas_ferramentas(p_dias integer default 90)
returns table (slug text, usos bigint, pessoas bigint)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  return query
  select f.slug, count(*)::bigint, count(distinct f.perfil_id)::bigint
  from public.ferramenta_usos f
  where f.criado_em >= now() - make_interval(days => p_dias)
  group by f.slug
  order by count(*) desc;
end $fn$;

-- ------------------------------------------------------------- grants ----
revoke all on function public.metricas_resumo()                   from public, anon;
revoke all on function public.metricas_periodo(date, date, text)  from public, anon;
revoke all on function public.metricas_cursos()                   from public, anon;
revoke all on function public.metricas_ano_inicial()              from public, anon;
revoke all on function public.metricas_ferramentas(integer)       from public, anon;

grant execute on function public.metricas_resumo()                  to authenticated;
grant execute on function public.metricas_periodo(date, date, text) to authenticated;
grant execute on function public.metricas_cursos()                  to authenticated;
grant execute on function public.metricas_ano_inicial()             to authenticated;
grant execute on function public.metricas_ferramentas(integer)      to authenticated;

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from information_schema.tables where table_schema='public'
     and table_name in ('duvidas','duvida_respostas','duvida_votos','ferramenta_usos')
  ) as tabelas_novas,                     -- esperado: 4
  (select count(*) from pg_proc where pronamespace='public'::regnamespace
     and proname in ('metricas_resumo','metricas_periodo','metricas_cursos',
                     'metricas_ano_inicial','metricas_ferramentas',
                     'preencher_autor_duvida')
  ) as funcoes_novas;                     -- esperado: 6
