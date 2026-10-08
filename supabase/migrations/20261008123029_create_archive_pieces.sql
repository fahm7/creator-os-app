-- The archive, stored once. Supadata's free tier is 100 requests and a reel's words only exist
-- as audio, so re-profiling must not re-transcribe: the partial unique index on url is what
-- makes a piece cacheable. Named content rather than text to keep a column from sharing a name
-- with a type.
create table public.archive_pieces (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  source text not null check (source in ('instagram', 'youtube', 'linkedin', 'pasted', 'other')),
  url text,
  content text not null check (length(trim(content)) > 0),
  transcribed boolean not null default false,
  -- The per-URL failure reason buildArchive currently assembles and then throws away.
  fetch_note text,
  created_at timestamptz not null default now()
);

create index archive_pieces_creator_id_idx on public.archive_pieces (creator_id, created_at desc);

-- Partial, because pasted pieces have no url and several of them must be allowed to coexist.
create unique index archive_pieces_creator_url_key
  on public.archive_pieces (creator_id, url)
  where url is not null;

alter table public.archive_pieces enable row level security;

comment on table public.archive_pieces is
  'Archive text and cached transcripts. The unique url index prevents paying to transcribe a reel twice.';
