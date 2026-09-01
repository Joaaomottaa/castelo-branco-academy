-- ============================================================================
--  CASTELO BRANCO ACADEMY — 20. DOCENTE, RECRUTAMENTO E COMUNIDADE
--
--  Rode DEPOIS do 19_vagas_area_e_filtros.sql, no SQL Editor do Supabase.
--  É idempotente: rodar duas vezes não faz diferença.
--
--  Três assuntos, na ordem em que aparecem no produto:
--
--  1. DOCENTE NO CERTIFICADO — quem ministrou o curso passa a assinar o
--     diploma, e o diploma guarda a assinatura do dia da emissão.
--  2. RECRUTAMENTO — os campos que a empresa precisa para publicar uma vaga
--     de verdade, o acompanhamento da candidatura e a autodeclaração de
--     diversidade (agregada, nunca por pessoa).
--  3. COMUNIDADE — anexo na publicação, busca de colegas e conversa 1:1.
-- ============================================================================


-- ============================================================================
--  1. DOCENTE NO CERTIFICADO
-- ============================================================================

-- --------------------------------------------------------------- no curso --
alter table public.cursos
  add column if not exists instrutor_registro       text,
  add column if not exists instrutor_assinatura_url text;

comment on column public.cursos.instrutor is
  'Docente que ministra o curso. Obrigatório: é quem assina o certificado.';
comment on column public.cursos.instrutor_registro is
  'CRC ou registro profissional, impresso sob a assinatura no certificado.';
comment on column public.cursos.instrutor_assinatura_url is
  'Imagem da assinatura (bucket capas). Sem ela o certificado assina em tipografia.';

-- Curso sem docente emitiria diploma sem assinatura. A trava entra como NOT
-- VALID de propósito: as linhas que já existem seguem como estão (não se
-- reescreve catálogo histórico à força), mas nenhuma inserção ou alteração
-- nova passa sem docente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cursos_docente_obrigatorio'
  ) then
    alter table public.cursos
      add constraint cursos_docente_obrigatorio
      check (instrutor is not null and btrim(instrutor) <> '') not valid;
  end if;
end $$;

-- ---------------------------------------------------- no certificado ------
-- O certificado é documento histórico: se o curso trocar de docente amanhã, o
-- diploma emitido hoje continua assinado por quem realmente ministrou.
alter table public.certificados
  add column if not exists docente_nome            text,
  add column if not exists docente_cargo           text,
  add column if not exists docente_registro        text,
  add column if not exists docente_assinatura_url  text;

-- Emissão: mesma função de sempre, agora guardando quem assina.
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
  v_doc_nome      text;
  v_doc_cargo     text;
  v_doc_registro  text;
  v_doc_assinatura text;
begin
  select c.id, c.carga_horaria, c.pontos_pepc,
         c.instrutor, c.instrutor_cargo, c.instrutor_registro, c.instrutor_assinatura_url
    into v_curso_id, v_carga, v_pepc,
         v_doc_nome, v_doc_cargo, v_doc_registro, v_doc_assinatura
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
    insert into public.certificados (
      perfil_id, curso_id, codigo, carga_horaria, pontos_pepc,
      docente_nome, docente_cargo, docente_registro, docente_assinatura_url
    )
    values (
      new.perfil_id,
      v_curso_id,
      'CBA-' || to_char(now(),'YYYY') || '-' ||
        upper(substr(md5(new.perfil_id::text || v_curso_id::text),1,4)) || '-' ||
        upper(substr(md5(random()::text),1,4)),
      v_carga,
      coalesce(v_pepc,0),
      v_doc_nome, v_doc_cargo, v_doc_registro, v_doc_assinatura
    )
    on conflict (perfil_id, curso_id) do nothing;
  end if;

  return new;
end $$;

-- Certificados já emitidos herdam o docente que o curso tem hoje: é a melhor
-- informação disponível, e melhor que assinatura em branco.
update public.certificados c
   set docente_nome           = cu.instrutor,
       docente_cargo          = cu.instrutor_cargo,
       docente_registro       = cu.instrutor_registro,
       docente_assinatura_url = cu.instrutor_assinatura_url
  from public.cursos cu
 where cu.id = c.curso_id
   and c.docente_nome is null;

-- ------------------------------------------- validação pública do código --
-- Quem confere o certificado (quase sempre um RH sem conta aqui) precisa ver a
-- mesma assinatura que está no documento que recebeu.
create or replace function public.validar_certificado(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_r      record;
begin
  if v_codigo = '' then
    return jsonb_build_object('valido', false, 'motivo', 'sem-codigo');
  end if;

  -- Certificado de curso
  select p.nome as aluno, c.titulo as titulo, 'curso' as tipo,
         cert.carga_horaria, cert.pontos_pepc, cert.emitido_em, cert.codigo,
         c.categoria as area, c.nivel::text as nivel,
         coalesce(cert.docente_nome,           c.instrutor)                as docente,
         coalesce(cert.docente_cargo,          c.instrutor_cargo)          as docente_cargo,
         coalesce(cert.docente_registro,       c.instrutor_registro)       as docente_registro,
         coalesce(cert.docente_assinatura_url, c.instrutor_assinatura_url) as docente_assinatura
    into v_r
  from public.certificados cert
  join public.perfis p on p.id = cert.perfil_id
  join public.cursos c on c.id = cert.curso_id
  where upper(cert.codigo) = v_codigo;

  if found then
    return jsonb_build_object(
      'valido', true, 'tipo', v_r.tipo, 'aluno', v_r.aluno,
      'titulo', v_r.titulo, 'area', v_r.area, 'nivel', v_r.nivel,
      'cargaHoraria', v_r.carga_horaria, 'pontosPEPC', v_r.pontos_pepc,
      'emitidoEm', v_r.emitido_em, 'codigo', v_r.codigo,
      'docente', v_r.docente, 'docenteCargo', v_r.docente_cargo,
      'docenteRegistro', v_r.docente_registro,
      'docenteAssinaturaUrl', v_r.docente_assinatura
    );
  end if;

  -- Certificação de trilha
  select p.nome as aluno, t.nome as titulo, 'trilha' as tipo,
         ct.carga_horaria, ct.pontos_pepc, ct.emitido_em, ct.codigo,
         t.area as area, t.nivel_saida::text as nivel, t.id as trilha_id
    into v_r
  from public.certificados_trilha ct
  join public.perfis p on p.id = ct.perfil_id
  join public.trilhas t on t.id = ct.trilha_id
  where upper(ct.codigo) = v_codigo;

  if found then
    return jsonb_build_object(
      'valido', true, 'tipo', v_r.tipo, 'aluno', v_r.aluno,
      'titulo', v_r.titulo, 'area', v_r.area, 'nivel', v_r.nivel,
      'cargaHoraria', v_r.carga_horaria, 'pontosPEPC', v_r.pontos_pepc,
      'emitidoEm', v_r.emitido_em, 'codigo', v_r.codigo,
      'habilidades', coalesce((
        select jsonb_agg(h.nome order by th.nivel_esperado desc)
        from public.trilha_habilidades th
        join public.habilidades h on h.id = th.habilidade_id
        where th.trilha_id = v_r.trilha_id
      ), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object('valido', false, 'motivo', 'nao-encontrado');
end
$fn$;

revoke all on function public.validar_certificado(text) from public;
grant execute on function public.validar_certificado(text) to anon, authenticated;


-- ============================================================================
--  2. RECRUTAMENTO
-- ============================================================================

-- ---------------------------------------------------------- campos da vaga --
--
--  Sobre filtrar candidato por idade ou cor: a Lei 9.029/1995 proíbe prática
--  discriminatória no acesso ao emprego por sexo, origem, raça, cor, estado
--  civil, situação familiar, deficiência e idade. Por isso aqui NÃO existe
--  filtro de idade nem de cor sobre candidatos. O que existe é o caminho
--  legal, e é o mesmo que as plataformas grandes usam:
--
--   · a vaga pode ser afirmativa (reservada ou preferencial para um grupo);
--   · a vaga pode ser PCD, que é cota prevista na Lei 8.213/1991, art. 93;
--   · a autodeclaração do candidato é opcional e só aparece agregada.
--
--  Requisito objetivo (experiência, escolaridade, jornada) pode ser exigido —
--  e é isso que os campos abaixo cobrem.
alter table public.vagas
  add column if not exists beneficios            text[] not null default '{}',
  add column if not exists jornada               text,
  add column if not exists escolaridade          text,
  add column if not exists experiencia_min_anos  integer,
  add column if not exists pcd                   boolean not null default false,
  add column if not exists afirmativa_para       text[] not null default '{}',
  add column if not exists acessibilidade        text,
  add column if not exists sigilosa              boolean not null default false;

comment on column public.vagas.pcd is
  'Vaga reservada a pessoa com deficiência (cota da Lei 8.213/1991, art. 93).';
comment on column public.vagas.afirmativa_para is
  'Grupos a que a vaga é afirmativa. Ação afirmativa é lícita; filtro discriminatório não.';
comment on column public.vagas.acessibilidade is
  'Recursos de acessibilidade do posto — o que a pessoa precisa saber antes de se candidatar.';
comment on column public.vagas.sigilosa is
  'Vaga confidencial: o mural mostra a vaga sem identificar a empresa.';
comment on column public.vagas.experiencia_min_anos is
  'Requisito objetivo de experiência. Substitui o "filtro de idade", que é ilegal.';

create index if not exists vagas_empresa_idx on public.vagas (empresa_id, publicada_em desc);

-- ------------------------------------------- acompanhamento da candidatura --
alter table public.candidaturas
  add column if not exists atualizada_em   timestamptz not null default now(),
  add column if not exists visualizada_em  timestamptz,
  add column if not exists nota_interna    text;

comment on column public.candidaturas.nota_interna is
  'Anotação da empresa sobre o candidato. Nunca é exibida para o candidato.';

create or replace function public.candidaturas_marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizada_em := now();
  return new;
end $$;

drop trigger if exists trg_candidatura_atualizada on public.candidaturas;
create trigger trg_candidatura_atualizada
  before update on public.candidaturas
  for each row execute function public.candidaturas_marca_atualizacao();

-- O aluno lê a própria candidatura (policy antiga) mas não deve ler a anotação
-- interna da empresa. Como RLS é por linha e não por coluna, a anotação sai da
-- resposta pela view que o app usa; o acesso direto continua restrito ao dono
-- da linha e à empresa da vaga.
revoke update (nota_interna) on public.candidaturas from authenticated;
grant  update (status, mensagem) on public.candidaturas to authenticated;

-- A empresa precisa gravar anotação e marcar como visualizada.
drop policy if exists "candidaturas: empresa move o status" on public.candidaturas;
create policy "candidaturas: empresa move o status" on public.candidaturas
  for update using (
    exists (select 1 from public.vagas v
             where v.id = candidaturas.vaga_id and public.is_membro_empresa(v.empresa_id))
  ) with check (
    exists (select 1 from public.vagas v
             where v.id = candidaturas.vaga_id and public.is_membro_empresa(v.empresa_id))
  );

grant update (nota_interna, visualizada_em, status) on public.candidaturas to authenticated;

-- ------------------------------------------------ autodeclaração opcional --
--
--  Tabela separada de propósito. Em `perfis` estes dados seriam legíveis por
--  qualquer pessoa que enxerga o perfil público — e demografia por indivíduo é
--  exatamente o que não pode circular. Aqui só o dono lê a própria linha; a
--  empresa vê contagem, por função, e só quando há gente suficiente para não
--  identificar ninguém.
create table if not exists public.perfil_diversidade (
  perfil_id      uuid primary key references public.perfis(id) on delete cascade,
  pcd            boolean,
  pcd_tipo       text,
  genero         text,
  raca_cor       text,
  atualizado_em  timestamptz not null default now()
);

alter table public.perfil_diversidade enable row level security;

drop policy if exists "diversidade: só a própria pessoa" on public.perfil_diversidade;
create policy "diversidade: só a própria pessoa" on public.perfil_diversidade
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create or replace function public.salvar_minha_diversidade(
  p_pcd boolean, p_pcd_tipo text, p_genero text, p_raca_cor text
)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Sem sessão'; end if;
  insert into public.perfil_diversidade (perfil_id, pcd, pcd_tipo, genero, raca_cor, atualizado_em)
  values (auth.uid(), p_pcd, nullif(btrim(p_pcd_tipo), ''), nullif(btrim(p_genero), ''),
          nullif(btrim(p_raca_cor), ''), now())
  on conflict (perfil_id) do update
    set pcd = excluded.pcd, pcd_tipo = excluded.pcd_tipo,
        genero = excluded.genero, raca_cor = excluded.raca_cor,
        atualizado_em = now();
end $fn$;

create or replace function public.minha_diversidade()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v jsonb;
begin
  select to_jsonb(d) - 'perfil_id' into v
  from public.perfil_diversidade d where d.perfil_id = auth.uid();
  return coalesce(v, '{}'::jsonb);
end $fn$;

/*
  Representatividade das candidaturas de uma vaga.

  Devolve contagem, nunca pessoa. E devolve só a partir de 5 candidaturas
  declaradas: abaixo disso "1 pessoa parda" num grupo de duas identifica quem
  é, o que anularia o sentido de a declaração ser voluntária.
*/
create or replace function public.empresa_diversidade_da_vaga(p_vaga uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_empresa uuid;
  v_total   integer;
  v_min     constant integer := 5;
begin
  select empresa_id into v_empresa from public.vagas where id = p_vaga;
  if v_empresa is null then return jsonb_build_object('disponivel', false); end if;
  if not (public.is_admin() or public.is_membro_empresa(v_empresa)) then
    raise exception 'Sem permissão para ver esta vaga';
  end if;

  select count(*) into v_total
  from public.candidaturas c
  join public.perfil_diversidade d on d.perfil_id = c.perfil_id
  where c.vaga_id = p_vaga;

  if v_total < v_min then
    return jsonb_build_object(
      'disponivel', false, 'declaradas', v_total, 'minimo', v_min
    );
  end if;

  return jsonb_build_object(
    'disponivel', true,
    'declaradas', v_total,
    'pcd', (select count(*) from public.candidaturas c
              join public.perfil_diversidade d on d.perfil_id = c.perfil_id
             where c.vaga_id = p_vaga and d.pcd),
    'genero', coalesce((
      select jsonb_object_agg(coalesce(d.genero, 'Não informado'), n)
      from (
        select d.genero, count(*) as n
        from public.candidaturas c
        join public.perfil_diversidade d on d.perfil_id = c.perfil_id
        where c.vaga_id = p_vaga
        group by d.genero
      ) d
    ), '{}'::jsonb),
    'racaCor', coalesce((
      select jsonb_object_agg(coalesce(d.raca_cor, 'Não informado'), n)
      from (
        select d.raca_cor, count(*) as n
        from public.candidaturas c
        join public.perfil_diversidade d on d.perfil_id = c.perfil_id
        where c.vaga_id = p_vaga
        group by d.raca_cor
      ) d
    ), '{}'::jsonb)
  );
end $fn$;

-- ------------------------------------------------------ ficha do candidato --
-- Reafirmada aqui porque a versão do 10_ exigia admin: se aquele arquivo for
-- rodado de novo depois do 18_, a empresa volta a ver "ninguém se candidatou"
-- numa vaga com candidatos. Esta versão também traz contato e anotação.
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
      'atualizada_em',  c.atualizada_em,
      'visualizada_em', c.visualizada_em,
      'nota_interna',   c.nota_interna,
      'mensagem',       c.mensagem,
      'perfil', jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'email', p.email, 'cargo', p.cargo,
        'cidade', p.cidade, 'uf', p.uf, 'senioridade', p.senioridade,
        'bio', p.bio, 'pretensao', p.pretensao, 'disponivel', p.disponivel,
        'telefone', p.telefone, 'linkedin', p.linkedin, 'crc', p.crc,
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

/*
  Resumo das vagas da empresa: uma chamada em vez de uma por vaga.

  A contagem por etapa vem daqui porque a tela precisa dela antes de abrir
  qualquer vaga — é o que responde "onde o funil está parado".
*/
create or replace function public.empresa_vagas_resumo()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_empresa uuid; v jsonb;
begin
  v_empresa := public.minha_empresa_id();
  if v_empresa is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by x ->> 'publicada_em' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'vaga_id',      v.id,
      'titulo',       v.titulo,
      'ativa',        v.ativa,
      'publicada_em', v.publicada_em,
      'total',        count(c.id),
      'novas_7d',     count(c.id) filter (where c.criada_em > now() - interval '7 days'),
      'nao_vistas',   count(c.id) filter (where c.visualizada_em is null),
      -- Contagem por etapa: `jsonb_object_agg(status, 1)` sobrescreveria a
      -- chave e devolveria 1 em toda etapa. A contagem tem que vir agrupada.
      'por_status', coalesce((
        select jsonb_object_agg(s2.status, s2.n)
        from (
          select c2.status::text as status, count(*) as n
          from public.candidaturas c2
          where c2.vaga_id = v.id
          group by c2.status
        ) s2
      ), '{}'::jsonb),
      'ultima',       max(c.criada_em)
    ) as x
    from public.vagas v
    left join public.candidaturas c on c.vaga_id = v.id
    where v.empresa_id = v_empresa
    group by v.id, v.titulo, v.ativa, v.publicada_em
  ) s;

  return v;
end
$fn$;


-- ============================================================================
--  3. COMUNIDADE
-- ============================================================================

-- ------------------------------------------------- anexo na publicação ----
-- Uma coluna jsonb em vez de tabela: o anexo não tem vida própria fora do
-- post, não é consultado isoladamente e nunca passa de meia dúzia por
-- publicação. Cada item é { tipo, url, nome, bytes }.
alter table public.posts
  add column if not exists midias jsonb not null default '[]'::jsonb;

comment on column public.posts.midias is
  'Anexos da publicação: [{tipo, url, nome, bytes}]. Arquivos no bucket comunidade.';

-- O bucket é público na leitura porque a imagem aparece no feed de todo mundo;
-- a escrita é restrita à própria pasta, como nos avatares.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comunidade', 'comunidade', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
on conflict (id) do nothing;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'cba: comunidade%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "cba: comunidade leitura" on storage.objects for select
  using (bucket_id = 'comunidade');
create policy "cba: comunidade envia" on storage.objects for insert
  with check (
    bucket_id = 'comunidade'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "cba: comunidade apaga o próprio" on storage.objects for delete
  using (
    bucket_id = 'comunidade'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------ busca de colegas --
/*
  A busca que faltava.

  O feed mostrava quatro sugestões fixas e não tinha campo de busca: em
  produção não havia como achar um colega pelo nome. Esta função procura entre
  quem publicou o perfil e devolve, junto, em que pé está a conexão com quem
  perguntou — sem isso a tela não sabe se o botão é "conectar", "aguardando"
  ou "conversar".
*/
create or replace function public.buscar_colegas(p_termo text default '', p_limite integer default 24)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_eu   uuid := auth.uid();
  v_q    text := lower(btrim(coalesce(p_termo, '')));
  v      jsonb;
begin
  if v_eu is null then raise exception 'Sem sessão'; end if;

  select coalesce(jsonb_agg(x order by x ->> 'nome'), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'cargo', p.cargo, 'cidade', p.cidade,
      'uf', p.uf, 'senioridade', p.senioridade, 'nivel', p.nivel,
      'avatarUrl', p.avatar_url, 'crc', p.crc,
      'habilidades', coalesce((
        select jsonb_agg(h.nome order by ph.nivel desc)
        from public.perfil_habilidades ph
        join public.habilidades h on h.id = ph.habilidade_id
        where ph.perfil_id = p.id), '[]'::jsonb),
      'conexao', (
        select jsonb_build_object(
          'id', cx.id, 'status', cx.status,
          'souSolicitante', cx.solicitante_id = v_eu
        )
        from public.conexoes cx
        where (cx.solicitante_id = v_eu and cx.destinatario_id = p.id)
           or (cx.destinatario_id = v_eu and cx.solicitante_id = p.id)
        limit 1
      )
    ) as x, p.nome
    from public.perfis p
    where p.perfil_publico
      and p.id <> v_eu
      and p.role <> 'empresa'
      and (
        v_q = ''
        or lower(p.nome)   like '%' || v_q || '%'
        or lower(coalesce(p.cargo, ''))  like '%' || v_q || '%'
        or lower(coalesce(p.cidade, '')) like '%' || v_q || '%'
        or exists (
          select 1 from public.perfil_habilidades ph
          join public.habilidades h on h.id = ph.habilidade_id
          where ph.perfil_id = p.id and lower(h.nome) like '%' || v_q || '%'
        )
      )
    order by p.nome
    limit greatest(1, least(coalesce(p_limite, 24), 60))
  ) s;

  return v;
end
$fn$;

-- ------------------------------------------------------------- conversas --
--
-- `conversas` tem unique (a_id, b_id): sem normalizar a ordem, (A,B) e (B,A)
-- viram duas conversas para o mesmo par e as mensagens se dividem em duas
-- caixas. Aqui o par é sempre gravado em ordem crescente de uuid.
create or replace function public.abrir_conversa(p_outro uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_eu   uuid := auth.uid();
  v_a    uuid;
  v_b    uuid;
  v_id   uuid;
begin
  if v_eu is null then raise exception 'Sem sessão'; end if;
  if p_outro is null or p_outro = v_eu then raise exception 'Conversa precisa de outra pessoa'; end if;

  -- Conversa exige conexão aceita. É o que separa "rede" de "caixa de entrada
  -- aberta": sem isso, qualquer pessoa manda mensagem para qualquer uma.
  if not exists (
    select 1 from public.conexoes c
    where c.status = 'aceita'
      and ((c.solicitante_id = v_eu and c.destinatario_id = p_outro)
        or (c.destinatario_id = v_eu and c.solicitante_id = p_outro))
  ) and not public.is_admin() then
    raise exception 'Vocês ainda não são colegas conectados';
  end if;

  v_a := least(v_eu, p_outro);
  v_b := greatest(v_eu, p_outro);

  select id into v_id from public.conversas where a_id = v_a and b_id = v_b;
  if v_id is null then
    insert into public.conversas (a_id, b_id) values (v_a, v_b) returning id into v_id;
  end if;
  return v_id;
end
$fn$;

-- Mensagem nova empurra a conversa para o topo da lista.
create or replace function public.conversa_toca_atualizacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversas set atualizado_em = now() where id = new.conversa_id;
  return new;
end $$;

drop trigger if exists trg_conversa_atualizada on public.mensagens;
create trigger trg_conversa_atualizada
  after insert on public.mensagens
  for each row execute function public.conversa_toca_atualizacao();

-- Quem recebeu marca como lida. Faltava a policy de update: sem ela o
-- contador de não lidas nunca zerava.
drop policy if exists "mensagens: destinatário marca lida" on public.mensagens;
create policy "mensagens: destinatário marca lida" on public.mensagens
  for update using (
    remetente_id <> auth.uid()
    and exists (select 1 from public.conversas c
                 where c.id = conversa_id and (c.a_id = auth.uid() or c.b_id = auth.uid()))
  ) with check (
    remetente_id <> auth.uid()
    and exists (select 1 from public.conversas c
                 where c.id = conversa_id and (c.a_id = auth.uid() or c.b_id = auth.uid()))
  );

/*
  A caixa de entrada: uma chamada devolve as conversas, com quem é cada uma,
  a última mensagem e quantas faltam ler.
*/
create or replace function public.minhas_conversas()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_eu uuid := auth.uid(); v jsonb;
begin
  if v_eu is null then raise exception 'Sem sessão'; end if;

  select coalesce(jsonb_agg(x order by x ->> 'atualizadoEm' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id',           cv.id,
      'atualizadoEm', cv.atualizado_em,
      'outro', jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'cargo', p.cargo, 'avatarUrl', p.avatar_url
      ),
      'ultima', (
        select jsonb_build_object(
          'conteudo', m.conteudo, 'criadoEm', m.criado_em, 'minha', m.remetente_id = v_eu
        )
        from public.mensagens m
        where m.conversa_id = cv.id
        order by m.criado_em desc limit 1
      ),
      'naoLidas', (
        select count(*) from public.mensagens m
        where m.conversa_id = cv.id and m.remetente_id <> v_eu and not m.lida
      )
    ) as x, cv.atualizado_em
    from public.conversas cv
    join public.perfis p
      on p.id = case when cv.a_id = v_eu then cv.b_id else cv.a_id end
    where cv.a_id = v_eu or cv.b_id = v_eu
    order by cv.atualizado_em desc
    limit 50
  ) s;

  return v;
end
$fn$;


-- ============================================================================
--  4. PERMISSÕES DAS FUNÇÕES NOVAS
--     Nenhuma delas é para visitante sem conta.
-- ============================================================================
do $g$
declare f text;
begin
  foreach f in array array[
    'salvar_minha_diversidade(boolean, text, text, text)',
    'minha_diversidade()',
    'empresa_diversidade_da_vaga(uuid)',
    'empresa_vagas_resumo()',
    'buscar_colegas(text, integer)',
    'abrir_conversa(uuid)',
    'minhas_conversas()',
    'candidatos_da_vaga(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('revoke execute on function public.%s from anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$g$;

-- Funções de gatilho não são endpoint.
revoke all on function public.candidaturas_marca_atualizacao() from public;
revoke execute on function public.candidaturas_marca_atualizacao() from anon, authenticated;
revoke all on function public.conversa_toca_atualizacao() from public;
revoke execute on function public.conversa_toca_atualizacao() from anon, authenticated;


-- ============================================================================
--  CONFERÊNCIA — rode para ver se tudo entrou
-- ============================================================================
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='cursos'
       and column_name in ('instrutor_registro','instrutor_assinatura_url'))      as colunas_docente_curso,   -- 2
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='certificados'
       and column_name like 'docente%')                                           as colunas_docente_cert,    -- 4
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='vagas'
       and column_name in ('beneficios','jornada','escolaridade','experiencia_min_anos',
                           'pcd','afirmativa_para','acessibilidade','sigilosa'))   as colunas_vaga,            -- 8
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='candidaturas'
       and column_name in ('atualizada_em','visualizada_em','nota_interna'))       as colunas_candidatura,     -- 3
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='perfil_diversidade')              as tabela_diversidade,      -- 1
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='posts' and column_name='midias')  as coluna_midias,           -- 1
  (select count(*) from storage.buckets where id='comunidade')                     as bucket_comunidade,       -- 1
  (select count(*) from pg_proc where pronamespace='public'::regnamespace
     and proname in ('buscar_colegas','abrir_conversa','minhas_conversas',
                     'empresa_vagas_resumo','empresa_diversidade_da_vaga',
                     'salvar_minha_diversidade','minha_diversidade'))              as funcoes_novas;           -- 7
