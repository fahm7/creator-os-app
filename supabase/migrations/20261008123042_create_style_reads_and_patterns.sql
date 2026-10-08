-- One row per profiling run. provider and model are recorded because a style read is only
-- interpretable against the model that produced it, and voice drift is one of the things the
-- capstone is asked to be able to notice.
create table public.style_reads (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  niche text,
  themes text[] not null default '{}',
  keywords text[] not null default '{}',
  archive_size integer check (archive_size >= 0),
  thin boolean not null default false,
  provider text,
  model text,
  -- The untouched model response, so every downstream claim walks back to its source.
  raw jsonb,
  created_at timestamptz not null default now()
);

create index style_reads_creator_id_idx on public.style_reads (creator_id, created_at desc);

alter table public.style_reads enable row level security;

comment on table public.style_reads is
  'One profiling run. raw keeps the model response verbatim for traceability.';

-- The claims the creator confirms or rejects. This is the table that makes rejection durable: it
-- was a React Set, so a reload silently restored claims the creator had already thrown out.
create table public.style_patterns (
  id uuid primary key default gen_random_uuid(),
  style_read_id uuid not null references public.style_reads (id) on delete cascade,
  -- Preserves the order the model returned, which is the order the UI shows.
  ordinal integer not null check (ordinal >= 0),
  claim text not null check (length(trim(claim)) > 0),
  -- The quoted fragment. An uncited style claim cannot be confirmed or rejected.
  evidence text,
  status public.pattern_status not null default 'pending',
  decided_at timestamptz,
  unique (style_read_id, ordinal),
  -- A decided claim has a decision time and a pending one does not. Keeps the run log honest
  -- about when the creator actually looked at it.
  constraint style_patterns_decided_at_matches_status
    check ((status = 'pending') = (decided_at is null))
);

create index style_patterns_style_read_id_idx on public.style_patterns (style_read_id);

alter table public.style_patterns enable row level security;

comment on table public.style_patterns is
  'Citable style claims with the creator''s accept/reject decision. Rejected claims are excluded from later generation.';
