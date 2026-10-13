alter table public.waitlist_entries
  alter column created_at drop default;

alter table public.waitlist_entries
  alter column created_at type date
  using (created_at at time zone 'UTC')::date;

alter table public.waitlist_entries
  alter column created_at set default current_date;
