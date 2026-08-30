-- ============================================================================
--  11 — SELOS DE HABILIDADE, CONCLUSÃO DE CURSO, AVALIAÇÃO E BANCO DE QUESTÕES
--
--  Roda depois de 10_cupons_comunicacao_vagas.sql. É idempotente: pode rodar
--  duas vezes sem duplicar nada.
--
--  O que muda de conceito aqui:
--
--  1. HABILIDADE DEIXA DE SER AUTODECLARADA. Antes a pessoa marcava "SPED" no
--     perfil e a empresa tinha que acreditar. Agora a habilidade vem do
--     certificado: concluiu o curso, ganhou o selo. O nível do selo é o nível
--     do curso — bronze para Iniciante, prata para Intermediário, ouro para
--     Avançado. Quem contrata passa a ler um fato, não uma intenção.
--
--  2. A TRILHA VIRA CERTIFICAÇÃO. Concluir a trilha inteira dá um selo dourado
--     com as habilidades desenvolvidas dentro dele. É o que a empresa procura
--     ("preciso de alguém com a trilha de Analista Fiscal").
--
--  3. O CURSO PASSA A TER NOTA REAL. A avaliação é pedida uma vez, no fim do
--     curso — nunca aula a aula — e a média realimenta `cursos.nota`.
-- ============================================================================

-- ============================================================================
--  1. SELOS DE HABILIDADE
-- ============================================================================

-- Qual habilidade cada curso concede. É o admin quem define, na tela do curso.
create table if not exists public.curso_habilidades (
  curso_id      uuid not null references public.cursos(id)      on delete cascade,
  habilidade_id uuid not null references public.habilidades(id) on delete cascade,
  primary key (curso_id, habilidade_id)
);

alter table public.curso_habilidades enable row level security;

drop policy if exists "curso_habilidades: leitura livre" on public.curso_habilidades;
create policy "curso_habilidades: leitura livre"
  on public.curso_habilidades for select using (true);

drop policy if exists "curso_habilidades: admin escreve" on public.curso_habilidades;
create policy "curso_habilidades: admin escreve"
  on public.curso_habilidades for all
  using (public.is_admin()) with check (public.is_admin());

-- `origem` separa o que foi conquistado do que foi digitado. Sem essa coluna,
-- o selo de ouro de quem estudou fica visualmente igual ao texto de quem só
-- escreveu o nome da ferramenta no cadastro.
alter table public.perfil_habilidades
  add column if not exists origem    text not null default 'manual',
  add column if not exists selo      text,
  add column if not exists curso_id  uuid references public.cursos(id) on delete set null,
  add column if not exists trilha_id uuid references public.trilhas(id) on delete set null,
  add column if not exists obtida_em timestamptz;

do $bl$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'perfil_habilidades_origem_check'
  ) then
    alter table public.perfil_habilidades
      add constraint perfil_habilidades_origem_check
      check (origem in ('manual', 'curso', 'trilha'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'perfil_habilidades_selo_check'
  ) then
    alter table public.perfil_habilidades
      add constraint perfil_habilidades_selo_check
      check (selo is null or selo in ('bronze', 'prata', 'ouro'));
  end if;
end $bl$;

-- Ordem de valor do selo. Existe para o UPDATE de conflito nunca rebaixar
-- alguém: quem já tem ouro em SPED não volta para bronze ao fazer um curso
-- introdutório que também concede SPED.
create or replace function public.peso_selo(p_selo text)
returns integer language sql immutable set search_path = public as $fn$
  select case p_selo when 'ouro' then 3 when 'prata' then 2 when 'bronze' then 1 else 0 end;
$fn$;

create or replace function public.selo_do_nivel(p_nivel text)
returns text language sql immutable set search_path = public as $fn$
  select case p_nivel
    when 'Iniciante'     then 'bronze'
    when 'Intermediário' then 'prata'
    else 'ouro'
  end;
$fn$;

create or replace function public.nota_do_selo(p_selo text)
returns integer language sql immutable set search_path = public as $fn$
  select case p_selo when 'ouro' then 92 when 'prata' then 72 else 48 end;
$fn$;

-- Concede os selos do curso quando o certificado nasce.
create or replace function public.conceder_selos_do_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_selo  text;
  v_nota  integer;
begin
  select public.selo_do_nivel(c.nivel::text) into v_selo
  from public.cursos c where c.id = new.curso_id;

  if v_selo is null then
    return new;
  end if;
  v_nota := public.nota_do_selo(v_selo);

  insert into public.perfil_habilidades as ph
    (perfil_id, habilidade_id, nivel, verificada, origem, selo, curso_id, obtida_em)
  select new.perfil_id, ch.habilidade_id, v_nota, true, 'curso', v_selo,
         new.curso_id, now()
  from public.curso_habilidades ch
  where ch.curso_id = new.curso_id
  on conflict (perfil_id, habilidade_id) do update set
    nivel      = greatest(ph.nivel, excluded.nivel),
    verificada = true,
    origem     = case when ph.origem = 'trilha' then 'trilha' else 'curso' end,
    selo       = case
                   when public.peso_selo(excluded.selo) > public.peso_selo(ph.selo)
                   then excluded.selo
                   else coalesce(ph.selo, excluded.selo)
                 end,
    curso_id   = case
                   when public.peso_selo(excluded.selo) > public.peso_selo(ph.selo)
                   then excluded.curso_id
                   else coalesce(ph.curso_id, excluded.curso_id)
                 end,
    obtida_em  = coalesce(ph.obtida_em, now());

  return new;
end
$fn$;

drop trigger if exists trg_selos_curso on public.certificados;
create trigger trg_selos_curso
  after insert on public.certificados
  for each row execute function public.conceder_selos_do_curso();

-- A trilha inteira eleva a ouro tudo que ela cobre: é a diferença entre ter
-- feito um curso do assunto e ter percorrido a formação completa.
create or replace function public.conceder_selos_da_trilha()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.perfil_habilidades as ph
    (perfil_id, habilidade_id, nivel, verificada, origem, selo, trilha_id, obtida_em)
  select new.perfil_id, th.habilidade_id,
         greatest(th.nivel_esperado, 90), true, 'trilha', 'ouro',
         new.trilha_id, now()
  from public.trilha_habilidades th
  where th.trilha_id = new.trilha_id
  on conflict (perfil_id, habilidade_id) do update set
    nivel      = greatest(ph.nivel, excluded.nivel),
    verificada = true,
    origem     = 'trilha',
    selo       = 'ouro',
    trilha_id  = excluded.trilha_id,
    obtida_em  = coalesce(ph.obtida_em, now());

  return new;
end
$fn$;

drop trigger if exists trg_selos_trilha on public.certificados_trilha;
create trigger trg_selos_trilha
  after insert on public.certificados_trilha
  for each row execute function public.conceder_selos_da_trilha();

-- ============================================================================
--  2. QUAL CURSO CONCEDE QUAL HABILIDADE — carga inicial
-- ============================================================================
-- Só insere o par quando curso e habilidade existem, então rodar num banco
-- parcial não quebra.
insert into public.curso_habilidades (curso_id, habilidade_id)
select c.id, h.id
from (values
  ('departamento-fiscal-do-zero',              'Simples Nacional'),
  ('departamento-fiscal-do-zero',              'SPED'),
  ('departamento-fiscal-do-zero',              'Obrigações acessórias'),
  ('departamento-fiscal-do-zero',              'Conciliação'),
  ('reforma-tributaria-na-pratica',            'Reforma Tributária'),
  ('reforma-tributaria-na-pratica',            'Planejamento tributário'),
  ('reforma-tributaria-na-pratica',            'Lucro Real'),
  ('recuperacao-de-creditos-tributarios',      'Recuperação de créditos'),
  ('recuperacao-de-creditos-tributarios',      'PER/DCOMP'),
  ('recuperacao-de-creditos-tributarios',      'Contencioso'),
  ('contabilidade-para-transporte-e-logistica','CT-e'),
  ('contabilidade-para-transporte-e-logistica','MDF-e'),
  ('contabilidade-para-transporte-e-logistica','Custos'),
  ('comercio-exterior-e-rotina-aduaneira',     'NCM'),
  ('comercio-exterior-e-rotina-aduaneira',     'Siscomex'),
  ('comercio-exterior-e-rotina-aduaneira',     'Drawback'),
  ('esocial-e-efd-reinf',                      'eSocial'),
  ('esocial-e-efd-reinf',                      'EFD-Reinf'),
  ('esocial-e-efd-reinf',                      'DCTFWeb'),
  ('departamento-pessoal-do-zero',             'Folha de pagamento'),
  ('departamento-pessoal-do-zero',             'Rescisão'),
  ('excel-e-power-bi-para-contadores',         'Excel avançado'),
  ('excel-e-power-bi-para-contadores',         'Power BI'),
  ('excel-e-power-bi-para-contadores',         'Power Query'),
  ('excel-e-power-bi-para-contadores',         'Automação'),
  ('contabilidade-consultiva-e-gestao',        'Consultivo'),
  ('contabilidade-consultiva-e-gestao',        'Atendimento ao cliente'),
  ('contabilidade-consultiva-e-gestao',        'Comunicação'),
  ('contabilidade-gerencial-e-controladoria',  'Custos'),
  ('contabilidade-gerencial-e-controladoria',  'Orçamento'),
  ('contabilidade-gerencial-e-controladoria',  'Power BI')
) as m(curso_slug, habilidade_nome)
join public.cursos      c on c.slug = m.curso_slug
join public.habilidades h on h.nome = m.habilidade_nome
on conflict do nothing;

-- ============================================================================
--  3. AVALIAÇÃO DO CURSO E DA TRILHA
-- ============================================================================
create table if not exists public.avaliacoes_curso (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  nota       integer check (nota between 1 and 5),
  comentario text,
  criado_em  timestamptz not null default now(),
  unique (perfil_id, curso_id)
);

create table if not exists public.avaliacoes_trilha (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfis(id)  on delete cascade,
  trilha_id  uuid not null references public.trilhas(id) on delete cascade,
  nota       integer check (nota between 1 and 5),
  comentario text,
  criado_em  timestamptz not null default now(),
  unique (perfil_id, trilha_id)
);

alter table public.avaliacoes_curso  enable row level security;
alter table public.avaliacoes_trilha enable row level security;

-- A nota vira média pública do curso; o comentário, não — ele é assinado.
-- Por isso a leitura completa fica com o autor e com a administração.
drop policy if exists "avaliacoes_curso: própria" on public.avaliacoes_curso;
create policy "avaliacoes_curso: própria" on public.avaliacoes_curso for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

drop policy if exists "avaliacoes_curso: admin lê" on public.avaliacoes_curso;
create policy "avaliacoes_curso: admin lê" on public.avaliacoes_curso for select
  using (public.is_admin());

drop policy if exists "avaliacoes_trilha: própria" on public.avaliacoes_trilha;
create policy "avaliacoes_trilha: própria" on public.avaliacoes_trilha for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

drop policy if exists "avaliacoes_trilha: admin lê" on public.avaliacoes_trilha;
create policy "avaliacoes_trilha: admin lê" on public.avaliacoes_trilha for select
  using (public.is_admin());

-- A média só sobrescreve a nota do catálogo quando existe avaliação de gente
-- de verdade — senão um curso novo nasceria com nota zero.
create or replace function public.recalcular_nota_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_curso uuid := coalesce(new.curso_id, old.curso_id);
begin
  update public.cursos c
     set nota = x.media
    from (
      select round(avg(nota)::numeric, 1) as media, count(*) as n
      from public.avaliacoes_curso where curso_id = v_curso and nota is not null
    ) x
   where c.id = v_curso and x.n > 0;
  return null;
end
$fn$;

drop trigger if exists trg_nota_curso on public.avaliacoes_curso;
create trigger trg_nota_curso
  after insert or update or delete on public.avaliacoes_curso
  for each row execute function public.recalcular_nota_curso();

-- Postgres concede EXECUTE a PUBLIC por padrão e o PostgREST publica tudo que
-- vive em `public` como /rest/v1/rpc/<nome>. Função de gatilho não deveria
-- estar nessa lista: chamá-la fora do trigger só daria erro, mas a superfície
-- exposta some por um revoke — como já é o padrão do resto do schema.
revoke all on function public.conceder_selos_do_curso()  from public, anon, authenticated;
revoke all on function public.conceder_selos_da_trilha() from public, anon, authenticated;
revoke all on function public.recalcular_nota_curso()    from public, anon, authenticated;

-- ============================================================================
--  4. RESUMO DA CONCLUSÃO — o que a tela de parabéns precisa saber
-- ============================================================================
-- Uma chamada só. A alternativa era o navegador fazer cinco consultas e montar
-- a comemoração com dados que chegam em ordens diferentes.
create or replace function public.resumo_conclusao_curso(p_curso uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_perfil   uuid := auth.uid();
  v_total    integer;
  v_feitas   integer;
  v_cert     record;
  v_habs     jsonb := '[]'::jsonb;
  v_trilhas  jsonb := '[]'::jsonb;
  v_avaliado boolean;
begin
  if v_perfil is null then
    raise exception 'Não autenticado';
  end if;

  select count(*) into v_total
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where m.curso_id = p_curso;

  select count(*) into v_feitas
  from public.progresso_aulas p
  join public.aulas a   on a.id = p.aula_id
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = p_curso and p.perfil_id = v_perfil and p.concluida;

  select c.codigo, c.carga_horaria, c.pontos_pepc, c.emitido_em
    into v_cert
  from public.certificados c
  where c.perfil_id = v_perfil and c.curso_id = p_curso;

  -- Habilidades que este curso concedeu a esta pessoa.
  select coalesce(jsonb_agg(jsonb_build_object('nome', h.nome, 'selo', ph.selo)
                            order by h.nome), '[]'::jsonb)
    into v_habs
  from public.curso_habilidades ch
  join public.habilidades h         on h.id = ch.habilidade_id
  join public.perfil_habilidades ph on ph.habilidade_id = ch.habilidade_id
                                   and ph.perfil_id = v_perfil
  where ch.curso_id = p_curso;

  -- Trilhas fechadas por este certificado, com as habilidades do selo.
  select coalesce(jsonb_agg(t.dados order by t.dados ->> 'nome'), '[]'::jsonb)
    into v_trilhas
  from (
    select jsonb_build_object(
             'slug',         tr.slug,
             'nome',         tr.nome,
             'cor',          tr.cor,
             'codigo',       ct.codigo,
             'cargaHoraria', ct.carga_horaria,
             'pontosPEPC',   ct.pontos_pepc,
             'emitidoEm',    ct.emitido_em,
             -- O selo da trilha nasce no mesmo instante do certificado do
             -- curso que a fechou: é o trigger que o cria. Sem esta marca, a
             -- tela comemorava trilha conquistada meses atrás só porque o
             -- curso recém-concluído também faz parte dela.
             'nova',         (v_cert.emitido_em is not null
                              and ct.emitido_em >= v_cert.emitido_em),
             'avaliada',     exists (select 1 from public.avaliacoes_trilha av
                                      where av.perfil_id = v_perfil
                                        and av.trilha_id = tr.id),
             'habilidades',  coalesce((
                               select jsonb_agg(h2.nome order by th.nivel_esperado desc)
                               from public.trilha_habilidades th
                               join public.habilidades h2 on h2.id = th.habilidade_id
                               where th.trilha_id = tr.id
                             ), '[]'::jsonb)
           ) as dados
    from public.certificados_trilha ct
    join public.trilhas tr on tr.id = ct.trilha_id
    where ct.perfil_id = v_perfil
      and exists (
        select 1 from public.trilha_cursos tc
        where tc.trilha_id = ct.trilha_id and tc.curso_id = p_curso
      )
  ) t;

  select exists (
    select 1 from public.avaliacoes_curso
    where perfil_id = v_perfil and curso_id = p_curso
  ) into v_avaliado;

  return jsonb_build_object(
    'totalAulas',  v_total,
    'aulasFeitas', v_feitas,
    'concluido',   v_total > 0 and v_feitas >= v_total,
    'certificado', case when v_cert.codigo is null then null else jsonb_build_object(
                     'codigo',       v_cert.codigo,
                     'cargaHoraria', v_cert.carga_horaria,
                     'pontosPEPC',   v_cert.pontos_pepc,
                     'emitidoEm',    v_cert.emitido_em
                   ) end,
    'habilidades', v_habs,
    'trilhas',     v_trilhas,
    'avaliado',    v_avaliado
  );
end
$fn$;

revoke all on function public.resumo_conclusao_curso(uuid) from public, anon;
grant execute on function public.resumo_conclusao_curso(uuid) to authenticated;

-- ============================================================================
--  5. BANCO DE QUESTÕES — administração e procedência
-- ============================================================================
alter table public.questoes_banco
  add column if not exists origem        text not null default 'manual',
  add column if not exists prova         text,
  add column if not exists criado_por    uuid references public.perfis(id) on delete set null,
  add column if not exists atualizado_em timestamptz not null default now();

do $bl$
begin
  if not exists (select 1 from pg_constraint where conname = 'questoes_banco_origem_check') then
    alter table public.questoes_banco
      add constraint questoes_banco_origem_check
      check (origem in ('manual', 'ia', 'prova'));
  end if;
end $bl$;

drop trigger if exists trg_questoes_banco_atualizado on public.questoes_banco;
create trigger trg_questoes_banco_atualizado
  before update on public.questoes_banco
  for each row execute function public.set_atualizado_em();

create index if not exists idx_questoes_banco_area    on public.questoes_banco (area);
create index if not exists idx_questoes_banco_assunto on public.questoes_banco (assunto);
create index if not exists idx_respostas_perfil_data  on public.respostas_questoes (perfil_id, criado_em desc);

-- ============================================================================
--  6. CONTATO NO BANCO DE TALENTOS
-- ============================================================================
-- Estar no banco de talentos e entregar o telefone são decisões diferentes.
-- Sem esta coluna, aceitar aparecer para empresas já publicava o número.
alter table public.perfis
  add column if not exists contato_publico boolean not null default true;

-- ============================================================================
--  7. BACKFILL — quem já concluiu curso recebe o selo agora
-- ============================================================================
do $bl$
declare c record;
begin
  for c in select perfil_id, curso_id from public.certificados loop
    insert into public.perfil_habilidades as ph
      (perfil_id, habilidade_id, nivel, verificada, origem, selo, curso_id, obtida_em)
    select c.perfil_id, ch.habilidade_id,
           public.nota_do_selo(public.selo_do_nivel(cu.nivel::text)), true, 'curso',
           public.selo_do_nivel(cu.nivel::text), c.curso_id, now()
    from public.curso_habilidades ch
    join public.cursos cu on cu.id = ch.curso_id
    where ch.curso_id = c.curso_id
    on conflict (perfil_id, habilidade_id) do update set
      nivel      = greatest(ph.nivel, excluded.nivel),
      verificada = true,
      origem     = case when ph.origem = 'trilha' then 'trilha' else 'curso' end,
      selo       = case when public.peso_selo(excluded.selo) > public.peso_selo(ph.selo)
                        then excluded.selo
                        else coalesce(ph.selo, excluded.selo) end,
      curso_id   = coalesce(ph.curso_id, excluded.curso_id),
      obtida_em  = coalesce(ph.obtida_em, now());
  end loop;

  for c in select perfil_id, trilha_id from public.certificados_trilha loop
    insert into public.perfil_habilidades as ph
      (perfil_id, habilidade_id, nivel, verificada, origem, selo, trilha_id, obtida_em)
    select c.perfil_id, th.habilidade_id, greatest(th.nivel_esperado, 90), true,
           'trilha', 'ouro', c.trilha_id, now()
    from public.trilha_habilidades th
    where th.trilha_id = c.trilha_id
    on conflict (perfil_id, habilidade_id) do update set
      nivel      = greatest(ph.nivel, excluded.nivel),
      verificada = true,
      origem     = 'trilha',
      selo       = 'ouro',
      trilha_id  = excluded.trilha_id,
      obtida_em  = coalesce(ph.obtida_em, now());
  end loop;
end $bl$;

-- ============================================================================
--  8. CONTATO NO BANCO DE TALENTOS
-- ============================================================================
-- O botão "Entrar em contato" da ficha do talento não fazia nada. Escrever
-- direto em `notificacoes` não resolveria: a tabela não tem policy de INSERT,
-- e criar uma seria dar a qualquer pessoa o direito de escrever na caixa de
-- qualquer outra. Esta função é o caminho estreito — com dono, com limite
-- diário e com rastro em `conversas`/`mensagens`.
create or replace function public.mensagem_para_talento(
  p_perfil   uuid,
  p_assunto  text,
  p_mensagem text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_remetente uuid := auth.uid();
  v_nome      text;
  v_publico   boolean;
  v_hoje      integer;
  v_conversa  uuid;
begin
  if v_remetente is null then
    raise exception 'Não autenticado';
  end if;
  if p_perfil = v_remetente then
    raise exception 'Você não pode enviar mensagem para si mesmo';
  end if;
  if coalesce(btrim(p_mensagem), '') = '' then
    raise exception 'Escreva a mensagem';
  end if;

  select perfil_publico into v_publico from public.perfis where id = p_perfil;
  if v_publico is null then
    raise exception 'Perfil não encontrado';
  end if;

  -- Só quem se colocou no banco de talentos recebe contato de fora. A
  -- administração fala com qualquer pessoa, porque é a coordenação do curso.
  if not v_publico and not public.is_admin() then
    raise exception 'Este perfil não está aberto para contato';
  end if;

  -- Freio de spam: dez mensagens por dia por remetente.
  select count(*)::integer into v_hoje
  from public.mensagens m
  where m.remetente_id = v_remetente and m.criado_em > now() - interval '1 day';

  if v_hoje >= 10 then
    raise exception 'Limite de mensagens por hoje atingido';
  end if;

  select nome into v_nome from public.perfis where id = v_remetente;

  select id into v_conversa from public.conversas
  where (a_id = v_remetente and b_id = p_perfil)
     or (a_id = p_perfil and b_id = v_remetente)
  limit 1;

  if v_conversa is null then
    insert into public.conversas (a_id, b_id) values (v_remetente, p_perfil)
    returning id into v_conversa;
  end if;

  insert into public.mensagens (conversa_id, remetente_id, conteudo)
  values (v_conversa, v_remetente,
          coalesce(nullif(btrim(p_assunto), '') || E'\n\n', '') || btrim(p_mensagem));

  insert into public.notificacoes (perfil_id, titulo, mensagem, tipo, link)
  values (
    p_perfil,
    coalesce(nullif(btrim(p_assunto), ''), 'Nova mensagem') || ' — ' || coalesce(v_nome, 'Alguém'),
    btrim(p_mensagem),
    'info',
    '/app/talentos/' || v_remetente::text
  );

  return jsonb_build_object('ok', true, 'conversa', v_conversa);
end
$fn$;

revoke all on function public.mensagem_para_talento(uuid, text, text) from public, anon;
grant execute on function public.mensagem_para_talento(uuid, text, text) to authenticated;

-- ============================================================================
--  9. CONTEÚDO DE APOIO
-- ============================================================================
-- Contato nos perfis de demonstração: banco de talentos sem forma de contato
-- é vitrine sem porta. Números fictícios, no padrão do restante do seed.
update public.perfis set telefone = t.tel, linkedin = t.li
from (values
  ('rafael@exemplo.com',  '(71) 99143-2280', 'https://www.linkedin.com/in/rafael-nogueira-demo'),
  ('paula@exemplo.com',   '(71) 99620-1184', 'https://www.linkedin.com/in/paula-menezes-demo'),
  ('joao@exemplo.com',    '(75) 99208-5531', 'https://www.linkedin.com/in/joao-pedro-lima-demo'),
  ('diego@exemplo.com',   '(75) 99777-4102', 'https://www.linkedin.com/in/diego-farias-demo'),
  ('camila@exemplo.com',  '(71) 99341-7768', 'https://www.linkedin.com/in/camila-duarte-demo'),
  ('beatriz@exemplo.com', '(75) 99655-3390', 'https://www.linkedin.com/in/beatriz-santana-demo')
) as t(email, tel, li)
where public.perfis.email = t.email and public.perfis.telefone is null;

-- A "Avaliação final" de Reforma Tributária tinha nome de prova e nenhuma
-- questão. Agora ela avalia de verdade — e serve de exemplo do formato.
update public.aulas a
   set quiz_ativo = true, quiz_qtd = 3, quiz_minimo = 2, quiz_tentativas = 2
  from public.modulos m, public.cursos c
 where m.id = a.modulo_id and c.id = m.curso_id
   and c.slug = 'reforma-tributaria-na-pratica'
   and a.titulo = 'Avaliação final';

insert into public.questoes (aula_id, enunciado, alternativas, correta, explicacao, ordem, revisada)
select a.id, q.enunciado, q.alternativas::jsonb, q.correta, q.explicacao, q.ordem, true
from public.aulas a
join public.modulos m on m.id = a.modulo_id
join public.cursos  c on c.id = m.curso_id,
(values
 ('No modelo do IVA dual, o que condiciona o direito ao crédito do adquirente?',
  '[{"id":"a","texto":"A emissão do documento fiscal pelo fornecedor."},{"id":"b","texto":"O efetivo recolhimento do tributo na etapa anterior."},{"id":"c","texto":"A classificação do bem como insumo essencial."},{"id":"d","texto":"O regime tributário adotado pelo adquirente."}]',
  'b',
  'Sai a não cumulatividade escritural e entra o crédito financeiro atrelado ao pagamento — é a base do split payment. Emitir documento não basta: sem recolhimento na etapa anterior, não há crédito.',
  1),
 ('Uma transportadora do Lucro Real negocia contrato de frete com vigência até 2027. Qual cláusula protege as duas partes na transição?',
  '[{"id":"a","texto":"Reajuste anual pelo IPCA, sem menção a tributos."},{"id":"b","texto":"Multa rescisória maior para o contratante."},{"id":"c","texto":"Cláusula de revisão tributária, com repactuação se a carga mudar."},{"id":"d","texto":"Preço fixo até o fim da vigência, sem revisão."}]',
  'c',
  'A carga efetiva muda ano a ano durante a transição. Preço fixo transfere todo o risco para um dos lados; a cláusula de revisão divide o efeito de uma mudança que nenhuma das partes provocou.',
  2),
 ('O que caracteriza o ano de 2026 no cronograma da Reforma Tributária?',
  '[{"id":"a","texto":"Alíquotas de teste (0,9% CBS e 0,1% IBS), compensáveis contra PIS/Cofins."},{"id":"b","texto":"CBS e IBS substituem integralmente PIS, Cofins e ICMS."},{"id":"c","texto":"Apenas empresas do Simples Nacional apuram os novos tributos."},{"id":"d","texto":"A obrigação vale só para operações de comércio exterior."}]',
  'a',
  '2026 é ano de teste: alíquotas simbólicas e valor compensável, para a empresa adaptar sistema e equipe antes de o tributo pesar no caixa. A substituição integral só se completa ao fim da transição.',
  3)
) as q(enunciado, alternativas, correta, explicacao, ordem)
where c.slug = 'reforma-tributaria-na-pratica'
  and a.titulo = 'Avaliação final'
  and not exists (select 1 from public.questoes qq where qq.aula_id = a.id);
