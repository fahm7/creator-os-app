-- The bank. The case study's premise is a bank that accumulates through the week, which page
-- state cannot do. Repeats are stored rather than dropped, because the creator needs to see the
-- archive check working rather than trust it.
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  -- Which style read produced it. Kept on delete so an idea outlives a re-profiling.
  style_read_id uuid references public.style_reads (id) on delete set null,
  shoot_id uuid references public.shoots (id) on delete set null,
  idea text not null check (length(trim(idea)) > 0),
  mechanism public.idea_mechanism,
  verdict public.archive_verdict not null,
  -- For reframe and repeat: which prior piece, and how this differs or does not.
  gate_note text,
  why text,
  -- Flagged hard for health, medicine, mental health, finance, law and research. He makes mental
  -- health content, so this is a safety requirement rather than a quality nicety.
  needs_verification boolean not null default false,
  verify_what text,
  -- The topic the creator brought, if they brought one.
  requested_topic text,
  status public.idea_status not null default 'banked',
  -- Nullable on purpose: unanswered is a different state from "no". Falsification condition 2 is
  -- "fewer than half the banked ideas ever get marked yes", which needs that distinction.
  would_shoot boolean,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_creator_id_idx on public.ideas (creator_id, created_at desc);
create index ideas_style_read_id_idx on public.ideas (style_read_id);
create index ideas_shoot_id_idx on public.ideas (shoot_id);

create trigger ideas_set_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;

comment on table public.ideas is
  'The idea bank, every candidate carrying its archive verdict. Repeats are kept so the check is visible.';
