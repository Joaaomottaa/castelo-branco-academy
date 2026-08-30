-- ============================================================================
--  CASTELO BRANCO ACADEMY — 10. CUPONS, PAGAMENTO, COMUNICAÇÃO E VAGAS
--  Rode DEPOIS do 09_duvidas_ferramentas_metricas.sql. Idempotente.
--
--   1. Ativação de conta e último acesso no perfil
--   2. Cupons de desconto com regras e limite de uso
--   3. Contratação de plano (pagamento simulado, mudança real)
--   4. Notificações, campanhas em massa e fila de e-mail
--   5. Correção da policy de candidaturas
-- ============================================================================

-- ============================================================================
--  1. PERFIL — ativação e último acesso
-- ============================================================================
alter table public.perfis
  add column if not exists ativo              boolean not null default true,
  add column if not exists ultimo_acesso      timestamptz,
  add column if not exists desativado_em      timestamptz,
  add column if not exists motivo_desativacao text;

create index if not exists perfis_ultimo_acesso_idx on public.perfis (ultimo_acesso);

-- ============================================================================
--  2. CUPONS
-- ============================================================================
create table if not exists public.cupons (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique,
  descricao         text,
  tipo              text not null default 'percentual'
                      check (tipo in ('percentual','valor')),
  valor             numeric(10,2) not null check (valor > 0),
  -- vazio = vale para todos
  planos            text[] not null default '{}',
  ciclos            text[] not null default '{}',
  limite_usos       integer,            -- null = ilimitado
  limite_por_pessoa integer not null default 1,
  usos              integer not null default 0,
  inicia_em         timestamptz not null default now(),
  expira_em         timestamptz,
  ativo             boolean not null default true,
  criado_por        uuid references public.perfis(id) on delete set null,
  criado_em         timestamptz not null default now()
);

create table if not exists public.cupom_usos (
  id             uuid primary key default gen_random_uuid(),
  cupom_id       uuid not null references public.cupons(id) on delete cascade,
  perfil_id      uuid not null references public.perfis(id) on delete cascade,
  plano          text,
  ciclo          text,
  valor_original numeric(10,2),
  valor_desconto numeric(10,2),
  valor_final    numeric(10,2),
  criado_em      timestamptz not null default now()
);

create index if not exists cupom_usos_idx on public.cupom_usos (cupom_id, criado_em desc);

-- ============================================================================
--  3. NOTIFICAÇÕES, CAMPANHAS E FILA DE E-MAIL
-- ============================================================================
create table if not exists public.campanhas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  mensagem      text not null,
  tipo          text not null default 'info'
                  check (tipo in ('info','alerta','promo','conquista')),
  link          text,
  canais        text[] not null default '{notificacao}',
  filtro        jsonb  not null default '{}'::jsonb,
  destinatarios integer not null default 0,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  campanha_id uuid references public.campanhas(id) on delete cascade,
  titulo      text not null,
  mensagem    text not null,
  tipo        text not null default 'info',
  link        text,
  lida        boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index if not exists notificacoes_perfil_idx
  on public.notificacoes (perfil_id, lida, criado_em desc);

-- Sem SMTP configurado, a mensagem entra aqui como 'pendente'. É uma fila
-- honesta: melhor do que fingir envio.
create table if not exists public.emails_admin (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid references public.perfis(id) on delete set null,
  destinatario text not null,
  assunto      text not null,
  corpo        text not null,
  status       text not null default 'pendente'
                 check (status in ('pendente','enviado','erro')),
  enviado_por  uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now()
);

-- ============================================================================
--  4. RLS
-- ============================================================================
alter table public.cupons       enable row level security;
alter table public.cupom_usos   enable row level security;
alter table public.campanhas    enable row level security;
alter table public.notificacoes enable row level security;
alter table public.emails_admin enable row level security;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('cupons','cupom_usos','campanhas','notificacoes',
                        'emails_admin','candidaturas')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- O aluno NÃO lê a tabela de cupons: a lista completa entregaria todo código
-- promocional de uma vez. A validação passa por RPC.
create policy "cupons: admin" on public.cupons for all
  using (public.is_admin()) with check (public.is_admin());

create policy "cupom_usos: admin lê tudo" on public.cupom_usos for select
  using (public.is_admin() or perfil_id = auth.uid());

create policy "campanhas: admin" on public.campanhas for all
  using (public.is_admin()) with check (public.is_admin());

create policy "notificacoes: próprias" on public.notificacoes for select
  using (perfil_id = auth.uid() or public.is_admin());
create policy "notificacoes: marca como lida" on public.notificacoes for update
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "notificacoes: autor ou admin apaga" on public.notificacoes for delete
  using (perfil_id = auth.uid() or public.is_admin());

create policy "emails: admin" on public.emails_admin for all
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- candidaturas ---
-- A policy anterior era `using (própria ou admin)` com
-- `with check (própria)`: o admin LIA a candidatura de outra pessoa e não
-- conseguia GRAVAR. O UPDATE passava no USING e era barrado no WITH CHECK,
-- sem erro visível — a linha simplesmente não mudava.
create policy "candidaturas: aluno gerencia a própria" on public.candidaturas for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "candidaturas: admin lê todas" on public.candidaturas for select
  using (public.is_admin());
create policy "candidaturas: admin move o status" on public.candidaturas for update
  using (public.is_admin()) with check (public.is_admin());
create policy "candidaturas: admin apaga" on public.candidaturas for delete
  using (public.is_admin());
create policy "candidaturas: empresa vê as das suas vagas" on public.candidaturas for select
  using (exists (
    select 1 from public.vagas v
    where v.id = vaga_id and public.is_membro_empresa(v.empresa_id)
  ));

-- ============================================================================
--  5. CUPOM — validação
-- ============================================================================
create or replace function public.validar_cupom(
  p_codigo text, p_plano text, p_ciclo text, p_valor numeric
)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  c record; v_perfil uuid := auth.uid(); v_usos_pes integer; v_desconto numeric;
begin
  if v_perfil is null then raise exception 'Não autenticado'; end if;

  select * into c from public.cupons where upper(codigo) = upper(trim(p_codigo));

  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'Cupom não encontrado.');
  end if;
  if not c.ativo then
    return jsonb_build_object('valido', false, 'motivo', 'Este cupom está desativado.');
  end if;
  if c.inicia_em > now() then
    return jsonb_build_object('valido', false, 'motivo',
      'Este cupom começa a valer em ' || to_char(c.inicia_em, 'DD/MM/YYYY') || '.');
  end if;
  if c.expira_em is not null and c.expira_em < now() then
    return jsonb_build_object('valido', false, 'motivo', 'Este cupom expirou.');
  end if;
  if c.limite_usos is not null and c.usos >= c.limite_usos then
    return jsonb_build_object('valido', false, 'motivo', 'Este cupom esgotou o limite de usos.');
  end if;
  if array_length(c.planos, 1) is not null and not (p_plano = any(c.planos)) then
    return jsonb_build_object('valido', false, 'motivo',
      'Este cupom não vale para o plano ' || p_plano || '.');
  end if;
  if array_length(c.ciclos, 1) is not null and not (p_ciclo = any(c.ciclos)) then
    return jsonb_build_object('valido', false, 'motivo',
      'Este cupom vale só na cobrança ' || array_to_string(c.ciclos, ' ou ') || '.');
  end if;

  select count(*)::integer into v_usos_pes
  from public.cupom_usos u where u.cupom_id = c.id and u.perfil_id = v_perfil;

  if v_usos_pes >= c.limite_por_pessoa then
    return jsonb_build_object('valido', false, 'motivo', 'Você já usou este cupom.');
  end if;

  v_desconto := case c.tipo
                  when 'percentual' then round(p_valor * c.valor / 100, 2)
                  else least(c.valor, p_valor)
                end;

  return jsonb_build_object(
    'valido', true, 'cupom_id', c.id, 'codigo', upper(c.codigo),
    'descricao', c.descricao, 'tipo', c.tipo, 'valor', c.valor,
    'desconto', v_desconto, 'final', greatest(0, p_valor - v_desconto));
end $fn$;

-- ============================================================================
--  6. CONTRATAÇÃO
--  Pagamento simulado, mudança real: assinatura, pagamento, uso do cupom e o
--  plano no perfil, tudo numa transação. Quando o gateway entrar, quem chama
--  passa a ser o webhook em vez do navegador — e nada mais muda.
-- ============================================================================
create or replace function public.contratar_plano(
  p_plano text, p_ciclo text, p_metodo text, p_valor numeric, p_cupom text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_perfil uuid := auth.uid();
  v_cupom jsonb; v_cupom_id uuid; v_desconto numeric := 0;
  v_final numeric; v_assin uuid; v_expira timestamptz;
begin
  if v_perfil is null then raise exception 'Não autenticado'; end if;
  if p_plano not in ('Pro', 'Enterprise') then
    raise exception 'Plano inválido para contratação: %', p_plano;
  end if;
  if p_metodo not in ('cartao-credito','cartao-debito','pix','boleto') then
    raise exception 'Forma de pagamento inválida: %', p_metodo;
  end if;

  if p_cupom is not null and length(trim(p_cupom)) > 0 then
    v_cupom := public.validar_cupom(p_cupom, p_plano, p_ciclo, p_valor);
    if not (v_cupom ->> 'valido')::boolean then
      raise exception '%', v_cupom ->> 'motivo';
    end if;
    v_cupom_id := (v_cupom ->> 'cupom_id')::uuid;
    v_desconto := (v_cupom ->> 'desconto')::numeric;
  end if;

  v_final  := greatest(0, p_valor - v_desconto);
  v_expira := now() + case when p_ciclo = 'anual' then interval '1 year' else interval '1 month' end;

  insert into public.assinaturas (perfil_id, plano, status, inicia_em, expira_em)
  values (v_perfil, p_plano::public.plano_tipo, 'ativa', now(), v_expira)
  returning id into v_assin;

  insert into public.pagamentos
    (assinatura_id, perfil_id, valor_centavos, metodo, status, gateway_ref)
  values (v_assin, v_perfil, round(v_final * 100)::integer, p_metodo, 'aprovado',
          'simulado-' || gen_random_uuid()::text);

  if v_cupom_id is not null then
    insert into public.cupom_usos
      (cupom_id, perfil_id, plano, ciclo, valor_original, valor_desconto, valor_final)
    values (v_cupom_id, v_perfil, p_plano, p_ciclo, p_valor, v_desconto, v_final);
    update public.cupons set usos = usos + 1 where id = v_cupom_id;
  end if;

  update public.perfis
     set plano = p_plano::public.plano_tipo, ultimo_acesso = now()
   where id = v_perfil;

  insert into public.notificacoes (perfil_id, titulo, mensagem, tipo, link)
  values (v_perfil, 'Plano ' || p_plano || ' ativado',
          'Sua assinatura está ativa até ' || to_char(v_expira, 'DD/MM/YYYY') || '. Bons estudos!',
          'conquista', '/app/planos');

  return jsonb_build_object(
    'ok', true, 'assinatura_id', v_assin, 'plano', p_plano, 'ciclo', p_ciclo,
    'metodo', p_metodo, 'valor_original', p_valor, 'desconto', v_desconto,
    'valor_pago', v_final, 'expira_em', v_expira);
end $fn$;

create or replace function public.cancelar_plano()
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare v_perfil uuid := auth.uid();
begin
  if v_perfil is null then raise exception 'Não autenticado'; end if;
  update public.assinaturas set status = 'cancelada'
   where perfil_id = v_perfil and status = 'ativa';
  update public.perfis set plano = 'Free' where id = v_perfil;
  return jsonb_build_object('ok', true, 'plano', 'Free');
end $fn$;

-- ============================================================================
--  7. CAMPANHAS
--  Uma função só monta o filtro, usada pela prévia E pelo disparo. Duas
--  implementações do mesmo filtro divergiriam algum dia.
-- ============================================================================
create or replace function public.publico_da_campanha(p_filtro jsonb)
returns table (id uuid, nome text, email text, plano text, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_papel      text    := nullif(p_filtro ->> 'papel', '');
  v_planos     text[]  := case when p_filtro ? 'planos'
                           then array(select jsonb_array_elements_text(p_filtro -> 'planos'))
                           else null end;
  v_inativo    integer := nullif(p_filtro ->> 'inativoDias', '')::integer;
  v_ativo_ate  integer := nullif(p_filtro ->> 'ativoUltimosDias', '')::integer;
  v_uf         text    := nullif(p_filtro ->> 'uf', '');
  v_sem_cert   boolean := coalesce((p_filtro ->> 'semCertificado')::boolean, false);
  v_sem_matric boolean := coalesce((p_filtro ->> 'semMatricula')::boolean, false);
  v_com_trilha boolean := coalesce((p_filtro ->> 'comTrilha')::boolean, false);
  v_so_ativos  boolean := coalesce((p_filtro ->> 'somenteAtivos')::boolean, true);
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;

  return query
  select p.id, p.nome, p.email, p.plano::text, p.ultimo_acesso
  from public.perfis p
  where (not v_so_ativos or p.ativo)
    and (v_papel is null or p.role::text = v_papel)
    and (v_planos is null or array_length(v_planos, 1) is null or p.plano::text = any(v_planos))
    and (v_uf is null or p.uf = v_uf)
    -- "sem acessar há mais de N dias" inclui quem nunca acessou
    and (v_inativo is null or p.ultimo_acesso is null
         or p.ultimo_acesso < now() - make_interval(days => v_inativo))
    and (v_ativo_ate is null
         or (p.ultimo_acesso is not null
             and p.ultimo_acesso >= now() - make_interval(days => v_ativo_ate)))
    and (not v_sem_cert
         or not exists (select 1 from public.certificados c where c.perfil_id = p.id))
    and (not v_sem_matric
         or not exists (select 1 from public.matriculas m where m.perfil_id = p.id))
    and (not v_com_trilha
         or exists (select 1 from public.certificados_trilha t where t.perfil_id = p.id))
  order by p.nome;
end $fn$;

create or replace function public.disparar_campanha(
  p_titulo text, p_mensagem text, p_tipo text, p_link text,
  p_filtro jsonb, p_canais text[] default array['notificacao']
)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare v_campanha uuid; v_total integer;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if coalesce(trim(p_titulo), '') = '' or coalesce(trim(p_mensagem), '') = '' then
    raise exception 'Título e mensagem são obrigatórios';
  end if;

  insert into public.campanhas (titulo, mensagem, tipo, link, canais, filtro, criado_por)
  values (p_titulo, p_mensagem, coalesce(p_tipo, 'info'), nullif(p_link, ''),
          p_canais, p_filtro, auth.uid())
  returning id into v_campanha;

  if 'notificacao' = any(p_canais) then
    insert into public.notificacoes (perfil_id, campanha_id, titulo, mensagem, tipo, link)
    select d.id, v_campanha, p_titulo, p_mensagem, coalesce(p_tipo, 'info'), nullif(p_link, '')
    from public.publico_da_campanha(p_filtro) d;
  end if;

  if 'email' = any(p_canais) then
    insert into public.emails_admin (perfil_id, destinatario, assunto, corpo, enviado_por)
    select d.id, d.email, p_titulo, p_mensagem, auth.uid()
    from public.publico_da_campanha(p_filtro) d;
  end if;

  select count(*)::integer into v_total from public.publico_da_campanha(p_filtro);
  update public.campanhas set destinatarios = v_total where id = v_campanha;

  return jsonb_build_object('ok', true, 'campanha_id', v_campanha, 'destinatarios', v_total);
end $fn$;

-- ============================================================================
--  8. ADMINISTRAÇÃO DE PESSOAS
-- ============================================================================
create or replace function public.definir_status_perfil(
  p_perfil uuid, p_ativo boolean, p_motivo text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if p_perfil = auth.uid() then
    raise exception 'Você não pode desativar a própria conta';
  end if;

  update public.perfis
     set ativo = p_ativo,
         desativado_em = case when p_ativo then null else now() end,
         motivo_desativacao = case when p_ativo then null else p_motivo end,
         -- conta desativada sai do banco de talentos na hora
         perfil_publico = case when p_ativo then perfil_publico else false end
   where id = p_perfil;

  return jsonb_build_object('ok', true, 'ativo', p_ativo);
end $fn$;

create or replace function public.enfileirar_email(
  p_perfil uuid, p_assunto text, p_corpo text
)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;

  select email into v_email from public.perfis where id = p_perfil;
  if v_email is null then raise exception 'Perfil não encontrado'; end if;

  insert into public.emails_admin (perfil_id, destinatario, assunto, corpo, enviado_por)
  values (p_perfil, v_email, p_assunto, p_corpo, auth.uid());

  -- Também vira notificação: sem SMTP, é o único canal que chega mesmo.
  insert into public.notificacoes (perfil_id, titulo, mensagem, tipo)
  values (p_perfil, p_assunto, p_corpo, 'info');

  return jsonb_build_object('ok', true, 'destinatario', v_email);
end $fn$;

-- ============================================================================
--  9. CANDIDATOS DE UMA VAGA
--  Devolve o que o cálculo de match precisa. O ranking é feito no cliente pela
--  MESMA `calcularMatch` que o aluno vê — duas implementações do score
--  divergiriam na primeira mudança de peso.
-- ============================================================================
create or replace function public.candidatos_da_vaga(p_vaga uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;

  select coalesce(jsonb_agg(x order by x ->> 'nome'), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'candidatura_id', c.id, 'status', c.status, 'criada_em', c.criada_em,
      'mensagem', c.mensagem,
      'perfil', jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'email', p.email, 'cargo', p.cargo,
        'cidade', p.cidade, 'uf', p.uf, 'senioridade', p.senioridade,
        'bio', p.bio, 'pretensao', p.pretensao, 'disponivel', p.disponivel,
        'plano', p.plano, 'nivel', p.nivel, 'pontos', p.pontos,
        'habilidades', coalesce((
          select jsonb_agg(h.nome order by ph.nivel desc)
          from public.perfil_habilidades ph
          join public.habilidades h on h.id = ph.habilidade_id
          where ph.perfil_id = p.id), '[]'::jsonb)),
      'certificados', coalesce((
        select jsonb_agg(jsonb_build_object('cursoSlug', cu.slug, 'cursoTitulo', cu.titulo))
        from public.certificados ce join public.cursos cu on cu.id = ce.curso_id
        where ce.perfil_id = p.id), '[]'::jsonb),
      'trilhas', coalesce((
        select jsonb_agg(jsonb_build_object('trilhaSlug', t.slug, 'trilhaNome', t.nome))
        from public.certificados_trilha ct join public.trilhas t on t.id = ct.trilha_id
        where ct.perfil_id = p.id), '[]'::jsonb),
      'nome', p.nome) as x
    from public.candidaturas c
    join public.perfis p on p.id = c.perfil_id
    where c.vaga_id = p_vaga
  ) s;

  return v;
end $fn$;

-- ------------------------------------------------------------- grants ----
revoke all on function public.validar_cupom(text, text, text, numeric)              from public, anon;
revoke all on function public.contratar_plano(text, text, text, numeric, text)      from public, anon;
revoke all on function public.cancelar_plano()                                      from public, anon;
revoke all on function public.publico_da_campanha(jsonb)                            from public, anon;
revoke all on function public.disparar_campanha(text, text, text, text, jsonb, text[]) from public, anon;
revoke all on function public.definir_status_perfil(uuid, boolean, text)            from public, anon;
revoke all on function public.enfileirar_email(uuid, text, text)                    from public, anon;
revoke all on function public.candidatos_da_vaga(uuid)                              from public, anon;

grant execute on function public.validar_cupom(text, text, text, numeric)              to authenticated;
grant execute on function public.contratar_plano(text, text, text, numeric, text)      to authenticated;
grant execute on function public.cancelar_plano()                                      to authenticated;
grant execute on function public.publico_da_campanha(jsonb)                            to authenticated;
grant execute on function public.disparar_campanha(text, text, text, text, jsonb, text[]) to authenticated;
grant execute on function public.definir_status_perfil(uuid, boolean, text)            to authenticated;
grant execute on function public.enfileirar_email(uuid, text, text)                    to authenticated;
grant execute on function public.candidatos_da_vaga(uuid)                              to authenticated;

-- ============================================================================
--  10. SEMENTES
-- ============================================================================
-- Alimenta o filtro "sem acessar há mais de N dias" para quem já existia.
update public.perfis p
   set ultimo_acesso = coalesce(
     (select max(atualizado_em) from public.progresso_aulas x where x.perfil_id = p.id),
     p.criado_em)
 where ultimo_acesso is null;

insert into public.cupons
  (codigo, descricao, tipo, valor, planos, ciclos, limite_usos, limite_por_pessoa, expira_em)
values
  ('CASTELO50', 'Metade do preço no primeiro mês do Pro', 'percentual', 50,
   '{Pro}', '{mensal}', 100, 1, now() + interval '90 days'),
  ('ANUAL30',   '30% no plano anual', 'percentual', 30,
   '{Pro}', '{anual}', 50, 1, now() + interval '60 days'),
  ('CBA20',     'R$ 20 de desconto em qualquer plano', 'valor', 20,
   '{}', '{}', 10, 1, null)
on conflict (codigo) do nothing;

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from information_schema.tables where table_schema='public'
     and table_name in ('cupons','cupom_usos','campanhas','notificacoes','emails_admin')
  ) as tabelas_novas,                   -- esperado: 5
  (select count(*) from pg_proc where pronamespace='public'::regnamespace
     and proname in ('validar_cupom','contratar_plano','cancelar_plano',
                     'publico_da_campanha','disparar_campanha',
                     'definir_status_perfil','enfileirar_email','candidatos_da_vaga')
  ) as funcoes_novas,                   -- esperado: 8
  (select count(*) from public.cupons) as cupons_semeados;  -- esperado: 3
