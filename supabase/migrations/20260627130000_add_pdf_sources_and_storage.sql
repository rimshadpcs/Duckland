alter table public.sources
  add column if not exists original_file_name text,
  add column if not exists storage_path text,
  add column if not exists page_count integer,
  add column if not exists extracted_text_length integer,
  add column if not exists extraction_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sources_extraction_status_check'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources
      add constraint sources_extraction_status_check
      check (
        extraction_status is null
        or extraction_status in ('uploading', 'extracting', 'complete', 'failed')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'study-files'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('study-files', 'study-files', false, 10485760, array['application/pdf']);
  else
    update storage.buckets
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array['application/pdf']
    where id = 'study-files';
  end if;
end $$;

drop policy if exists "Users can read their own study files" on storage.objects;
create policy "Users can read their own study files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their own study files" on storage.objects;
create policy "Users can upload their own study files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own study files" on storage.objects;
create policy "Users can update their own study files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own study files" on storage.objects;
create policy "Users can delete their own study files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'study-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
