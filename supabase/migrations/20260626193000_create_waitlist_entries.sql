create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  school text,
  student_type text,
  study_focus text,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

alter table public.waitlist_entries enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist_entries;
create policy "Anyone can join the waitlist"
  on public.waitlist_entries
  for insert
  to anon, authenticated
  with check (true);
