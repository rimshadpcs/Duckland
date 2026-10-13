-- Onboarding asks what the learner wants Feynduck for (exam revision, coursework, ...).
alter table public.profiles
  add column if not exists study_goals jsonb not null default '[]'::jsonb;
