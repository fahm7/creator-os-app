-- Every table that can be edited after insert carries updated_at, so the trigger body lives
-- once here. search_path is pinned empty because a mutable search path on a function is a
-- privilege-escalation route and the security advisor flags it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper: stamps updated_at on every UPDATE.';
