update public.room_concepts role_concept
set
  title = 'Next-token prediction',
  updated_at = now()
where lower(role_concept.title) = 'role of predictions'
  and not exists (
    select 1
    from public.room_concepts existing
    where existing.room_id = role_concept.room_id
      and lower(existing.title) = 'next-token prediction'
  );

delete from public.room_concepts role_concept
where lower(role_concept.title) = 'role of predictions'
  and exists (
    select 1
    from public.room_concepts existing
    where existing.room_id = role_concept.room_id
      and lower(existing.title) = 'next-token prediction'
  );

update public.study_rooms
set
  selected_concept = 'Next-token prediction',
  updated_at = now()
where lower(coalesce(selected_concept, '')) = 'role of predictions';

update public.study_room_sessions
set
  state = replace(state::text, 'Role of Predictions', 'Next-token prediction')::jsonb,
  updated_at = now()
where state::text like '%Role of Predictions%';
