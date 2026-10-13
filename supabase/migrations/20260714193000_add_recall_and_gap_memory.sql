-- Retention layer for Today’s Study Plan, due recall, and durable gap memory.
-- Existing `in_progress` rows are mapped to the clearer `explaining` state.

alter table public.room_concepts
  drop constraint if exists room_concepts_status_check;

update public.room_concepts
set status = 'explaining'
where status = 'in_progress';

alter table public.room_concepts
  add constraint room_concepts_status_check check (
    status in (
      'not_started',
      'explaining',
      'gap_found',
      'improving',
      'clear',
      'needs_recall',
      'due_for_review'
    )
  ),
  add column if not exists next_review_at timestamptz,
  add column if not exists review_count integer not null default 0 check (review_count >= 0),
  add column if not exists recall_status text not null default 'not_scheduled' check (
    recall_status in ('not_scheduled', 'scheduled', 'due')
  ),
  add column if not exists main_unresolved_gap text,
  add column if not exists last_socratic_question text,
  add column if not exists last_wrong_assumption text,
  add column if not exists last_missing_relationship text,
  add column if not exists last_improved_explanation text;

update public.room_concepts
set main_unresolved_gap = main_gap
where main_unresolved_gap is null
  and main_gap is not null;

-- Existing clear concepts enter the first recall interval without losing their
-- original completion date. The app derives `due_for_review` when this date passes.
update public.room_concepts
set
  next_review_at = coalesce(completed_at, last_activity_at, now()) + interval '1 day',
  recall_status = 'scheduled'
where status = 'clear'
  and next_review_at is null;

create index if not exists room_concepts_next_review_at_idx
on public.room_concepts(user_id, next_review_at)
where next_review_at is not null;

