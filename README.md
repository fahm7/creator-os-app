# Creator OS

Ideas and outlines from a creator's own archive, with every candidate checked against what they
have already published.

The gap it fills: style matching is solved — a Claude Project with past scripts uploaded does it
in four minutes of setup — but nothing checks whether you have already said the thing. This does.

## The flow

1. **Archive.** Paste reel, video, TikTok or X links (transcribed) and LinkedIn or written posts
   (read as text). Stored once, so a re-run never re-transcribes.
2. **Confirm the style read.** Patterns come back with the quoted fragment they were derived
   from. Reject any that are wrong; rejected claims are excluded from everything generated after.
3. **Idea bank, gated.** Candidates from three multipliers (Kipling, reframe, vertical descent),
   each with a verdict: `new`, `reframe` (covered subject, different door — a legitimate idea) or
   `repeat` (same subject and framing, with the prior piece cited). Repeats are shown rather than
   hidden, so the check is visible rather than trusted.
4. **Outline.** Hook, three points, close — not a finished script. One slot is left deliberately
   empty for lived experience the model has no access to.
5. **Run log.** Every accept/fix/reject is recorded. This is the evidence the project is measured
   on, which is why it is a database table and not browser storage.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

`.env.example` documents all six variables. The minimum to run anything is `GROQ_API_KEY` (or
`ANTHROPIC_API_KEY`), `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Database

The schema is eight tables and five enums. Apply `supabase/migrations/` in filename order, either
with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or by pasting each file into the dashboard's SQL editor, oldest first.

Row level security is enabled on every table with **no policies**, so the publishable key reads
nothing. All access goes through the API routes using the service role key, which is read only by
`lib/db.ts` — marked `server-only` so it cannot reach the browser.

To regenerate `lib/database.types.ts` after a schema change:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

### Run it

```bash
npm run dev
```

Then open http://localhost:3000 and enter a name. There is no password: the name finds that
creator's archive and run log, which is fine for one trusted user on a private URL and not fine
for a link you hand around.

## Costs worth knowing

- **Supadata free tier is 100 requests.** Stored links are never re-fetched, so repeat runs are
  free, but a YouTube channel import spends 10 in one click (capped deliberately).
- **Groq's free tier is 8000 tokens per minute** and counts the requested completion against it.
  `lib/model.ts` caps a request at 4000 and retries once on a rate limit. Setting
  `ANTHROPIC_API_KEY` switches providers and removes the constraint.

## What was deliberately not built

No vector database or retrieval — a 22-piece archive is a rounding error against a million-token
context, so a retriever would add a failure mode in exchange for nothing. No fine-tuning. No video
or image generation; the creator performs on camera and their face is the brand. Full scripts are
not the default output, because a practitioner with 900 videos preps three bullets.

`data/case_study.md` has the reasoning and the evidence behind each of those.

## Status

The hypothesis — that a running bank of archive-checked ideas raises the prepared-slot rate from
50-60% to 75% or more across three consecutive shoots — is **untested**. The app records the
measurement; it cannot produce it. The Shoots section says so while fewer than three shoots exist.
