-- One real creator, not a persona. user_id is a nullable placeholder: there is no auth yet, and
-- leaving the column here means adding it later is a policy change rather than a schema change.
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  handle text,
  platform text,
  language text,
  niche text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creators_user_id_idx on public.creators (user_id);

create trigger creators_set_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

-- No policies: the publishable key gets nothing. Access is via the service role key inside the
-- API routes, which is already where every model call happens.
alter table public.creators enable row level security;

comment on table public.creators is
  'The real test users. user_id is an unused placeholder for a later auth pass.';
