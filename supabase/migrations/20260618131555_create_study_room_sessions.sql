create table if not exists public.study_room_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_sessions_room_id_key unique (room_id)
);

create index if not exists study_room_sessions_user_id_idx
on public.study_room_sessions(user_id);

alter table public.study_room_sessions enable row level security;

drop policy if exists "Users can read their own study room sessions" on public.study_room_sessions;
create policy "Users can read their own study room sessions"
on public.study_room_sessions
for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_sessions.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their own study room sessions" on public.study_room_sessions;
create policy "Users can create their own study room sessions"
on public.study_room_sessions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_sessions.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their own study room sessions" on public.study_room_sessions;
create policy "Users can update their own study room sessions"
on public.study_room_sessions
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_sessions.room_id
      and study_rooms.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_sessions.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own study room sessions" on public.study_room_sessions;
create policy "Users can delete their own study room sessions"
on public.study_room_sessions
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_sessions.room_id
      and study_rooms.user_id = auth.uid()
  )
);

drop trigger if exists study_room_sessions_set_updated_at on public.study_room_sessions;
create trigger study_room_sessions_set_updated_at
before update on public.study_room_sessions
for each row
execute function public.set_updated_at();
