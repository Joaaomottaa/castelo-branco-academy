-- ============================================================================
--  18 — A ÁREA DA EMPRESA
--
--  Roda depois de 17_endereco_materiais_duvida_da_questao.sql. É idempotente.
--
--  Até aqui "empresa" era um papel sem lugar: o cadastro aceitava, o login
--  entrava, e a pessoa caía no painel do aluno com a meta de PEPC escondida.
--  As tabelas `empresas`, `empresa_membros` e `vagas.empresa_id` já existiam
--  desde o 01_schema.sql — o que faltava era o que uma empresa faz.
--
--  O que ela faz, no contexto de um escritório contábil:
--
--  1. COMPRA LICENÇAS e distribui para a equipe. O colaborador entra pelo
--     código, já vinculado, e o plano Pro vem junto enquanto ele estiver no
--     time. É a diferença entre vender 1 assinatura e vender 12.
--
--  2. MANDA ESTUDAR. Trilha ou curso com prazo, atribuído ao time inteiro ou
--     a uma pessoa. Sem isso o gestor compra acesso e torce.
--
--  3. PRESTA CONTAS AO CRC. A Resolução CFC 1.377/2011 exige pontuação anual
--     de educação continuada de quem atua em auditoria e perícia, e o
--     escritório é quem responde pelo time. O relatório por ano, com código
--     de validação por certificado, é o motivo pelo qual essa conta vale mais
--     do que doze contas soltas.
--
--  4. CONTRATA. As vagas já existiam no banco com RLS para membros da
--     empresa; agora existe tela.
--
--  DECISÕES QUE VALE REGISTRAR
--
--  · A licença é do vínculo, não da pessoa. Sair do time devolve o plano
--    anterior (guardado em `plano_anterior`) — não deixa um Pro órfão de
--    graça nem rebaixa quem já era Pro por conta própria.
--
--  · O convite tem duas naturezas: `licenca` consome assento e dá Pro;
--    `desconto` não consome assento e dá um percentual no checkout. Serve
--    para o escritório que quer beneficiar mais gente do que contratou.
--
--  · A atribuição para o time inteiro grava `perfil_id = null` e é expandida
--    na leitura. Quem entrar amanhã já entra com a formação pendente — o
--    contrário (fan-out na criação) esqueceria os novos.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. EMPRESA — o cadastro que faltava
-- ---------------------------------------------------------------------------
alter table public.empresas
  add column if not exists descricao            text,
  add column if not exists segmento             text,
  add column if not exists telefone             text,
  add column if not exists cep                  text,
  add column if not exists logradouro           text,
  add column if not exists bairro               text,
  add column if not exists numero               text,
  add column if not exists complemento          text,
  -- Quantos assentos o comercial vendeu. Só o admin muda.
  add column if not exists licencas_contratadas integer not null default 0,
  -- Sugestão de desconto ao criar convite do tipo `desconto`.
  add column if not exists desconto_padrao      integer not null default 30,
  add column if not exists ativa                boolean not null default true;

comment on column public.empresas.licencas_contratadas is
  'Assentos do contrato. Definido pelo admin da Academy, nunca pela própria empresa.';

alter table public.empresa_membros
  add column if not exists cargo          text,
  add column if not exists status         text not null default 'ativo',
  -- Ocupa um assento do contrato e recebe Pro enquanto durar.
  add column if not exists licenca        boolean not null default false,
  add column if not exists desconto_pct   integer not null default 0,
  add column if not exists entrou_em      timestamptz not null default now(),
  add column if not exists convite_id     uuid,
  -- Para devolver o plano certo quando a licença sai.
  add column if not exists plano_anterior text;

create index if not exists idx_empresa_membros_empresa on public.empresa_membros (empresa_id, status);


-- ---------------------------------------------------------------------------
-- 2. CONVITES / LICENÇAS
-- ---------------------------------------------------------------------------
create table if not exists public.empresa_convites (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  -- Vai na URL: /convite/CB-4K7P-92XD. Curto o bastante para ditar no telefone.
  codigo       text not null unique,
  email        text,
  nome         text,
  cargo        text,
  papel        text not null default 'membro',
  tipo         text not null default 'licenca',
  desconto_pct integer not null default 0,
  status       text not null default 'pendente',
  criado_por   uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default now() + interval '30 days',
  aceito_em    timestamptz,
  aceito_por   uuid references public.perfis(id) on delete set null,
  constraint convite_papel  check (papel in ('membro', 'gestor')),
  constraint convite_tipo   check (tipo in ('licenca', 'desconto')),
  constraint convite_status check (status in ('pendente', 'aceito', 'cancelado'))
);

create index if not exists idx_convites_empresa on public.empresa_convites (empresa_id, status);

alter table public.empresa_convites enable row level security;


-- ---------------------------------------------------------------------------
-- 3. FORMAÇÕES ATRIBUÍDAS
-- ---------------------------------------------------------------------------
create table if not exists public.empresa_atribuicoes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  curso_id    uuid references public.cursos(id) on delete cascade,
  trilha_id   uuid references public.trilhas(id) on delete cascade,
  -- Nulo = todo o time, inclusive quem entrar depois.
  perfil_id   uuid references public.perfis(id) on delete cascade,
  prazo       date,
  obrigatoria boolean not null default true,
  observacao  text,
  criado_por  uuid references public.perfis(id) on delete set null,
  criado_em   timestamptz not null default now(),
  constraint atribuicao_tem_alvo check (curso_id is not null or trilha_id is not null)
);

create index if not exists idx_atribuicoes_empresa on public.empresa_atribuicoes (empresa_id);

alter table public.empresa_atribuicoes enable row level security;


-- ---------------------------------------------------------------------------
-- 4. QUEM É QUEM
-- ---------------------------------------------------------------------------

-- `is_membro_empresa` já existia, mas contava vínculo desligado como ativo.
create or replace function public.is_membro_empresa(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.empresa_membros
    where empresa_id = p_empresa and perfil_id = auth.uid() and status = 'ativo'
  );
$fn$;

-- Gestor é quem convida, atribui formação e vê o relatório do time.
-- `admin` aqui é o papel dentro da empresa (o dono da conta), não o admin da
-- Academy — daí os dois valores.
create or replace function public.is_gestor_empresa(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.empresa_membros
    where empresa_id = p_empresa
      and perfil_id = auth.uid()
      and status = 'ativo'
      and papel in ('gestor', 'admin')
  );
$fn$;

/** A empresa da sessão. Uma pessoa pertence a uma empresa de cada vez. */
create or replace function public.minha_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select empresa_id from public.empresa_membros
  where perfil_id = auth.uid() and status = 'ativo'
  order by entrou_em limit 1;
$fn$;

revoke all on function public.minha_empresa_id() from public;
revoke execute on function public.minha_empresa_id() from anon;
grant execute on function public.minha_empresa_id() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

-- A empresa edita o próprio cadastro; os assentos contratados continuam
-- fechados para ela (ver o gatilho mais abaixo).
drop policy if exists "empresas: gestor edita a própria" on public.empresas;
create policy "empresas: gestor edita a própria" on public.empresas
  for update using (public.is_gestor_empresa(id)) with check (public.is_gestor_empresa(id));

drop policy if exists "convites: time e admin leem" on public.empresa_convites;
create policy "convites: time e admin leem" on public.empresa_convites
  for select using (public.is_gestor_empresa(empresa_id) or public.is_admin());

drop policy if exists "convites: gestor administra" on public.empresa_convites;
create policy "convites: gestor administra" on public.empresa_convites
  for all using (public.is_gestor_empresa(empresa_id) or public.is_admin())
  with check (public.is_gestor_empresa(empresa_id) or public.is_admin());

-- O time inteiro lê as atribuições: é assim que o colaborador vê o que a
-- empresa espera dele. Só o gestor escreve.
drop policy if exists "atribuições: time lê" on public.empresa_atribuicoes;
create policy "atribuições: time lê" on public.empresa_atribuicoes
  for select using (public.is_membro_empresa(empresa_id) or public.is_admin());

drop policy if exists "atribuições: gestor administra" on public.empresa_atribuicoes;
create policy "atribuições: gestor administra" on public.empresa_atribuicoes
  for all using (public.is_gestor_empresa(empresa_id) or public.is_admin())
  with check (public.is_gestor_empresa(empresa_id) or public.is_admin());

-- Gestor tira gente do time; o próprio membro pode sair.
drop policy if exists "membros: gestor administra" on public.empresa_membros;
create policy "membros: gestor administra" on public.empresa_membros
  for all using (public.is_gestor_empresa(empresa_id) or public.is_admin())
  with check (public.is_gestor_empresa(empresa_id) or public.is_admin());


-- A empresa não pode se dar assentos. `licencas_contratadas` é cláusula de
-- contrato, e contrato quem muda é o comercial — no painel do admin.
create or replace function public.empresas_trava_licencas()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.licencas_contratadas is distinct from old.licencas_contratadas
     and not public.is_admin() then
    raise exception 'Assentos contratados só mudam pelo painel da Academy.';
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_empresas_trava_licencas on public.empresas;
create trigger trg_empresas_trava_licencas
  before update on public.empresas
  for each row execute function public.empresas_trava_licencas();


-- ---------------------------------------------------------------------------
-- 6. PROGRESSO VISÍVEL AO GESTOR
--
--    O RLS de `progresso_aulas` só devolve a linha do próprio dono — e está
--    certo. Mas um gestor precisa saber quem parou na terceira aula. A
--    permissão volta aqui dentro, explícita e checada contra `empresa_membros`.
-- ---------------------------------------------------------------------------
create or replace function public.pode_ver_progresso(p_perfil uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_perfil = auth.uid()
      or public.is_admin()
      or exists (
        select 1
        from public.empresa_membros alvo
        join public.empresa_membros eu on eu.empresa_id = alvo.empresa_id
        where alvo.perfil_id = p_perfil
          and alvo.status = 'ativo'
          and eu.perfil_id = auth.uid()
          and eu.status = 'ativo'
          and eu.papel in ('gestor', 'admin')
      );
$fn$;

create or replace function public.pct_curso(p_perfil uuid, p_curso uuid)
returns integer language plpgsql stable security definer set search_path = public as $fn$
declare v_total int; v_feitas int;
begin
  if not public.pode_ver_progresso(p_perfil) then return 0; end if;
  select count(a.id), count(*) filter (where pa.concluida)
    into v_total, v_feitas
  from public.aulas a
  join public.modulos m on m.id = a.modulo_id
  left join public.progresso_aulas pa on pa.aula_id = a.id and pa.perfil_id = p_perfil
  where m.curso_id = p_curso;
  if coalesce(v_total, 0) = 0 then return 0; end if;
  return round(100.0 * coalesce(v_feitas, 0) / v_total)::int;
end
$fn$;

-- Trilha: média do progresso dos cursos obrigatórios que a compõem.
create or replace function public.pct_trilha(p_perfil uuid, p_trilha uuid)
returns integer language plpgsql stable security definer set search_path = public as $fn$
declare v int;
begin
  if not public.pode_ver_progresso(p_perfil) then return 0; end if;
  select round(avg(public.pct_curso(p_perfil, tc.curso_id)))::int into v
  from public.trilha_cursos tc
  where tc.trilha_id = p_trilha and coalesce(tc.obrigatorio, true);
  return coalesce(v, 0);
end
$fn$;



-- ---------------------------------------------------------------------------
-- 7. LEITURA — o que cada tela consome
-- ---------------------------------------------------------------------------

-- A empresa da sessão, com a contagem de assentos.
create or replace function public.empresa_do_usuario()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_papel text;
  v_usadas int;
  v_pendentes int;
  v_membros int;
  e public.empresas%rowtype;
begin
  if v_id is null then return null; end if;

  select * into e from public.empresas where id = v_id;
  select papel into v_papel from public.empresa_membros
   where empresa_id = v_id and perfil_id = auth.uid() and status = 'ativo';

  select count(*) filter (where licenca), count(*)
    into v_usadas, v_membros
  from public.empresa_membros where empresa_id = v_id and status = 'ativo';

  select count(*) into v_pendentes
  from public.empresa_convites
  where empresa_id = v_id and status = 'pendente' and expira_em > now();

  return jsonb_build_object(
    'id', e.id, 'nome', e.nome, 'cnpj', e.cnpj, 'logoUrl', e.logo_url,
    'cor', e.cor, 'site', e.site, 'telefone', e.telefone,
    'descricao', e.descricao, 'segmento', e.segmento,
    'cidade', e.cidade, 'uf', e.uf, 'cep', e.cep, 'logradouro', e.logradouro,
    'bairro', e.bairro, 'numero', e.numero, 'complemento', e.complemento,
    'descontoPadrao', e.desconto_padrao,
    'papel', v_papel,
    'gestor', v_papel in ('gestor', 'admin'),
    'licencas', jsonb_build_object(
      'contratadas', e.licencas_contratadas,
      'usadas', v_usadas,
      'livres', greatest(e.licencas_contratadas - v_usadas, 0)
    ),
    'membros', v_membros,
    'convitesPendentes', v_pendentes
  );
end
$fn$;

-- O time, com o que um gestor precisa saber antes de cobrar alguém.
-- Horas e pontos PEPC são do ano corrente: é o ciclo do CFC, e é o número que
-- o escritório precisa fechar em dezembro.
create or replace function public.empresa_equipe()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_ano int := extract(year from (now() at time zone 'America/Bahia'))::int;
  v_hoje date := (now() at time zone 'America/Bahia')::date;
  v_res jsonb;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'perfilId', p.id, 'nome', p.nome, 'email', p.email, 'avatar', p.avatar_url,
    'cargo', coalesce(m.cargo, p.cargo), 'papel', m.papel, 'status', m.status,
    'licenca', m.licenca, 'descontoPct', m.desconto_pct, 'plano', p.plano,
    'entrouEm', m.entrou_em, 'ultimoAcesso', p.ultimo_acesso,
    'ultimoEstudo', p.ultimo_estudo, 'ofensiva', p.ofensiva,
    'pontos', p.pontos, 'nivel', p.nivel,
    'horasAno', round(coalesce(ed.minutos, 0) / 60.0, 1),
    'certificados', coalesce(ce.qtd, 0),
    'pontosPepcAno', coalesce(ce.pepc, 0) + coalesce(ct.pepc, 0),
    'trilhas', coalesce(ct.qtd, 0),
    'formacoesPendentes', coalesce(f.pendentes, 0),
    'formacoesAtrasadas', coalesce(f.atrasadas, 0)
  ) order by (m.papel in ('gestor','admin')) desc, p.nome), '[]'::jsonb)
  into v_res
  from public.empresa_membros m
  join public.perfis p on p.id = m.perfil_id
  left join lateral (
    select sum(minutos) as minutos from public.estudo_diario
    where perfil_id = p.id and extract(year from dia) = v_ano
  ) ed on true
  left join lateral (
    select count(*) as qtd, sum(pontos_pepc) as pepc from public.certificados
    where perfil_id = p.id and extract(year from emitido_em) = v_ano
  ) ce on true
  left join lateral (
    select count(*) as qtd, sum(pontos_pepc) as pepc from public.certificados_trilha
    where perfil_id = p.id and extract(year from emitido_em) = v_ano
  ) ct on true
  left join lateral (
    select
      count(*) filter (where not concluido) as pendentes,
      count(*) filter (where not concluido and prazo is not null and prazo < v_hoje) as atrasadas
    from (
      select a.prazo,
             (case when a.curso_id is not null
                   then public.pct_curso(p.id, a.curso_id) >= 100
                        or exists (select 1 from public.certificados ce2
                                    where ce2.perfil_id = p.id and ce2.curso_id = a.curso_id)
                   else public.pct_trilha(p.id, a.trilha_id) >= 100
                        or exists (select 1 from public.certificados_trilha ct2
                                    where ct2.perfil_id = p.id and ct2.trilha_id = a.trilha_id)
              end) as concluido
      from public.empresa_atribuicoes a
      where a.empresa_id = v_id and (a.perfil_id is null or a.perfil_id = p.id)
    ) z
  ) f on true
  where m.empresa_id = v_id and m.status = 'ativo';

  return v_res;
end
$fn$;

-- Os números do topo do painel.
create or replace function public.empresa_resumo()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_ano int := extract(year from (now() at time zone 'America/Bahia'))::int;
  v_hoje date := (now() at time zone 'America/Bahia')::date;
  v jsonb;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then return null; end if;

  select jsonb_build_object(
    'membros', count(*),
    'ativos7d', count(*) filter (where p.ultimo_estudo >= v_hoje - 7),
    'inativos30d', count(*) filter (where p.ultimo_estudo is null or p.ultimo_estudo < v_hoje - 30),
    'horasAno', round(coalesce(sum(ed.minutos), 0) / 60.0, 1),
    'certificadosAno', coalesce(sum(ce.qtd), 0),
    'pontosPepcAno', coalesce(sum(ce.pepc), 0) + coalesce(sum(ct.pepc), 0),
    'metaPepc', count(*) * 40,
    'emDia', count(*) filter (where coalesce(ce.pepc, 0) + coalesce(ct.pepc, 0) >= 40)
  ) into v
  from public.empresa_membros m
  join public.perfis p on p.id = m.perfil_id
  left join lateral (
    select sum(minutos) as minutos from public.estudo_diario
    where perfil_id = p.id and extract(year from dia) = v_ano
  ) ed on true
  left join lateral (
    select count(*) as qtd, sum(pontos_pepc) as pepc from public.certificados
    where perfil_id = p.id and extract(year from emitido_em) = v_ano
  ) ce on true
  left join lateral (
    select sum(pontos_pepc) as pepc from public.certificados_trilha
    where perfil_id = p.id and extract(year from emitido_em) = v_ano
  ) ct on true
  where m.empresa_id = v_id and m.status = 'ativo';

  return v || jsonb_build_object('ano', v_ano);
end
$fn$;

-- As formações atribuídas, com o progresso de cada pessoa.
-- A atribuição "para o time" mora com perfil_id nulo e é expandida aqui: quem
-- for contratado amanhã já aparece com a formação pendente.
create or replace function public.empresa_formacoes()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_res jsonb;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by x->>'prazo' nulls last, x->>'titulo'), '[]'::jsonb)
    into v_res
  from (
    select jsonb_build_object(
      'id', a.id,
      'tipo', case when a.curso_id is not null then 'curso' else 'trilha' end,
      'alvoId', coalesce(a.curso_id, a.trilha_id),
      'titulo', coalesce(c.titulo, t.nome),
      'slug', coalesce(c.slug, t.slug),
      'cor', coalesce(c.cor, t.cor),
      -- A trilha não guarda carga horária própria: ela é a soma dos cursos.
      'cargaHoraria', coalesce(
        c.carga_horaria,
        (select sum(cc.carga_horaria)::int
           from public.trilha_cursos tc
           join public.cursos cc on cc.id = tc.curso_id
          where tc.trilha_id = a.trilha_id),
        0
      ),
      'prazo', a.prazo,
      'obrigatoria', a.obrigatoria,
      'observacao', a.observacao,
      'criadoEm', a.criado_em,
      'paraTime', a.perfil_id is null,
      'pessoas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'perfilId', p.id,
          'nome', p.nome,
          'cargo', m.cargo,
          'pct', pct.v,
          'concluido', pct.v >= 100 or ok.feito,
          'atrasado', a.prazo is not null
                      and a.prazo < (now() at time zone 'America/Bahia')::date
                      and not (pct.v >= 100 or ok.feito)
        ) order by p.nome), '[]'::jsonb)
        from public.empresa_membros m
        join public.perfis p on p.id = m.perfil_id
        cross join lateral (
          select case when a.curso_id is not null
                      then public.pct_curso(p.id, a.curso_id)
                      else public.pct_trilha(p.id, a.trilha_id) end as v
        ) pct
        cross join lateral (
          select case when a.curso_id is not null
                      then exists (select 1 from public.certificados ce
                                    where ce.perfil_id = p.id and ce.curso_id = a.curso_id)
                      else exists (select 1 from public.certificados_trilha ct
                                    where ct.perfil_id = p.id and ct.trilha_id = a.trilha_id)
                 end as feito
        ) ok
        where m.empresa_id = v_id
          and m.status = 'ativo'
          and (a.perfil_id is null or a.perfil_id = p.id)
      )
    ) as x
    from public.empresa_atribuicoes a
    left join public.cursos c on c.id = a.curso_id
    left join public.trilhas t on t.id = a.trilha_id
    where a.empresa_id = v_id
  ) s;

  return v_res;
end
$fn$;

-- A mesma coisa vista de baixo: o que a minha empresa espera de mim.
create or replace function public.minhas_formacoes()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_res jsonb;
  v_hoje date := (now() at time zone 'America/Bahia')::date;
begin
  if v_id is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by (x->>'concluido')::boolean, x->>'prazo' nulls last), '[]'::jsonb)
    into v_res
  from (
    select jsonb_build_object(
      'id', a.id,
      'tipo', case when a.curso_id is not null then 'curso' else 'trilha' end,
      'titulo', coalesce(c.titulo, t.nome),
      'slug', coalesce(c.slug, t.slug),
      'cor', coalesce(c.cor, t.cor),
      'prazo', a.prazo,
      'obrigatoria', a.obrigatoria,
      'observacao', a.observacao,
      'pct', pct.v,
      'concluido', pct.v >= 100 or ok.feito,
      'diasRestantes', case when a.prazo is null then null else a.prazo - v_hoje end
    ) as x
    from public.empresa_atribuicoes a
    left join public.cursos c on c.id = a.curso_id
    left join public.trilhas t on t.id = a.trilha_id
    cross join lateral (
      select case when a.curso_id is not null
                  then public.pct_curso(auth.uid(), a.curso_id)
                  else public.pct_trilha(auth.uid(), a.trilha_id) end as v
    ) pct
    cross join lateral (
      select case when a.curso_id is not null
                  then exists (select 1 from public.certificados ce
                                where ce.perfil_id = auth.uid() and ce.curso_id = a.curso_id)
                  else exists (select 1 from public.certificados_trilha ct
                                where ct.perfil_id = auth.uid() and ct.trilha_id = a.trilha_id)
             end as feito
    ) ok
    where a.empresa_id = v_id
      and (a.perfil_id is null or a.perfil_id = auth.uid())
  ) s;

  return v_res;
end
$fn$;

-- Relatório de educação continuada do time, por ano.
-- Cada linha traz o código público do certificado: é o que permite ao CRC (ou
-- ao cliente, numa due diligence) conferir sem depender da nossa palavra.
create or replace function public.empresa_relatorio_pepc(p_ano int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_ano int := coalesce(p_ano, extract(year from (now() at time zone 'America/Bahia'))::int);
  v_nome text;
  v_res jsonb;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then return null; end if;
  select nome into v_nome from public.empresas where id = v_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'perfilId', p.id, 'nome', p.nome, 'email', p.email, 'crc', p.crc,
    'cargo', coalesce(m.cargo, p.cargo),
    'pontos', coalesce(x.pontos, 0), 'horas', coalesce(x.horas, 0),
    'itens', coalesce(x.itens, '[]'::jsonb)
  ) order by coalesce(x.pontos, 0) desc, p.nome), '[]'::jsonb)
  into v_res
  from public.empresa_membros m
  join public.perfis p on p.id = m.perfil_id
  left join lateral (
    select sum(pontos) as pontos, sum(horas) as horas,
           jsonb_agg(jsonb_build_object(
             'tipo', tipo, 'titulo', titulo, 'codigo', codigo,
             'cargaHoraria', horas, 'pontos', pontos, 'emitidoEm', emitido_em
           ) order by emitido_em desc) as itens
    from (
      select 'curso' as tipo, c.titulo, ce.codigo, ce.carga_horaria as horas,
             ce.pontos_pepc as pontos, ce.emitido_em
      from public.certificados ce
      join public.cursos c on c.id = ce.curso_id
      where ce.perfil_id = p.id and extract(year from ce.emitido_em) = v_ano
      union all
      select 'trilha', t.nome, ct.codigo, ct.carga_horaria, ct.pontos_pepc, ct.emitido_em
      from public.certificados_trilha ct
      join public.trilhas t on t.id = ct.trilha_id
      where ct.perfil_id = p.id and extract(year from ct.emitido_em) = v_ano
    ) u
  ) x on true
  where m.empresa_id = v_id and m.status = 'ativo';

  return jsonb_build_object('ano', v_ano, 'empresa', v_nome, 'membros', v_res);
end
$fn$;

-- ---------------------------------------------------------------------------
-- 8. CONVITES — emitir, consultar e aceitar
-- ---------------------------------------------------------------------------

-- Código ditável por telefone: sem I, O, 0 e 1, que viram outra letra na
-- transcrição. 32 símbolos, oito posições — colisão improvável, e o unique da
-- coluna cobre o resto.
create or replace function public.gerar_codigo_convite()
returns text language plpgsql volatile set search_path = public as $fn$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
begin
  for i in 1..8 loop
    s := s || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return 'CB-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end
$fn$;

create or replace function public.empresa_criar_convites(
  p_qtd int default 1,
  p_tipo text default 'licenca',
  p_papel text default 'membro',
  p_emails text[] default '{}',
  p_desconto int default 0,
  p_cargo text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_contratadas int; v_usadas int; v_pendentes int; v_qtd int;
  v_codigo text; v_out jsonb := '[]'::jsonb; v_email text; i int;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Só um gestor da empresa pode convidar.');
  end if;
  if p_tipo not in ('licenca', 'desconto') then
    return jsonb_build_object('erro', 'Tipo de convite inválido.');
  end if;
  if p_papel not in ('membro', 'gestor') then
    return jsonb_build_object('erro', 'Papel inválido.');
  end if;

  -- A quantidade vem da lista de e-mails quando ela existe: convite nominal e
  -- convite anônimo são a mesma coisa com ou sem destinatário.
  v_qtd := greatest(coalesce(array_length(p_emails, 1), p_qtd), 1);
  if v_qtd > 50 then
    return jsonb_build_object('erro', 'Máximo de 50 convites por vez.');
  end if;

  if p_tipo = 'licenca' then
    select licencas_contratadas into v_contratadas from public.empresas where id = v_id;
    select count(*) into v_usadas from public.empresa_membros
      where empresa_id = v_id and status = 'ativo' and licenca;
    select count(*) into v_pendentes from public.empresa_convites
      where empresa_id = v_id and status = 'pendente' and tipo = 'licenca' and expira_em > now();

    if v_usadas + v_pendentes + v_qtd > coalesce(v_contratadas, 0) then
      return jsonb_build_object(
        'erro', format(
          'Você tem %s assento(s) livre(s) — %s em uso e %s convite(s) aguardando. Fale com a Academy para ampliar o contrato.',
          greatest(coalesce(v_contratadas,0) - v_usadas - v_pendentes, 0), v_usadas, v_pendentes)
      );
    end if;
  end if;

  for i in 1..v_qtd loop
    v_email := case when p_emails is null then null else p_emails[i] end;
    loop
      v_codigo := public.gerar_codigo_convite();
      exit when not exists (select 1 from public.empresa_convites where codigo = v_codigo);
    end loop;

    insert into public.empresa_convites
      (empresa_id, codigo, email, cargo, papel, tipo, desconto_pct, criado_por)
    values
      (v_id, v_codigo, nullif(trim(coalesce(v_email, '')), ''), p_cargo, p_papel, p_tipo,
       case when p_tipo = 'desconto' then greatest(least(p_desconto, 100), 0) else 0 end,
       auth.uid());

    v_out := v_out || jsonb_build_object('codigo', v_codigo, 'email', v_email);
  end loop;

  return jsonb_build_object('ok', true, 'convites', v_out);
end
$fn$;

create or replace function public.empresa_cancelar_convite(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare v_id uuid := public.minha_empresa_id();
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;
  update public.empresa_convites set status = 'cancelado'
   where id = p_id and empresa_id = v_id and status = 'pendente';
  return jsonb_build_object('ok', found);
end
$fn$;

-- Consulta pública: a tela do convite precisa dizer quem convidou antes de a
-- pessoa ter conta. Devolve só o que cabe num convite — nome da empresa, tipo
-- e validade. Nada de e-mail de terceiros nem contagem de assentos.
create or replace function public.convite_publico(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare c public.empresa_convites%rowtype; e public.empresas%rowtype;
begin
  select * into c from public.empresa_convites where upper(codigo) = upper(trim(p_codigo));
  if not found then return jsonb_build_object('valido', false, 'motivo', 'nao-encontrado'); end if;
  if c.status = 'aceito' then return jsonb_build_object('valido', false, 'motivo', 'ja-usado'); end if;
  if c.status = 'cancelado' then return jsonb_build_object('valido', false, 'motivo', 'cancelado'); end if;
  if c.expira_em < now() then return jsonb_build_object('valido', false, 'motivo', 'expirado'); end if;

  select * into e from public.empresas where id = c.empresa_id;

  return jsonb_build_object(
    'valido', true, 'codigo', c.codigo, 'empresa', e.nome, 'empresaCor', e.cor,
    'cidade', e.cidade, 'uf', e.uf, 'tipo', c.tipo, 'papel', c.papel,
    'cargo', c.cargo, 'descontoPct', c.desconto_pct, 'email', c.email,
    'expiraEm', c.expira_em
  );
end
$fn$;

create or replace function public.aceitar_convite(p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  c public.empresa_convites%rowtype;
  e public.empresas%rowtype;
  v_perfil uuid := auth.uid();
  v_plano text; v_usadas int; v_ja uuid;
begin
  if v_perfil is null then
    return jsonb_build_object('erro', 'Entre na sua conta para aceitar o convite.');
  end if;

  select * into c from public.empresa_convites where upper(codigo) = upper(trim(p_codigo));
  if not found then return jsonb_build_object('erro', 'Código não encontrado.'); end if;
  if c.status <> 'pendente' then
    return jsonb_build_object('erro', 'Este convite já foi usado ou cancelado.');
  end if;
  if c.expira_em < now() then
    return jsonb_build_object('erro', 'Este convite expirou. Peça um novo ao gestor.');
  end if;

  select empresa_id into v_ja from public.empresa_membros
   where perfil_id = v_perfil and status = 'ativo' limit 1;
  if v_ja is not null and v_ja <> c.empresa_id then
    return jsonb_build_object('erro', 'Você já faz parte de outra empresa. Saia dela antes de aceitar este convite.');
  end if;

  select * into e from public.empresas where id = c.empresa_id;
  select plano::text into v_plano from public.perfis where id = v_perfil;

  if c.tipo = 'licenca' then
    select count(*) into v_usadas from public.empresa_membros
      where empresa_id = c.empresa_id and status = 'ativo' and licenca;
    if v_usadas >= coalesce(e.licencas_contratadas, 0) then
      return jsonb_build_object('erro', 'Os assentos desta empresa acabaram. Avise o gestor.');
    end if;
  end if;

  insert into public.empresa_membros
    (empresa_id, perfil_id, papel, cargo, status, licenca, desconto_pct,
     entrou_em, convite_id, plano_anterior)
  values
    (c.empresa_id, v_perfil, c.papel, c.cargo, 'ativo', c.tipo = 'licenca', c.desconto_pct,
     now(), c.id, case when c.tipo = 'licenca' then v_plano else null end)
  on conflict (empresa_id, perfil_id) do update set
    papel = excluded.papel,
    cargo = coalesce(excluded.cargo, public.empresa_membros.cargo),
    status = 'ativo',
    licenca = public.empresa_membros.licenca or excluded.licenca,
    desconto_pct = greatest(public.empresa_membros.desconto_pct, excluded.desconto_pct),
    convite_id = excluded.convite_id,
    plano_anterior = coalesce(public.empresa_membros.plano_anterior, excluded.plano_anterior);

  -- A licença é o plano: enquanto a pessoa estiver no time, ela é Pro.
  if c.tipo = 'licenca' then
    update public.perfis set plano = 'Pro' where id = v_perfil and plano = 'Free';
  end if;

  update public.empresa_convites
     set status = 'aceito', aceito_em = now(), aceito_por = v_perfil
   where id = c.id;

  if c.criado_por is not null then
    insert into public.notificacoes (perfil_id, titulo, mensagem, tipo, link)
    select c.criado_por, 'Convite aceito',
           p.nome || ' entrou no time da ' || e.nome || '.',
           'sistema', '/empresa/equipe'
    from public.perfis p where p.id = v_perfil;
  end if;

  return jsonb_build_object(
    'ok', true, 'empresa', e.nome, 'empresaId', e.id,
    'tipo', c.tipo, 'papel', c.papel, 'descontoPct', c.desconto_pct
  );
end
$fn$;


-- ---------------------------------------------------------------------------
-- 9. MEMBROS E ATRIBUIÇÕES — as ações do gestor
-- ---------------------------------------------------------------------------

-- Tirar alguém do time devolve o plano que a pessoa tinha antes da licença.
-- Sem isso o desligamento deixaria um Pro vitalício de graça — ou rebaixaria
-- quem já pagava Pro por conta própria antes de ser contratado.
create or replace function public.empresa_remover_membro(p_perfil uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  m public.empresa_membros%rowtype;
  v_gestores int;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;

  select * into m from public.empresa_membros
   where empresa_id = v_id and perfil_id = p_perfil and status = 'ativo';
  if not found then return jsonb_build_object('erro', 'Essa pessoa não está no time.'); end if;

  if m.papel in ('gestor', 'admin') then
    select count(*) into v_gestores from public.empresa_membros
     where empresa_id = v_id and status = 'ativo' and papel in ('gestor', 'admin');
    if v_gestores <= 1 then
      return jsonb_build_object('erro', 'A empresa ficaria sem gestor. Promova outra pessoa antes.');
    end if;
  end if;

  update public.empresa_membros
     set status = 'removido', licenca = false, desconto_pct = 0
   where empresa_id = v_id and perfil_id = p_perfil;

  if m.licenca then
    update public.perfis
       set plano = coalesce(nullif(m.plano_anterior, ''), 'Free')::plano_tipo
     where id = p_perfil and plano = 'Pro';
  end if;

  return jsonb_build_object('ok', true);
end
$fn$;

create or replace function public.empresa_definir_papel(p_perfil uuid, p_papel text)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare v_id uuid := public.minha_empresa_id(); v_gestores int;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;
  if p_papel not in ('membro', 'gestor') then
    return jsonb_build_object('erro', 'Papel inválido.');
  end if;

  if p_papel = 'membro' then
    select count(*) into v_gestores from public.empresa_membros
     where empresa_id = v_id and status = 'ativo' and papel in ('gestor', 'admin');
    if v_gestores <= 1 and exists (
      select 1 from public.empresa_membros
       where empresa_id = v_id and perfil_id = p_perfil and papel in ('gestor', 'admin')
    ) then
      return jsonb_build_object('erro', 'A empresa precisa de pelo menos um gestor.');
    end if;
  end if;

  update public.empresa_membros set papel = p_papel
   where empresa_id = v_id and perfil_id = p_perfil and status = 'ativo';
  return jsonb_build_object('ok', found);
end
$fn$;

-- Dar ou tirar assento de quem já está no time, sem passar por convite novo.
create or replace function public.empresa_definir_licenca(p_perfil uuid, p_ativa boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  m public.empresa_membros%rowtype;
  v_contratadas int; v_usadas int; v_plano text;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;

  select * into m from public.empresa_membros
   where empresa_id = v_id and perfil_id = p_perfil and status = 'ativo';
  if not found then return jsonb_build_object('erro', 'Essa pessoa não está no time.'); end if;

  if p_ativa and not m.licenca then
    select licencas_contratadas into v_contratadas from public.empresas where id = v_id;
    select count(*) into v_usadas from public.empresa_membros
     where empresa_id = v_id and status = 'ativo' and licenca;
    if v_usadas >= coalesce(v_contratadas, 0) then
      return jsonb_build_object('erro', 'Não há assento livre no contrato.');
    end if;
    select plano::text into v_plano from public.perfis where id = p_perfil;
    update public.empresa_membros
       set licenca = true, plano_anterior = coalesce(m.plano_anterior, v_plano)
     where empresa_id = v_id and perfil_id = p_perfil;
    update public.perfis set plano = 'Pro' where id = p_perfil and plano = 'Free';

  elsif not p_ativa and m.licenca then
    update public.empresa_membros set licenca = false
     where empresa_id = v_id and perfil_id = p_perfil;
    update public.perfis
       set plano = coalesce(nullif(m.plano_anterior, ''), 'Free')::plano_tipo
     where id = p_perfil and plano = 'Pro';
  end if;

  return jsonb_build_object('ok', true);
end
$fn$;

-- O membro também pode sair sozinho. Vínculo profissional acaba, e ninguém
-- deve depender do ex-gestor para se desligar.
create or replace function public.empresa_sair()
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  m public.empresa_membros%rowtype;
  v_gestores int;
begin
  if v_id is null then return jsonb_build_object('erro', 'Você não está em nenhuma empresa.'); end if;

  select * into m from public.empresa_membros
   where empresa_id = v_id and perfil_id = auth.uid() and status = 'ativo';

  if m.papel in ('gestor', 'admin') then
    select count(*) into v_gestores from public.empresa_membros
     where empresa_id = v_id and status = 'ativo' and papel in ('gestor', 'admin');
    if v_gestores <= 1 then
      return jsonb_build_object('erro', 'Você é o único gestor. Promova alguém antes de sair.');
    end if;
  end if;

  update public.empresa_membros
     set status = 'removido', licenca = false, desconto_pct = 0
   where empresa_id = v_id and perfil_id = auth.uid();

  if m.licenca then
    update public.perfis
       set plano = coalesce(nullif(m.plano_anterior, ''), 'Free')::plano_tipo
     where id = auth.uid() and plano = 'Pro';
  end if;

  return jsonb_build_object('ok', true);
end
$fn$;

create or replace function public.empresa_atribuir(
  p_curso uuid default null,
  p_trilha uuid default null,
  p_perfil uuid default null,
  p_prazo date default null,
  p_obrigatoria boolean default true,
  p_observacao text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_id uuid := public.minha_empresa_id();
  v_novo uuid;
  v_titulo text;
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;
  if p_curso is null and p_trilha is null then
    return jsonb_build_object('erro', 'Escolha um curso ou uma trilha.');
  end if;
  if p_curso is not null and p_trilha is not null then
    return jsonb_build_object('erro', 'Atribua um curso ou uma trilha, não os dois.');
  end if;
  if p_perfil is not null and not exists (
    select 1 from public.empresa_membros
     where empresa_id = v_id and perfil_id = p_perfil and status = 'ativo'
  ) then
    return jsonb_build_object('erro', 'Essa pessoa não está no time.');
  end if;

  if exists (
    select 1 from public.empresa_atribuicoes
     where empresa_id = v_id
       and curso_id is not distinct from p_curso
       and trilha_id is not distinct from p_trilha
       and perfil_id is not distinct from p_perfil
  ) then
    return jsonb_build_object('erro', 'Essa formação já está atribuída.');
  end if;

  insert into public.empresa_atribuicoes
    (empresa_id, curso_id, trilha_id, perfil_id, prazo, obrigatoria, observacao, criado_por)
  values (v_id, p_curso, p_trilha, p_perfil, p_prazo, p_obrigatoria, p_observacao, auth.uid())
  returning id into v_novo;

  select coalesce(c.titulo, t.nome) into v_titulo
  from (select 1) z
  left join public.cursos c on c.id = p_curso
  left join public.trilhas t on t.id = p_trilha;

  -- Avisa quem foi atribuído. Formação obrigatória que ninguém sabe que existe
  -- só vira cobrança atrasada.
  insert into public.notificacoes (perfil_id, titulo, mensagem, tipo, link)
  select m.perfil_id,
         case when p_obrigatoria then 'Formação obrigatória' else 'Formação recomendada' end,
         'Sua empresa indicou: ' || coalesce(v_titulo, 'uma formação')
           || case when p_prazo is null then '.' else ' — prazo até ' || to_char(p_prazo, 'DD/MM/YYYY') || '.' end,
         'sistema',
         case when p_curso is not null
              then '/app/cursos/' || (select slug from public.cursos where id = p_curso)
              else '/app/trilhas/' || (select slug from public.trilhas where id = p_trilha) end
  from public.empresa_membros m
  where m.empresa_id = v_id and m.status = 'ativo'
    and (p_perfil is null or m.perfil_id = p_perfil);

  return jsonb_build_object('ok', true, 'id', v_novo);
end
$fn$;

create or replace function public.empresa_remover_atribuicao(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare v_id uuid := public.minha_empresa_id();
begin
  if v_id is null or not public.is_gestor_empresa(v_id) then
    return jsonb_build_object('erro', 'Sem permissão.');
  end if;
  delete from public.empresa_atribuicoes where id = p_id and empresa_id = v_id;
  return jsonb_build_object('ok', found);
end
$fn$;
-- ---------------------------------------------------------------------------
-- 7. CANDIDATOS DA VAGA — a empresa dona também vê
--
--    A policy "candidaturas: empresa vê as das suas vagas" já existia, mas a
--    função que monta a ficha exigia admin: a tela do gestor mostrava
--    "7 candidatos" no cartão e "ninguém se candidatou" ao abrir.
-- ---------------------------------------------------------------------------
create or replace function public.candidatos_da_vaga(p_vaga uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v jsonb; v_empresa uuid;
begin
  select empresa_id into v_empresa from public.vagas where id = p_vaga;
  if v_empresa is null then return '[]'::jsonb; end if;
  if not (public.is_admin() or public.is_membro_empresa(v_empresa)) then
    raise exception 'Sem permissão para ver os candidatos desta vaga';
  end if;

  select coalesce(jsonb_agg(x order by x ->> 'nome'), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'candidatura_id', c.id,
      'status',         c.status,
      'criada_em',      c.criada_em,
      'mensagem',       c.mensagem,
      'perfil', jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'email', p.email, 'cargo', p.cargo,
        'cidade', p.cidade, 'uf', p.uf, 'senioridade', p.senioridade,
        'bio', p.bio, 'pretensao', p.pretensao, 'disponivel', p.disponivel,
        'plano', p.plano, 'nivel', p.nivel, 'pontos', p.pontos,
        'habilidades', coalesce((
          select jsonb_agg(h.nome order by ph.nivel desc)
          from public.perfil_habilidades ph
          join public.habilidades h on h.id = ph.habilidade_id
          where ph.perfil_id = p.id), '[]'::jsonb)
      ),
      'certificados', coalesce((
        select jsonb_agg(jsonb_build_object('cursoSlug', cu.slug, 'cursoTitulo', cu.titulo))
        from public.certificados ce
        join public.cursos cu on cu.id = ce.curso_id
        where ce.perfil_id = p.id), '[]'::jsonb),
      'trilhas', coalesce((
        select jsonb_agg(jsonb_build_object('trilhaSlug', t.slug, 'trilhaNome', t.nome))
        from public.certificados_trilha ct
        join public.trilhas t on t.id = ct.trilha_id
        where ct.perfil_id = p.id), '[]'::jsonb),
      'nome', p.nome
    ) as x
    from public.candidaturas c
    join public.perfis p on p.id = c.perfil_id
    where c.vaga_id = p_vaga
  ) s;

  return v;
end
$fn$;

drop policy if exists "candidaturas: empresa move o status" on public.candidaturas;
create policy "candidaturas: empresa move o status" on public.candidaturas
  for update using (
    exists (select 1 from public.vagas v
             where v.id = candidaturas.vaga_id and public.is_membro_empresa(v.empresa_id))
  ) with check (
    exists (select 1 from public.vagas v
             where v.id = candidaturas.vaga_id and public.is_membro_empresa(v.empresa_id))
  );

-- ---------------------------------------------------------------------------
-- 10. PERMISSÕES DAS FUNÇÕES
--
--     `revoke from public` sozinho não basta: as default privileges do
--     Supabase dão EXECUTE a `anon` no momento da criação, e esse grant é
--     explícito — só sai nomeando o papel.
--
--     Só duas funções ficam abertas a `anon`: `convite_publico`, que é o que
--     a tela do convite consulta antes de a pessoa ter conta, e as três
--     `is_*`, que o próprio RLS chama ao avaliar policy de leitura pública
--     (tirar o EXECUTE delas quebraria o mural de vagas para visitante).
-- ---------------------------------------------------------------------------
do $g$
declare f text;
begin
  foreach f in array array[
    'minha_empresa_id()',
    'pode_ver_progresso(uuid)',
    'pct_curso(uuid, uuid)',
    'pct_trilha(uuid, uuid)',
    'empresa_do_usuario()',
    'empresa_equipe()',
    'empresa_resumo()',
    'empresa_formacoes()',
    'minhas_formacoes()',
    'empresa_relatorio_pepc(int)',
    'empresa_criar_convites(int, text, text, text[], int, text)',
    'empresa_cancelar_convite(uuid)',
    'aceitar_convite(text)',
    'empresa_remover_membro(uuid)',
    'empresa_definir_papel(uuid, text)',
    'empresa_definir_licenca(uuid, boolean)',
    'empresa_sair()',
    'empresa_atribuir(uuid, uuid, uuid, date, boolean, text)',
    'empresa_remover_atribuicao(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('revoke execute on function public.%s from anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$g$;

-- A tela do convite abre sem sessão: quem recebe o link muitas vezes ainda
-- não tem conta.
revoke all on function public.convite_publico(text) from public;
grant execute on function public.convite_publico(text) to anon, authenticated;

-- Gerador de código é peça interna do `empresa_criar_convites`.
revoke all on function public.gerar_codigo_convite() from public;
revoke execute on function public.gerar_codigo_convite() from anon, authenticated;

-- Função de gatilho não é endpoint. O Postgres só exige EXECUTE na criação do
-- trigger, então revogar aqui não afeta o disparo — apenas tira a função de
-- /rest/v1/rpc, onde ela nunca deveria ter aparecido.
revoke all on function public.empresas_trava_licencas() from public;
revoke execute on function public.empresas_trava_licencas() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- CONFERÊNCIA
-- ---------------------------------------------------------------------------
-- select public.empresa_do_usuario();
-- select public.empresa_resumo();
-- select jsonb_pretty(public.empresa_equipe());
-- select jsonb_pretty(public.empresa_formacoes());
-- select public.empresa_relatorio_pepc(2026);
--
-- Nenhuma função da área da empresa deve listar `anon` no proacl, exceto
-- `convite_publico`:
--
--   select proname, proacl from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname like 'empresa%';
