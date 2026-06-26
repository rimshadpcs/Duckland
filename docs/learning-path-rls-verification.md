# Learning Path RLS Verification

Status: blocked before live two-account verification could begin.

This file intentionally avoids real user emails, UUIDs, API keys, and secrets.

## Environment

- App: Feynduck learning path feature
- Required runtime: Node 22
- Verification scope: study rooms, pasted sources, study units, room concepts, and study session data

## Account A Checklist

- [x] Attempt to create Account A through public Supabase sign-up.
- [ ] Sign in with Account A.
- [ ] Create a study room.
- [ ] Save source material.
- [ ] Generate a learning path.
- [ ] Open one concept and submit an explanation.
- [ ] Confirm the room appears in Supabase for Account A.
- [ ] Confirm the source appears in Supabase for Account A.
- [ ] Confirm study units appear in Supabase for Account A.
- [ ] Confirm room concepts appear in Supabase for Account A.
- [ ] Confirm concept status and clarity update after evaluation.

Result: Account A sign-up returned a user but no session, which indicates email confirmation is required before the account can sign in. The data-access checks were not run.

## Account B Checklist

- [x] Attempt to create Account B through public Supabase sign-up.
- [ ] Sign in with Account B.
- [ ] Open `/study`.
- [ ] Confirm Account A's room does not appear.
- [ ] Attempt to open Account A's room overview URL.
- [ ] Confirm Account B cannot access room details.
- [ ] Confirm Account B cannot access source material.
- [ ] Confirm Account B cannot access study units.
- [ ] Confirm Account B cannot access room concepts.
- [ ] Confirm Account B cannot access concept session data.
- [ ] Attempt a direct session URL using Account A's room and concept.
- [ ] Confirm the direct session URL returns a safe not-found, inaccessible, or redirect state.

Result: Account B sign-up was blocked by the Supabase email rate limit before a usable session was available. Account B data-access checks were not run.

## Delete Cascade Checklist

- [ ] Sign back in with Account A.
- [ ] Delete the test room.
- [ ] Confirm the room is removed.
- [ ] Confirm related source rows are removed.
- [ ] Confirm related study unit rows are removed.
- [ ] Confirm related room concept rows are removed.
- [ ] Confirm old room overview and session URLs no longer reveal data.

Result: not run because Account A never reached an authenticated session.

## Notes

- The database migration enables RLS on `study_units` and `room_concepts`.
- The policies restrict read and write access with `auth.uid() = user_id`.
- The migration uses cascading deletes from `study_rooms` to `study_units` and `room_concepts`.
- The local `.env` file has public Supabase config, but `SUPABASE_SERVICE_ROLE_KEY` is blank, so Codex could not create confirmed temporary users or clean them up through admin APIs.
- Public sign-up is reachable, but it did not return authenticated sessions in this environment.
- Live browser verification still needs two confirmed real test accounts against the deployed Supabase project before this can be marked complete.
