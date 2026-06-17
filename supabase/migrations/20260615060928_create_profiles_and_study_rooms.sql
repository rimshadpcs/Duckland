create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  source_material text,
  clarity_score integer check (clarity_score is null or (clarity_score >= 0 and clarity_score <= 100)),
  weak_spots_count integer not null default 0 check (weak_spots_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_studied_at timestamptz
);

create index study_rooms_user_id_idx on public.study_rooms(user_id);
create index study_rooms_last_studied_at_idx on public.study_rooms(user_id, last_studied_at desc nulls last);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger study_rooms_set_updated_at
before update on public.study_rooms
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.study_rooms enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their own study rooms"
on public.study_rooms
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own study rooms"
on public.study_rooms
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own study rooms"
on public.study_rooms
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own study rooms"
on public.study_rooms
for delete
to authenticated
using (auth.uid() = user_id);
