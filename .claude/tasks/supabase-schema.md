# Supabase schema for Creator OS

Status: approved 2026-10-08. Scope: **schema only**. Shoots table **included**.

Project: `ssaelhfgmxidrigzlwik` — empty at start (no public tables, no migrations, no auth users).

## Why a database at all

The case study says the run log *is* the evidence the hypothesis is measured on. It lived in
`localStorage`, so one cleared browser erased the capstone's evidence. Three other things also
died on reload: the confirmed/rejected pattern decisions (a React `Set`), the assembled archive,
and the idea bank — which the case study describes as "a running bank of ideas through the week"
and which cannot accumulate in page state.

Transcript caching is a second, concrete win: Supadata's free tier is 100 requests, and today
every re-analysis re-transcribes the same reels.

This reverses "No auth or database in the shipped app" from the case study. That line was a
deadline decision, not a design one.

## Tables

| Table | Holds | Replaces |
|---|---|---|
| `creators` | The real test users (Hariharan, Ram) | nothing — new |
| `archive_pieces` | Archive text + cached transcripts | `archive` string in page state |
| `style_reads` | One row per profiling run | `profile` in page state |
| `style_patterns` | Claims with confirm/reject state | the `rejected` Set |
| `ideas` | The bank, with verdict and gate note | `ideas` in page state |
| `outlines` | Generated outlines | `outline` in page state |
| `reactions` | The run log | `localStorage["creator-os-log"]` |
| `shoots` | Shoot dates and slot counts | nothing — new, the metric |

### Decisions

- **Postgres enums** for `mechanism`, `verdict`, `pattern_status`, `reaction`, `idea_status`.
  These already exist as TS literal unions in the routes, so `generate_typescript_types` emits
  matching unions. `source` stays `text` + CHECK because platforms will grow.
- **`content`, not `text`**, for the archive piece body. A column named after a type invites
  cast ambiguity in joins. Maps to `Piece.text` in one line.
- **`ordinal`, not `position`** on `style_patterns`, for the same reason (`POSITION` is a SQL
  function). It preserves the UI order the old `rejected` Set indexed by.
- **RLS on every table, zero policies.** The publishable key then reads and writes nothing; the
  app reaches Postgres through the service role key inside the API routes, which is already where
  every model call lives. The browser never touches the DB. The security advisor flags *disabled*
  RLS, not policy-less RLS. When auth arrives, `creator_id` -> `user_id` -> `auth.uid()` policies
  drop in with no schema change.
- **Index on every FK column.** Postgres does not create them automatically and the performance
  advisor flags the gap.
- **`set_updated_at()` with `search_path = ''`** set explicitly — the advisor flags mutable
  search paths.
- **`would_shoot` is a nullable boolean.** Unanswered is a different state from "no". This is
  falsification condition 2 ("fewer than half the banked ideas ever get marked yes").
- **`decided_at` is constrained** to be null exactly when a pattern is still pending.
- **No `vector` extension, no embeddings.** The case study rules out retrieval for a 22-piece
  archive; nothing here changes that.
- **`shoots` has no UI yet.** Included because prepared-slot rate is the hypothesis's primary
  metric. `ideas.shoot_id` assigns an idea to a slot, so the rate is a count, not a join table.

## Migrations

One per table, each enabling its own RLS in the same migration so no table ever exists unlocked.

1. `create_updated_at_function`
2. `create_domain_enums`
3. `create_creators`
4. `create_archive_pieces`
5. `create_style_reads_and_patterns`
6. `create_shoots`
7. `create_ideas`
8. `create_outlines_and_reactions`

Then: both advisors, and `lib/database.types.ts` from `generate_typescript_types`.

## Env

```
NEXT_PUBLIC_SUPABASE_URL=https://ssaelhfgmxidrigzlwik.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Settings -> API keys, pasted by hand>
```

## Explicitly out of scope

Wiring the routes to persist: installing `@supabase/supabase-js`, a server-side client, and
changing all four routes plus `page.tsx`. Separate pass, separate review. Seeding Hariharan's
creator row is also deferred.

## Progress log

- [x] migrations applied — all 8, versions 20261008123000 through 20261008123118
- [x] advisors run — see findings below
- [x] types generated — staged, not yet written to lib/
- [x] env vars added and verified 2026-10-08 (service_role JWT, ref matches, REST 200 with key / 401 without)

## Changes made (2026-10-08)

Eight migrations applied to project `ssaelhfgmxidrigzlwik`, in this order:

| Version | Name |
|---|---|
| 20261008123000 | create_updated_at_function |
| 20261008123008 | create_domain_enums |
| 20261008123018 | create_creators |
| 20261008123029 | create_archive_pieces |
| 20261008123042 | create_style_reads_and_patterns |
| 20261008123049 | create_shoots |
| 20261008123102 | create_ideas |
| 20261008123118 | create_outlines_and_reactions |

Result: 8 tables, 5 enums, 1 trigger function, 3 `updated_at` triggers, 12 indexes
(one per FK, plus the partial unique index on `archive_pieces (creator_id, url)`).
RLS enabled on all 8 tables with zero policies. No data inserted.

Deviations from the plan as written: none.

### Advisor findings

**Security.** `rls_enabled_no_policy` at INFO on all 8 tables — intended, that is the
service-role-only posture.

One pre-existing finding not caused by this work: `public.rls_auto_enable()`, a Supabase
platform event-trigger function, is `SECURITY DEFINER` and has `EXECUTE` granted to `PUBLIC`,
`anon` and `authenticated`, so it is reachable at `/rest/v1/rpc/rls_auto_enable`. It was in the
project before these migrations. Its body calls `pg_event_trigger_ddl_commands()`, which errors
outside an event-trigger context, so an RPC call should fail rather than do anything — but the
broad grant is still what the linter is objecting to. Remediation would be
`revoke execute on function public.rls_auto_enable() from anon, authenticated, public;`, which
does not stop the event trigger firing (event triggers run as owner, not via EXECUTE grants).
Left alone because it is a platform-managed object and outside the approved scope. Not decided.

Side effect worth knowing: this function means RLS would have been auto-enabled on every new
public table anyway. The explicit `enable row level security` in each migration is redundant but
kept, so the migration says what it intends rather than relying on a platform default.

**Performance.** Only `unused_index` at INFO on all 12 indexes, which is what an empty database
with no queries yet looks like. No unindexed-foreign-key findings, confirming the FK index
coverage is complete.

### Credentials verified (2026-10-08)

`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set in `.env.local`.
Checked: the key is a JWT with `role: service_role` and `ref: ssaelhfgmxidrigzlwik` matching the
URL, expiring 2036-10-07. A REST read of `creators` with the key returns 200 `[]`; the same read
with no key returns 401. That is the intended posture confirmed working — policy-less RLS blocks
anonymous access while the service role passes through.

The value is written with a leading space (`SUPABASE_SERVICE_ROLE_KEY= eyJ...`). Harmless:
`@next/env` trims unquoted values, verified empirically — it loads at 219 chars starting `eyJhbG`.
Left as-is.

### Still open

1. `lib/database.types.ts` generated but not written to disk — needs a look first.
2. `@supabase/supabase-js` is not installed. Nothing in the app reads or writes these tables
   yet; it is still on `localStorage`. That is the phase-2 pass.
