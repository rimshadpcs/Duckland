grant insert on table public.waitlist_entries to anon, authenticated;
grant select, insert, update, delete on table public.waitlist_entries to service_role;

notify pgrst, 'reload schema';
