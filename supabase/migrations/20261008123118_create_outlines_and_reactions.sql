-- An outline, not a script: a hook, three points and a close, which is what a creator shipping at
-- volume actually preps. One slot is left deliberately empty for lived experience the model has
-- no access to.
create table public.outlines (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  format text not null,
  hook text,
  -- [{ point, bullets: [] }]. jsonb rather than a child table: it is always read and written
  -- whole, and never queried by bullet.
  points jsonb not null default '[]'::jsonb check (jsonb_typeof(points) = 'array'),
  close text,
  experience_slot text,
  -- Which confirmed patterns the outline drew on, so a draft walks back to a claim the creator
  -- verified rather than one the model guessed.
  style_basis text[] not null default '{}',
  needs_verification text[] not null default '{}',
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create index outlines_idea_id_idx on public.outlines (idea_id, created_at desc);

alter table public.outlines enable row level security;

comment on table public.outlines is
  'Hook, three points, close. experience_slot names the example the creator must supply themselves.';

-- The run log, and the reason this database exists. It is simultaneously the evidence the
-- hypothesis is measured on and the record of what the creator actually accepted, so holding it
-- in localStorage meant one cleared browser erased the result. The idea text and verdict are
-- reached through idea_id rather than copied, so the log cannot drift from what it describes.
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  idea_id uuid not null references public.ideas (id) on delete cascade,
  -- Nullable: a creator can reject an idea before any outline is written.
  outline_id uuid references public.outlines (id) on delete set null,
  reaction public.reaction_kind not null,
  -- "What needed fixing?" A draft rejected and fixed in two minutes is a different result from
  -- one rejected and abandoned.
  note text,
  created_at timestamptz not null default now()
);

create index reactions_creator_id_idx on public.reactions (creator_id, created_at desc);
create index reactions_idea_id_idx on public.reactions (idea_id);
create index reactions_outline_id_idx on public.reactions (outline_id);

alter table public.reactions enable row level security;

comment on table public.reactions is
  'The run log. Every verdict the creator gives, which is the evidence the hypothesis is measured on.';
