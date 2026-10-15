## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Project notes

Feynduck is a Feynman-technique study app: students add material to a room, explain a concept, and get a clarity score, the missing link, and a question back. Next.js 15 App Router + React 19 + TypeScript, deployed to Cloudflare Workers via OpenNext (`npm run deploy`), Supabase for auth, Postgres (RLS) and Storage.

- **UI:** app pages (login, signup, onboarding, `/study`, room, session) use the redesign in `src/app/app-ui.css` (`fd-*` classes) and `src/components/app/*`. Public pages (`/`, `/start`, `/duck-watch`, `/privacy`, `/terms`, `/admin/waitlist`) still use the older styles in `globals.css`.
- **Session workspace:** `src/features/explanation/components/ExplainForm.tsx` (large); support panel (Progress / Quiz / Flashcards): `src/features/gap-analysis/components/GapResultPanel.tsx`.
- **AI:** every text feature calls `generateJson()` in `src/lib/ai/claude.ts` (structured outputs, the student's material is prompt-cached). Scoring (`/api/explain`, `/api/demo-evaluate`) uses `claude-sonnet-5-5`; learning path, follow-up, quiz and flashcards use `claude-haiku-5-5` (override with `ANTHROPIC_EVALUATOR_MODEL` / `ANTHROPIC_STUDY_TOOLS_MODEL`). Voice transcription stays on OpenAI (`src/lib/ai/transcription.ts`), since Claude has no speech-to-text.
- **API security:** middleware skips `/api`, so each AI route first calls `guardUserAIRequest()` (login + per-user rate limit) or, for the public landing demo, `guardDemoAIRequest()` (per-IP) from `src/lib/api/guards.ts`. Rate-limit bindings live in `wrangler.jsonc`; input size caps in `src/lib/api/input.ts`.
- **Checks:** `npm run build`, `npm run test:evaluator`, `npm run test:retention`.
- **Keep out of commits unless asked:** `scripts/`, `waitlist_import.csv`, `.codex/`, `graphify-out/`, `AGENTS.md`.

Open items as of 2026-10-14:
- Apply `supabase/migrations/20261013120000_add_study_goals_to_profiles.sql` (onboarding goals don't save until then).
- After deploying, change the Supabase confirmation email link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`.
- Ideas not started: a daily per-user AI quota, loading room material server-side in the AI routes instead of from the browser, an eval set for the scorer (it takes ~17s at medium effort), pruning the old app CSS.
