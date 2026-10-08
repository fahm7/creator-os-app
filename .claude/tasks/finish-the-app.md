# Finish the application (phase 2)

Approved 2026-10-08, after `/code` review of the gap list. Follows `supabase-schema.md`,
which left a correct but entirely unused database.

## Decisions taken at approval

- **Identity: name entry, no auth.** Type a name, get or create a `creators` row, id in
  `localStorage`. Matches the case study's one-real-user reality. Accepted cost: anyone opening
  the deployed URL who types the same name sees that creator's archive and run log. A visible
  note must say so in the UI. `creators.user_id` stays ready for a later auth pass.
- **Intake: all of it, with caps.** YouTube videos, job-id polling, LinkedIn scraping, and
  channel import capped at 10 videos per run with the quota cost shown before the click.
- **Architecture: keep route handlers + client fetch.** No server-component refactor. Smaller
  diff, and under `cacheComponents: true` a GET that queries Postgres defers to request time on
  its own, so the caching semantics stay trivially safe.
- **Drop `firecrawl`.** Supadata's `web.scrape()` covers LinkedIn, so the dependency that was
  added but imported nowhere is removed rather than wired up.

## Verified against the installed SDKs before planning

Read `node_modules/next/dist/docs/` per AGENTS.md, and the Supadata type definitions:

- `cacheComponents: true` is set in `next.config.ts`. Per the route-handlers guide, prerendering
  stops when a GET handler makes a database query, so hydration endpoints run per request with no
  `use cache`. Creator-scoped reads must never be cached.
- `supadata.transcript()` is multi-platform — the docstring names YouTube, TikTok, Instagram and
  Twitter. YouTube is a routing change, not an integration.
- `supadata.web.scrape(url)` returns Markdown. That is the LinkedIn path.
- `supadata.youtube.channel.videos({ id, limit, type })` returns video ids. That is channel
  import.
- **Latent bug found:** `transcript()` returns `Transcript | JobId`. `lib/archive.ts` tests
  `"content" in res` and falls back to `""`, so a video too large for an immediate response is
  silently reported as "no speech found". Long YouTube videos hit this. Fix with job polling.

## Stages

1. **Client layer.** `npm i @supabase/supabase-js`, `npm rm firecrawl`, `lib/database.types.ts`,
   `lib/db.ts` (service-role, `import "server-only"`, clear error if env is missing).
2. **Identity.** `POST /api/creator` find-or-create; `GET /api/creator/[id]` hydrates creator,
   latest style read, patterns, banked ideas, run log.
3. **Persist the flow.** archive upserts pieces and reuses cached transcripts; profile writes
   `style_reads` + `style_patterns`; new `PATCH /api/patterns`; ideas and outline write their
   rows; new `POST /api/reactions`. Every write records `activeProvider`/`activeModel`.
4. **Intake.** YouTube, job polling, LinkedIn scrape, capped channel import. Instagram profile
   links stay unsupported — no API exists.
5. **Shoots.** `POST`/`GET /api/shoots`, `PATCH /api/ideas/[id]` for slot assignment and
   `would_shoot`. UI shows prepared-slot rate per shoot and across the last three against the
   50-60% baseline.
6. **Loose ends.** ESLint ignores for `.vercel` and `.next`; fix the two real `page.tsx`
   findings; commit.
7. **Verify.** tsc, build, lint, then run the app and push a real archive through all four steps,
   confirming rows land in Postgres. Report failures as failures.

## Out of reach of this work

**The hypothesis stays untested.** Prepared-slot rate needs Hariharan using this across three
consecutive shoots. Stage 5 builds the instrument; it cannot produce the measurement.

## Progress log

- [x] 1 client layer
- [x] 2 identity
- [x] 3 persist
- [x] 4 intake
- [x] 5 shoots
- [x] 6 loose ends — not committed, awaiting review
- [x] 7 verify — ran end to end against the live database

## Changes made (2026-10-08)

### New files

| File | Purpose |
|---|---|
| `lib/db.ts` | Service-role client behind `import "server-only"`, plus `orThrow` |
| `lib/database.types.ts` | Generated types; the enums arrive as TS unions |
| `app/api/creator/route.ts` | Find-or-create by name |
| `app/api/creator/[id]/route.ts` | One-round-trip hydration |
| `app/api/patterns/route.ts` | PATCH a claim's confirm/reject decision |
| `app/api/ideas/[id]/route.ts` | PATCH slot assignment, `would_shoot`, status |
| `app/api/reactions/route.ts` | The run log |
| `app/api/shoots/route.ts` | GET/POST shoots with their assigned ideas |

### Rewritten

- `lib/archive.ts` — YouTube, TikTok and X through the same transcribe call; LinkedIn through
  `web.scrape`; channel expansion capped at 10; job-id polling; `skipUrls` so stored links are
  never re-fetched; `SUPADATA_BASE_URL` now actually passed to the SDK.
- `lib/model.ts` — see the Groq finding below.
- All four original routes — each now writes its step to Postgres and returns row ids.
- `app/page.tsx` — name gate, hydration on mount, persisted pattern decisions, the idea bank,
  shoots with prepared-slot rate, run log from the database.
- `eslint.config.mjs` — ignore `.vercel/**`.

### Three defects found and fixed while building

1. **Groq's free tier is 8000 tokens per minute, and the limit counts the requested completion.**
   `max_completion_tokens` was 16000, so it exceeded the whole per-minute budget on its own. The
   outline step failed with a 413 every time the first three steps had warmed the window. Groq's
   ceiling is now 4000 per call, with one 20s retry on a rate limit and an error message that
   names the two ways out. Reproduced before the fix, confirmed working after.
2. **Large videos were silently reported as having no speech.** `transcript()` returns
   `Transcript | JobId`; the old code tested `"content" in res` and fell back to `""`, so any
   video too big for an inline response looked empty. Now polls the job for up to 35s and says
   so if it is still running.
3. **Prepared-slot rate read 0% after any reload.** The hydration route selected bare shoot
   columns while the page counts assigned ideas from a join, and the page's `?? 0` fallback hid
   it. Caught by actually reloading rather than by typechecking.

### Verified end to end against the live database

Ran the whole flow with real Groq calls: creator created, 4 pieces stored, re-pasting the same
archive did not duplicate them, style read stored with provider and model, a rejected pattern
survived a reload, 8 ideas gated (3 new / 4 reframe / 1 repeat), an outline written with three
points and an empty experience slot, a reaction logged, a shoot created and an idea assigned to a
slot. Invalid input returns 400 on every route tested; an unknown creator returns 404. No JWT
appears in the page source.

### Known state

- **Smoke-test data is still in the database.** One `ZZ Smoke Test` creator and 21 rows across
  the other tables. The delete was declined at the permission prompt, so it was left alone.
- **Nothing is committed.** Awaiting diff review.
- The `rls_auto_enable()` revoke from `supabase-schema.md` is still undecided.
