-- Source migration only. Apply deliberately in the Supabase SQL editor before deployment.
-- No pictures, descriptions, nutrition or profile data; one quota row per account.
begin;
create table if not exists public.puls_food_photo_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null check (minute_count between 1 and 3),
  day_start date not null,
  day_count integer not null check (day_count between 1 and 20)
);
alter table public.puls_food_photo_quota enable row level security;
revoke all on public.puls_food_photo_quota from public, anon, authenticated;
-- No direct client policies/grants: the narrow RPC exclusively uses auth.uid().
create or replace function public.puls_food_photo_allow()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  stamp timestamptz := pg_catalog.clock_timestamp();
  minute_bucket timestamptz := pg_catalog.date_trunc('minute', stamp);
  day_bucket date := (stamp at time zone 'UTC')::date;
  allowed uuid;
begin
  if caller is null then return false; end if;
  insert into public.puls_food_photo_quota as q (user_id,minute_start,minute_count,day_start,day_count)
    values (caller,minute_bucket,1,day_bucket,1)
  on conflict (user_id) do update set
    minute_start=minute_bucket,
    minute_count=case when q.minute_start=minute_bucket then q.minute_count+1 else 1 end,
    day_start=day_bucket,
    day_count=case when q.day_start=day_bucket then q.day_count+1 else 1 end
  where (q.minute_start<>minute_bucket or q.minute_count<3)
    and (q.day_start<>day_bucket or q.day_count<20)
  returning user_id into allowed;
  return allowed is not null;
end;
$$;
revoke all on function public.puls_food_photo_allow() from public, anon;
grant execute on function public.puls_food_photo_allow() to authenticated;
commit;
