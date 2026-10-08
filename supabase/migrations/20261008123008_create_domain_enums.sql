-- These five vocabularies already exist as TypeScript literal unions in the API routes.
-- Declaring them as enums rather than text+CHECK means the generated types carry the same
-- unions, so a verdict the app does not handle cannot reach the database.

-- Which of the three multipliers produced an idea (lib/prompts.ts, ideasPrompt).
create type public.idea_mechanism as enum ('kipling', 'reframe', 'vertical');

-- The archive gate's verdict. 'reframe' is a legitimate idea, not a rejection: covered subject,
-- genuinely different door.
create type public.archive_verdict as enum ('new', 'reframe', 'repeat');

-- A style claim starts unreviewed. Rejected claims are excluded from everything generated after.
create type public.pattern_status as enum ('pending', 'confirmed', 'rejected');

-- The creator's verdict on an outline. This is the run log's payload.
create type public.reaction_kind as enum ('accept', 'fix', 'reject');

-- Where an idea sits in the bank.
create type public.idea_status as enum ('banked', 'shortlisted', 'shot', 'discarded');
