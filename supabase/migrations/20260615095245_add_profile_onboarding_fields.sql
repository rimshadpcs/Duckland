alter table public.profiles
  add column if not exists education_stage text,
  add column if not exists education_country text,
  add column if not exists year_of_study text,
  add column if not exists qualification_type text,
  add column if not exists subject_area text,
  add column if not exists course_name text,
  add column if not exists institution_name text,
  add column if not exists institution_country text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step integer not null default 1;

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step between 1 and 8);
