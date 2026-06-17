create extension if not exists pgcrypto;

alter table public.study_rooms
  add column if not exists description text,
  add column if not exists selected_concept text,
  add column if not exists latest_clarity_score integer,
  add column if not exists status text not null default 'not_started',
  add column if not exists last_activity_at timestamptz not null default now();

alter table public.study_rooms
  add constraint study_rooms_status_check
  check (status in ('not_started', 'in_progress', 'clear')) not valid;

alter table public.study_rooms
  add constraint study_rooms_latest_clarity_score_check
  check (latest_clarity_score is null or (latest_clarity_score >= 0 and latest_clarity_score <= 100)) not valid;

update public.study_rooms
set
  latest_clarity_score = coalesce(latest_clarity_score, clarity_score),
  last_activity_at = coalesce(last_activity_at, last_studied_at, updated_at, created_at, now())
where latest_clarity_score is null or last_activity_at is null;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'pasted_text',
  title text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_source_type_check check (source_type in ('pasted_text', 'pdf', 'pptx', 'docx', 'url', 'transcript')),
  constraint sources_one_active_source_per_room unique (room_id)
);

create index if not exists study_rooms_user_last_activity_idx
on public.study_rooms(user_id, last_activity_at desc);

create index if not exists sources_user_id_idx
on public.sources(user_id);

create index if not exists sources_room_id_idx
on public.sources(room_id);

alter table public.sources enable row level security;

drop policy if exists "Users can read their own sources" on public.sources;
create policy "Users can read their own sources"
on public.sources
for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = sources.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their own sources" on public.sources;
create policy "Users can create their own sources"
on public.sources
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = sources.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their own sources" on public.sources;
create policy "Users can update their own sources"
on public.sources
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = sources.room_id
      and study_rooms.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = sources.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own sources" on public.sources;
create policy "Users can delete their own sources"
on public.sources
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = sources.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop trigger if exists sources_set_updated_at on public.sources;
create trigger sources_set_updated_at
before update on public.sources
for each row
execute function public.set_updated_at();

create or replace function public.touch_room_last_activity_from_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.study_rooms
  set last_activity_at = now(), updated_at = now()
  where id = coalesce(new.room_id, old.room_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists sources_touch_room_last_activity on public.sources;
create trigger sources_touch_room_last_activity
after insert or update or delete on public.sources
for each row
execute function public.touch_room_last_activity_from_source();
