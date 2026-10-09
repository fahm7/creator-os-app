-- Keywords and niche candidates the creator can tick. One table with a kind discriminator
-- rather than two near-identical ones: they behave the same in the UI and the API, so two
-- tables would mean two routes and two components differing by a single word.
-- Shape mirrors style_patterns — ordinal plus a decision — so this reads as the app's existing
-- idea applied again rather than a mechanism invented for it.
create type public.choice_kind as enum ('keyword', 'niche');

create table public.style_choices (
  id uuid primary key default gen_random_uuid(),
  style_read_id uuid not null references public.style_reads (id) on delete cascade,
  kind public.choice_kind not null,
  ordinal integer not null check (ordinal >= 0),
  label text not null check (length(trim(label)) > 0),
  -- For a niche: which keywords or themes produced it, so the option is justified rather than
  -- asserted. Null for a keyword, which is simply a word found in the archive.
  rationale text,
  -- Keywords arrive selected: the model found them, so the creator is pruning a list rather
  -- than building one. Niches arrive unselected, and nothing is gated on picking one — an
  -- empty selection means "use what the model read".
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (style_read_id, kind, ordinal)
);

create index style_choices_style_read_id_idx on public.style_choices (style_read_id, kind, ordinal);

alter table public.style_choices enable row level security;

comment on table public.style_choices is
  'Tickable keywords and candidate niches. Selection is an optional override of the model read, never a gate.';
