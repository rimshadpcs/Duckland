create table if not exists public.study_units (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_concepts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  unit_id uuid references public.study_units(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'gap_found', 'improving', 'clear')),
  latest_clarity_score integer check (
    latest_clarity_score is null or (latest_clarity_score >= 0 and latest_clarity_score <= 100)
  ),
  main_gap text,
  prerequisite_concept_ids uuid[] not null default '{}'::uuid[],
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_units_room_id_idx on public.study_units(room_id);
create index if not exists study_units_user_id_idx on public.study_units(user_id);
create index if not exists room_concepts_room_id_idx on public.room_concepts(room_id);
create index if not exists room_concepts_unit_id_idx on public.room_concepts(unit_id);
create index if not exists room_concepts_user_id_idx on public.room_concepts(user_id);
create index if not exists room_concepts_status_idx on public.room_concepts(status);
create unique index if not exists room_concepts_room_title_key
on public.room_concepts(room_id, lower(title));

drop trigger if exists study_units_set_updated_at on public.study_units;
create trigger study_units_set_updated_at
before update on public.study_units
for each row
execute function public.set_updated_at();

drop trigger if exists room_concepts_set_updated_at on public.room_concepts;
create trigger room_concepts_set_updated_at
before update on public.room_concepts
for each row
execute function public.set_updated_at();

alter table public.study_units enable row level security;
alter table public.room_concepts enable row level security;

drop policy if exists "Users can read their own study units" on public.study_units;
create policy "Users can read their own study units"
on public.study_units
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own study units" on public.study_units;
create policy "Users can create their own study units"
on public.study_units
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study units" on public.study_units;
create policy "Users can update their own study units"
on public.study_units
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study units" on public.study_units;
create policy "Users can delete their own study units"
on public.study_units
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own room concepts" on public.room_concepts;
create policy "Users can read their own room concepts"
on public.room_concepts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own room concepts" on public.room_concepts;
create policy "Users can create their own room concepts"
on public.room_concepts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own room concepts" on public.room_concepts;
create policy "Users can update their own room concepts"
on public.room_concepts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own room concepts" on public.room_concepts;
create policy "Users can delete their own room concepts"
on public.room_concepts
for delete
to authenticated
using (auth.uid() = user_id);
