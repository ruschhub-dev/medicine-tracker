-- ============================================================
-- Fotos das embalagens (Supabase Storage), organizadas por família.
-- Rode DEPOIS de 02_rls.sql (usa o helper is_member).
-- Caminho dos arquivos: "<familia_id>/<uuid>.<ext>" (ver src/lib/supabaseRepo.ts).
-- Leitura é pública (URL pública direta); enviar/alterar/apagar exige ser membro
-- da família dona da pasta.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Primeiro segmento do caminho = familia_id da pasta.
drop policy if exists fotos_insert on storage.objects;
create policy fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists fotos_update on storage.objects;
create policy fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists fotos_delete on storage.objects;
create policy fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and is_member(((storage.foldername(name))[1])::uuid));
