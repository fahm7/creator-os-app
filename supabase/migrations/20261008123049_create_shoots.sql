-- The hypothesis's primary metric lives here. Prepared-slot rate is the share of a shoot's slots
-- that arrived with an idea already banked, against a 50-60% baseline, and it only means
-- anything across consecutive shoots. Eight slots is the default because that is the batch size
-- he actually records. A cancelled shoot still costs money: the crew is paid whether or not the
-- work gets done.
create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  scheduled_on date not null,
  slots_total integer not null default 8 check (slots_total > 0),
  cancelled boolean not null default false,
  cancel_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shoots_creator_id_idx on public.shoots (creator_id, scheduled_on desc);

create trigger shoots_set_updated_at
  before update on public.shoots
  for each row execute function public.set_updated_at();

alter table public.shoots enable row level security;

comment on table public.shoots is
  'Shoot dates and slot counts. Prepared-slot rate is counted from ideas.shoot_id against slots_total.';
