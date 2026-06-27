alter table public.sources
  drop constraint if exists sources_one_active_source_per_room;

alter table public.sources
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true;

create index if not exists sources_room_sort_idx
  on public.sources(room_id, sort_order, created_at);

create index if not exists sources_room_active_idx
  on public.sources(room_id, is_active);
