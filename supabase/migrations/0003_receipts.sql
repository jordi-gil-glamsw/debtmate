-- DebtMate · receipt photos. OPTIONAL: only needed when receipt photos are enabled
-- (EXPO_PUBLIC_RECEIPT_PHOTOS=1, see src/config/features.ts). Uses Supabase Storage.
-- The movement keeps the photo's file name; the image lives in the private Storage bucket
-- "receipts" under a folder named after the owner's user id: receipts/<user id>/<file name>.

alter table public.movements add column if not exists receipt text
  check (receipt is null or receipt ~ '^[0-9a-f-]{36}\.jpg$');

-- Private bucket: images are only reachable through signed URLs. 5 MB per photo, JPEG only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Each signed-in user can only touch objects inside their own folder.
create policy "receipts: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

create policy "receipts: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

create policy "receipts: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

create policy "receipts: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
