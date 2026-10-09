# Step 1-2: a 3-piece floor, and the niche as a decision

Requested 2026-10-09. Awaiting approval to implement.

## Why

Two problems in the same screen.

**Three pieces errors out.** Two gates reject it, and the worse one is silent: a pasted block
under 40 characters is dropped by `lib/archive.ts` without a word, so three short pieces can
become zero and the app then reports "Could not find anything readable" about input the creator
did provide. The visible gate is the 200-character floor in the profile route.

**The niche is asserted, not confirmed.** Style patterns get the confirm/reject treatment because
a confidently wrong style read poisons everything downstream. The niche is exactly the same kind
of claim and gets none of it — the model states one line and the creator has no way to correct it,
even though the niche is what idea generation is anchored to. Making it a choice applies the
mechanism the app already has to the claim that most needs it.

## Decided at approval

- **Minimum three pieces, counted as pieces.** Not a character floor. Fewer than three gets a
  clear ask naming the count, not an error about unreadable input. More is better.
- **Keywords are tickable too**, revised from an earlier "niche only" answer: the creator wants to
  choose the keywords most relevant to them. Both groups get checkboxes.
- **Choosing is optional, never a gate.** If nothing is ticked, generation proceeds on what the
  model found. The creator can override the read; they are not made to ratify it before the app
  will work. Revised from an earlier plan to block until a niche was picked.

## A. Accept three pieces

| File | Change |
|---|---|
| `app/api/archive/route.ts` | Enforce at least three pieces, with a message naming how many were found. |
| `app/api/profile/route.ts` | 200-character floor -> count the piece markers instead; three or more passes, whatever their length. |
| `lib/archive.ts` | Free-text block filter 40 -> 15 characters, so a short piece is not silently discarded. |
| `app/page.tsx` | Button threshold 20 -> 10 characters. |
| `app/page.tsx` | Copy: "under ten pieces is too thin to read a style from" -> "Three is enough to start; more is better." |

**Keeping** the `thin` flag and its "treat the style read as provisional" notice, which fires
under ten pieces. It blocks nothing and it is the app being honest that a read off three pieces is
a weaker claim than one off twenty-two. Removing it would make the app overstate what it knows.

## B. At least three keywords

`profilePrompt` asks for keywords with no floor. Add an explicit "at least 3, even from a small
archive" so a three-piece run returns something usable rather than one word.

## C. Keywords and niche become checkbox decisions

**Prompt** gains `nicheOptions`: 5-7 candidates, each one line, each carrying the keywords and
themes that produced it, deliberately ranging from narrow to broad so the choice is real rather
than seven phrasings of one idea.

**Migration** `create_style_choices`, one table for both kinds rather than two near-identical
ones:

```
choice_kind enum ('keyword', 'niche')

style_choices
  id, style_read_id -> style_reads (cascade)
  kind              choice_kind
  ordinal           display order within its kind
  label             the keyword, or the candidate niche
  rationale         which keywords/themes produced a niche; null for a keyword
  selected boolean  default false
  unique (style_read_id, kind, ordinal)
```

One table because the two behave identically in the UI and the API — a `kind` discriminator beats
two tables, two routes and two components that differ only in a word. It also mirrors
`style_patterns`, the same ordinal-plus-decision shape the app already uses, so this reads as one
idea applied again rather than a mechanism invented for it.

**Route** `PATCH /api/choices` toggles `selected`, same shape as the existing `/api/patterns`.

`style_reads.niche` and `style_reads.keywords` keep the model's own extraction, for traceability
alongside `raw`. The confirmed values are the selected rows, and those are what feed idea
generation instead of the asserted ones.

**UI**, step 2: "Which keywords are actually yours?" over the keyword checkboxes, then "Which of
these is your niche?" over the 5-7 niche checkboxes, both labelled optional — "tick any that fit,
or leave them and I will use what I read."

Keywords arrive pre-ticked, since the model found them in the archive and the creator is pruning
rather than building a list. Niches arrive unticked.

**Nothing is gated on a selection.** "Give me ideas" is always available once a style pattern
survives. The fallback is explicit in the ideas route: use the selected niches if any are ticked,
otherwise `style_reads.niche`; use the ticked keywords, which default to all of them. The creator
can correct the read without being required to ratify it first — an optional override, not a form
to complete.

## Verify

tsc, lint, build, then a real 3-piece archive through the live server: confirm no error, at least
three keywords, 5-7 niche options, un-ticking a keyword and ticking a niche both surviving a
reload, and ideas generated against the chosen niche rather than the asserted one.

## Progress log

- [ ] A three-piece floor
- [ ] B keyword floor
- [ ] C style choices: migration, prompt, route, UI
- [ ] verify
