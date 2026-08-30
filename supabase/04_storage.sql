-- ============================================================================
--  CASTELO BRANCO ACADEMY — 04. STORAGE
--  Rode DEPOIS do 03_usuarios_demo.sql. Idempotente.
--  Cria os buckets de arquivos e as regras de acesso.
-- ============================================================================

-- --------------------------------------------------------------- buckets --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatares',     'avatares',     true,  2097152,   array['image/png','image/jpeg','image/webp']),
  ('capas',        'capas',        true,  5242880,   array['image/png','image/jpeg','image/webp']),
  ('materiais',    'materiais',    false, 52428800,  null),
  ('certificados', 'certificados', false, 5242880,   array['application/pdf']),
  ('videos',       'videos',       false, 5368709120, null)
on conflict (id) do nothing;

-- NOTA sobre listagem de buckets --------------------------------------------
-- storage.buckets pertence ao papel supabase_storage_admin, e o SQL Editor
-- roda como postgres. Criar policy nessa tabela devolve
--   ERROR: 42501: must be owner of table buckets
-- Por isso NÃO mexemos nela. O cliente não consegue listar os buckets, e isso
-- é o comportamento padrão do Supabase. A página /diagnostico contorna
-- verificando a existência de um bucket conhecido em vez de listar todos.

-- Limpa policies antigas de storage deste projeto ---------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'cba:%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- --------------------------------------------------------------- avatares --
-- Público para leitura; cada pessoa só escreve na própria pasta (<uid>/arquivo)
create policy "cba: avatares leitura" on storage.objects for select
  using (bucket_id = 'avatares');

create policy "cba: avatares escrita própria" on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "cba: avatares atualiza própria" on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "cba: avatares apaga própria" on storage.objects for delete
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------ capas --
create policy "cba: capas leitura" on storage.objects for select
  using (bucket_id = 'capas');

create policy "cba: capas admin escreve" on storage.objects for all
  using (bucket_id = 'capas' and public.is_admin())
  with check (bucket_id = 'capas' and public.is_admin());

-- ------------------------------------------------------------- materiais --
-- Privado. Leitura via URL assinada, só para quem está autenticado.
create policy "cba: materiais leitura autenticada" on storage.objects for select
  using (bucket_id = 'materiais' and auth.role() = 'authenticated');

create policy "cba: materiais admin escreve" on storage.objects for all
  using (bucket_id = 'materiais' and public.is_admin())
  with check (bucket_id = 'materiais' and public.is_admin());

-- ---------------------------------------------------------- certificados --
-- Cada pessoa lê apenas os próprios PDFs (pasta = uid).
create policy "cba: certificados leitura própria" on storage.objects for select
  using (
    bucket_id = 'certificados'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "cba: certificados admin escreve" on storage.objects for all
  using (bucket_id = 'certificados' and public.is_admin())
  with check (bucket_id = 'certificados' and public.is_admin());

-- ----------------------------------------------------------------- vídeos --
-- Bucket de passagem: o vídeo definitivo vive no provedor de streaming.
-- Só o admin toca aqui; o aluno nunca acessa este bucket diretamente.
create policy "cba: videos admin" on storage.objects for all
  using (bucket_id = 'videos' and public.is_admin())
  with check (bucket_id = 'videos' and public.is_admin());

-- ============================================================================
--  Conferência
-- ============================================================================
select id, public, file_size_limit from storage.buckets order by id;
-- Esperado: avatares(t) | capas(t) | certificados(f) | materiais(f) | videos(f)
