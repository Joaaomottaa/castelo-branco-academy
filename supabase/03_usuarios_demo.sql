-- ============================================================================
--  CASTELO BRANCO ACADEMY — 03. USUÁRIOS DE DEMONSTRAÇÃO
--  Rode DEPOIS do 02_seed.sql. Idempotente.
--
--  Cria 9 contas com senha 123456:
--    admin@castelobranco.com.br    → administrador
--    empresa@castelobranco.com.br  → conta empresarial (TransLog Brasil)
--    aluno@castelobranco.com.br    → aluna Mariana Alves
--    + 6 perfis para popular o banco de talentos
--
--  SE ESTE SCRIPT FALHAR: não tem problema. Crie os usuários manualmente em
--  Authentication › Users › Add user (marque "Auto Confirm User") e depois
--  rode só a parte "ATUALIZA OS PERFIS" lá embaixo.
-- ============================================================================

-- Função auxiliar: cria um usuário no auth já confirmado ---------------------
create or replace function public.criar_usuario_demo(
  p_email text,
  p_senha text,
  p_nome  text,
  p_role  public.user_role
) returns uuid
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is not null then
    return v_id;                                  -- já existe, não recria
  end if;

  v_id := gen_random_uuid();

  -- As colunas *_token precisam ser string vazia, nunca NULL: o serviço de
  -- autenticação (GoTrue) lê esses campos como string simples e quebra com
  -- NULL, devolvendo "Database error querying schema" no login.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
    jsonb_build_object('nome', p_nome, 'role', p_role::text),
    false,
    '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return v_id;
end $$;

-- Cria as contas -------------------------------------------------------------
select public.criar_usuario_demo('admin@castelobranco.com.br',   '123456', 'Equipe Castelo Branco', 'admin');
select public.criar_usuario_demo('empresa@castelobranco.com.br', '123456', 'TransLog Brasil',       'empresa');
select public.criar_usuario_demo('aluno@castelobranco.com.br',   '123456', 'Mariana Alves',         'aluno');
select public.criar_usuario_demo('rafael@exemplo.com',           '123456', 'Rafael Nogueira',       'aluno');
select public.criar_usuario_demo('camila@exemplo.com',           '123456', 'Camila Duarte',         'aluno');
select public.criar_usuario_demo('joao@exemplo.com',             '123456', 'João Pedro Lima',       'aluno');
select public.criar_usuario_demo('beatriz@exemplo.com',          '123456', 'Beatriz Santana',       'aluno');
select public.criar_usuario_demo('diego@exemplo.com',            '123456', 'Diego Farias',          'aluno');
select public.criar_usuario_demo('paula@exemplo.com',            '123456', 'Paula Menezes',         'aluno');


-- ============================================================================
--  ATUALIZA OS PERFIS
--  (O trigger on_auth_user_created já criou a linha em public.perfis;
--   aqui só completamos os dados profissionais.)
-- ============================================================================
update public.perfis p set
  role           = d.role::public.user_role,
  cidade         = d.cidade,
  uf             = d.uf,
  crc            = d.crc,
  cargo          = d.cargo,
  bio            = d.bio,
  senioridade    = d.senioridade::public.senioridade,
  pretensao      = d.pretensao,
  disponivel     = d.disponivel,
  perfil_publico = d.publico,
  plano          = d.plano::public.plano_tipo,
  pontos         = d.pontos,
  nivel          = d.nivel,
  ofensiva       = d.ofensiva
from (values
  ('aluno@castelobranco.com.br','aluno','Feira de Santana','BA','BA-123456/O-1','Analista Fiscal',
   '5 anos em departamento fiscal de transportadoras. Especialista em conferência de CT-e e apuração de ICMS interestadual.',
   'Pleno','R$ 6.000 – R$ 7.500',true,true,'Pro',4820,7,12),

  ('rafael@exemplo.com','aluno','Salvador','BA','BA-098765/O-3','Consultor Tributário',
   '12 anos em consultoria. Conduziu 30+ projetos de revisão tributária em logística e distribuição.',
   'Sênior','R$ 12.000 – R$ 16.000',true,true,'Pro',9140,11,4),

  ('camila@exemplo.com','aluno','São Paulo','SP',null,'Analista de Comex',
   'Formada em Comércio Exterior, 2 anos em despachante aduaneiro. Buscando atuar no lado contábil da operação.',
   'Júnior','R$ 3.500 – R$ 4.500',true,true,'Free',2310,4,2),

  ('joao@exemplo.com','aluno','Recife','PE','PE-445566/O-2','Contador',
   'Responsável técnico por carteira de 80 empresas. Foco em contabilidade consultiva.',
   'Especialista','A combinar',false,true,'Enterprise',7650,9,0),

  ('beatriz@exemplo.com','aluno','Feira de Santana','BA',null,'Auxiliar Contábil',
   'Cursando 6º semestre de Ciências Contábeis. Concluiu a trilha Departamento Fiscal do Zero com nota 9,4.',
   'Estagiário','R$ 1.500 – R$ 2.000',true,true,'Free',1580,3,9),

  ('diego@exemplo.com','aluno','Curitiba','PR','PR-778899/O-5','Coordenador Fiscal',
   'Automatizou o fechamento fiscal de um grupo com 12 CNPJs, reduzindo o ciclo de 9 para 3 dias.',
   'Pleno','R$ 8.000 – R$ 9.500',true,true,'Pro',6020,8,21),

  ('paula@exemplo.com','aluno','Salvador','BA','BA-334455/O-1','Analista Tributária',
   'Atua com planejamento tributário para importadoras. Certificada em comércio exterior pela Academy.',
   'Pleno','R$ 7.000 – R$ 8.500',true,true,'Pro',5240,7,6),

  ('empresa@castelobranco.com.br','empresa','Feira de Santana','BA',null,null,
   null,null,null,false,false,'Enterprise',0,1,0),

  ('admin@castelobranco.com.br','admin',null,null,null,null,
   null,null,null,false,false,'Enterprise',0,1,0)
) as d(email, role, cidade, uf, crc, cargo, bio, senioridade, pretensao,
       disponivel, publico, plano, pontos, nivel, ofensiva)
where p.email = d.email;

-- Habilidades dos perfis -----------------------------------------------------
insert into public.perfil_habilidades (perfil_id, habilidade_id, nivel, verificada)
select p.id, h.id, d.nivel, d.verificada
from (values
  ('aluno@castelobranco.com.br','SPED',92,true),
  ('aluno@castelobranco.com.br','CT-e',86,true),
  ('aluno@castelobranco.com.br','Lucro Real',78,false),
  ('aluno@castelobranco.com.br','Excel avançado',71,false),
  ('aluno@castelobranco.com.br','Power BI',65,false),

  ('rafael@exemplo.com','Reforma Tributária',95,true),
  ('rafael@exemplo.com','Recuperação de créditos',92,true),
  ('rafael@exemplo.com','PER/DCOMP',88,true),
  ('rafael@exemplo.com','Contencioso',74,false),

  ('camila@exemplo.com','NCM',80,true),
  ('camila@exemplo.com','Siscomex',76,false),
  ('camila@exemplo.com','Inglês avançado',85,false),
  ('camila@exemplo.com','Drawback',62,false),

  ('joao@exemplo.com','Lucro Real',94,true),
  ('joao@exemplo.com','Consultivo',90,true),
  ('joao@exemplo.com','Gestão de equipe',86,false),
  ('joao@exemplo.com','IFRS',72,false),

  ('beatriz@exemplo.com','Simples Nacional',74,true),
  ('beatriz@exemplo.com','Conciliação',66,false),
  ('beatriz@exemplo.com','Excel avançado',58,false),

  ('diego@exemplo.com','EFD-Reinf',90,true),
  ('diego@exemplo.com','eSocial',84,true),
  ('diego@exemplo.com','Automação',88,false),
  ('diego@exemplo.com','Python',76,false),

  ('paula@exemplo.com','NCM',84,true),
  ('paula@exemplo.com','Drawback',80,true),
  ('paula@exemplo.com','Reforma Tributária',70,false),
  ('paula@exemplo.com','Excel avançado',68,false)
) as d(email, habilidade, nivel, verificada)
join public.perfis      p on p.email = d.email
join public.habilidades h on h.nome  = d.habilidade
on conflict (perfil_id, habilidade_id) do nothing;

-- Vincula a conta empresarial à TransLog -------------------------------------
insert into public.empresa_membros (empresa_id, perfil_id, papel)
select e.id, p.id, 'admin'
from public.empresas e, public.perfis p
where e.nome = 'TransLog Brasil' and p.email = 'empresa@castelobranco.com.br'
on conflict do nothing;

-- ============================================================================
--  PROGRESSO DE DEMONSTRAÇÃO PARA A ALUNA
--  Conclui 100% de dois cursos (o trigger emite os certificados sozinho)
--  e deixa dois cursos pela metade.
-- ============================================================================
insert into public.progresso_aulas (perfil_id, aula_id, concluida, segundos_vistos)
select p.id, a.id, true, a.duracao_min * 60
from public.perfis p
join public.aulas a    on true
join public.modulos m  on m.id = a.modulo_id
join public.cursos c   on c.id = m.curso_id
where p.email = 'aluno@castelobranco.com.br'
  and c.slug in ('departamento-fiscal-do-zero','contabilidade-para-transporte-e-logistica')
on conflict (perfil_id, aula_id) do update set concluida = true;

-- Reforma Tributária: módulo 1 inteiro + 1 aula do módulo 2 ------------------
insert into public.progresso_aulas (perfil_id, aula_id, concluida, segundos_vistos)
select p.id, a.id, true, a.duracao_min * 60
from public.perfis p
join public.cursos c   on c.slug = 'reforma-tributaria-na-pratica'
join public.modulos m  on m.curso_id = c.id
join public.aulas a    on a.modulo_id = m.id
where p.email = 'aluno@castelobranco.com.br'
  and (m.ordem = 1 or (m.ordem = 2 and a.ordem = 1))
on conflict (perfil_id, aula_id) do update set concluida = true;

-- Recuperação de créditos: duas primeiras aulas ------------------------------
insert into public.progresso_aulas (perfil_id, aula_id, concluida, segundos_vistos)
select p.id, a.id, true, a.duracao_min * 60
from public.perfis p
join public.cursos c   on c.slug = 'recuperacao-de-creditos-tributarios'
join public.modulos m  on m.curso_id = c.id and m.ordem = 1
join public.aulas a    on a.modulo_id = m.id and a.ordem <= 2
where p.email = 'aluno@castelobranco.com.br'
on conflict (perfil_id, aula_id) do update set concluida = true;


-- ============================================================================
--  REDE DE SEGURANÇA — normaliza colunas de token que ficaram NULL
--  (versões diferentes do Supabase têm colunas diferentes em auth.users)
-- ============================================================================
do $$
declare col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
      and data_type in ('text', 'character varying')
      and column_name in (
        'confirmation_token','recovery_token','email_change',
        'email_change_token_new','email_change_token_current',
        'phone_change','phone_change_token','reauthentication_token'
      )
  loop
    execute format('update auth.users set %I = %L where %I is null',
                   col.column_name, '', col.column_name);
  end loop;
end $$;

-- ============================================================================
--  REMOVE A FUNÇÃO AUXILIAR
--
--  criar_usuario_demo cria conta com e-mail, senha e ROLE arbitrários. Como o
--  PostgREST expõe tudo do schema `public` em /rest/v1/rpc/, deixá-la no banco
--  permitiria a qualquer pessoa com a chave anônima criar uma conta admin.
--  Ela já cumpriu o papel acima; sai de cena aqui.
-- ============================================================================
drop function if exists public.criar_usuario_demo(text, text, text, public.user_role);

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from auth.users)                as usuarios,
  (select count(*) from public.perfis)             as perfis,
  (select count(*) from public.perfis where perfil_publico) as perfis_publicos,
  (select count(*) from public.perfil_habilidades) as habilidades_vinculadas,
  (select count(*) from public.progresso_aulas)    as progresso,
  (select count(*) from public.certificados)       as certificados;
-- Esperado: 9 | 9 | 7 | 28 | 22 | 2
