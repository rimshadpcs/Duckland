alter table public.room_concepts
  add column if not exists best_clarity_score integer check (
    best_clarity_score is null or (best_clarity_score >= 0 and best_clarity_score <= 100)
  ),
  add column if not exists latest_review_score integer check (
    latest_review_score is null or (latest_review_score >= 0 and latest_review_score <= 100)
  ),
  add column if not exists last_reviewed_at timestamptz;

update public.room_concepts
set best_clarity_score = latest_clarity_score
where best_clarity_score is null
  and latest_clarity_score is not null;
