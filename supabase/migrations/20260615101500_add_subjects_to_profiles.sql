alter table public.profiles
  add column if not exists subjects jsonb not null default '[]'::jsonb;
