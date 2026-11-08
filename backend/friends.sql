-- Optional friends feature. Run manually in Supabase SQL Editor after review.
-- No changes to puls_profiles, profile revisions, Auth settings or existing RPCs.
begin;

create table if not exists public.puls_friend_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 friend_code text not null unique check (friend_code ~ '^[A-F0-9]{12}$'),
 display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
 streak integer not null default 0 check (streak between 0 and 100000),
 last_training date,
 streak_broken boolean not null default false,
 source_revision bigint not null check (source_revision>0),
 updated_at timestamptz not null default now(),
 check (last_training is not null or (streak=0 and not streak_broken))
);
-- Abuse protection belongs to the Auth identity, not the optional social profile.
-- Disabling friends cannot reset budgets or declined-pair cooldowns.
create table if not exists public.puls_friend_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_window timestamptz not null default now(),
 request_count integer not null default 0 check (request_count between 0 and 30)
);
create table if not exists public.puls_friend_declines (
 sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 retry_after timestamptz not null,
 primary key (sender,recipient), check (sender<>recipient)
);
create table if not exists public.puls_friendships (
 sender uuid not null references public.puls_friend_profiles(user_id) on delete cascade,
 recipient uuid not null references public.puls_friend_profiles(user_id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 primary key (sender,recipient), check (sender<>recipient)
);
create unique index if not exists puls_friendships_pair on public.puls_friendships
 (least(sender,recipient),greatest(sender,recipient));
create index if not exists puls_friendships_recipient on public.puls_friendships(recipient);
create table if not exists public.puls_friend_nudges (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.puls_friend_profiles(user_id) on delete cascade,
 recipient uuid not null references public.puls_friend_profiles(user_id) on delete cascade,
 sent_at timestamptz not null default now(),
 read_at timestamptz,
 check (sender<>recipient)
);
create index if not exists puls_friend_nudges_pair_time on public.puls_friend_nudges(sender,recipient,sent_at desc);
create index if not exists puls_friend_nudges_inbox on public.puls_friend_nudges(recipient,sent_at desc) where read_at is null;

alter table public.puls_friend_profiles enable row level security;
alter table public.puls_friendships enable row level security;
alter table public.puls_friend_nudges enable row level security;
alter table public.puls_friend_limits enable row level security;
alter table public.puls_friend_declines enable row level security;
-- Defense in depth. No direct API table privileges, even for authenticated users:
-- RPC projections hide auth.users IDs, codes are not an unrestricted directory.
revoke all on public.puls_friend_profiles,public.puls_friendships,public.puls_friend_nudges from public,anon,authenticated;
revoke all on public.puls_friend_limits,public.puls_friend_declines from public,anon,authenticated;
drop policy if exists puls_friend_limits_owner on public.puls_friend_limits;
create policy puls_friend_limits_owner on public.puls_friend_limits for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists puls_friend_declines_participant on public.puls_friend_declines;
create policy puls_friend_declines_participant on public.puls_friend_declines for select to authenticated
 using ((select auth.uid()) in (sender,recipient));
drop policy if exists puls_friend_profiles_owner on public.puls_friend_profiles;
create policy puls_friend_profiles_owner on public.puls_friend_profiles for all to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists puls_friendships_participant on public.puls_friendships;
create policy puls_friendships_participant on public.puls_friendships for select to authenticated
 using ((select auth.uid()) in (sender,recipient));
drop policy if exists puls_friend_nudges_participant on public.puls_friend_nudges;
create policy puls_friend_nudges_participant on public.puls_friend_nudges for select to authenticated
 using ((select auth.uid()) in (sender,recipient));

create or replace function public.puls_friends_publish(p_display_name text,p_streak integer,p_last_training date,p_streak_broken boolean,p_source_revision bigint,p_enable boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); attempt integer; profile_revision bigint;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 40
  or p_streak is null or p_streak not between 0 and 100000 or p_streak_broken is null
  or p_last_training>(now() at time zone 'Europe/Berlin')::date+1 or (p_last_training is null and (p_streak<>0 or p_streak_broken)) then
  raise exception 'Invalid friend summary' using errcode='22023';
 end if;
 -- Read only the caller's revision, never their payload. Hold a short row lock so
 -- profile CAS and summary publication cannot cross between check and update.
 select revision into profile_revision from public.puls_profiles where user_id=own_id for share;
 if p_source_revision is null or profile_revision is distinct from p_source_revision then return false; end if;
 -- Background updates cannot re-enable sharing after disabling on another device.
 if not coalesce(p_enable,false) then
  update public.puls_friend_profiles set display_name=btrim(p_display_name),streak=p_streak,
   last_training=p_last_training,streak_broken=p_streak_broken,source_revision=p_source_revision,updated_at=now()
   where user_id=own_id and source_revision<=p_source_revision;
  return found;
 end if;
 for attempt in 1..5 loop
  begin
   insert into public.puls_friend_profiles(user_id,friend_code,display_name,streak,last_training,streak_broken,source_revision)
    values (own_id,upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),btrim(p_display_name),p_streak,p_last_training,p_streak_broken,p_source_revision)
   on conflict (user_id) do update set display_name=excluded.display_name,streak=excluded.streak,
    last_training=excluded.last_training,streak_broken=excluded.streak_broken,source_revision=excluded.source_revision,updated_at=now()
    where public.puls_friend_profiles.source_revision<=excluded.source_revision;
   return found;
  exception when unique_violation then -- retry a random friend-code collision
   if attempt=5 then raise; end if;
  end;
 end loop;
 return false;
end $$;

create or replace function public.puls_friends_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); result jsonb;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select jsonb_build_object('code',p.friend_code,'name',p.display_name) into result
  from public.puls_friend_profiles p where p.user_id=own_id;
 return jsonb_build_object('self',result,
  'friends',coalesce((select jsonb_agg(jsonb_build_object('code',p.friend_code,'name',p.display_name,
   'streak',case when p.last_training<=(now() at time zone 'Europe/Berlin')::date-4 then 0 else p.streak end,
   'last_training',p.last_training,'broken',p.streak_broken or coalesce(p.last_training<=(now() at time zone 'Europe/Berlin')::date-4,false),
   'updated_at',(p.updated_at at time zone 'Europe/Berlin')::date,'last_nudge',(select max(n.sent_at) from public.puls_friend_nudges n where n.sender=own_id and n.recipient=p.user_id)) order by p.display_name,p.friend_code)
   from public.puls_friendships f join public.puls_friend_profiles p on p.user_id=case when f.sender=own_id then f.recipient else f.sender end
   where own_id in (f.sender,f.recipient) and f.status='accepted'),'[]'::jsonb),
  'incoming',coalesce((select jsonb_agg(jsonb_build_object('code',p.friend_code,'name',p.display_name) order by f.created_at)
   from public.puls_friendships f join public.puls_friend_profiles p on p.user_id=f.sender
   where f.recipient=own_id and f.status='pending'),'[]'::jsonb),
  'outgoing',coalesce((select jsonb_agg(jsonb_build_object('code',p.friend_code) order by f.created_at)
   from public.puls_friendships f join public.puls_friend_profiles p on p.user_id=f.recipient
   where f.sender=own_id and f.status='pending'),'[]'::jsonb),
  'nudges',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'code',q.friend_code,'name',q.display_name,'sent_at',q.sent_at) order by q.sent_at)
   from (select n.id,p.friend_code,p.display_name,n.sent_at from public.puls_friend_nudges n
    join public.puls_friend_profiles p on p.user_id=n.sender where n.recipient=own_id and n.read_at is null
    and exists(select 1 from public.puls_friendships f where f.status='accepted' and
     least(f.sender,f.recipient)=least(n.sender,n.recipient) and greatest(f.sender,f.recipient)=greatest(n.sender,n.recipient))
    order by n.sent_at limit 50) q),'[]'::jsonb));
end $$;

create or replace function public.puls_friends_action(p_code text,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); other_id uuid; relation public.puls_friendships%rowtype;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_action is null or p_action not in ('request','accept','decline','remove') then raise exception 'Invalid action'; end if;
 -- Commit unsuccessful code lookups too, so guessing invalid codes consumes the budget.
 if p_action='request' then
 if not exists(select 1 from public.puls_friend_profiles where user_id=own_id) then return 'unavailable'; end if;
 insert into public.puls_friend_limits(user_id) values(own_id) on conflict(user_id) do nothing;
 update public.puls_friend_limits set
  request_count=case when request_window<=now()-interval '1 hour' then 1 else request_count+1 end,
  request_window=case when request_window<=now()-interval '1 hour' then now() else request_window end
  where user_id=own_id and (request_window<=now()-interval '1 hour' or request_count<30);
 if not found then return 'limited'; end if;
 end if;
 select user_id into other_id from public.puls_friend_profiles where friend_code=upper(btrim(p_code));
 if other_id is null or other_id=own_id then return 'unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(own_id,other_id)::text||greatest(own_id,other_id)::text,0));
 select * into relation from public.puls_friendships where least(sender,recipient)=least(own_id,other_id) and greatest(sender,recipient)=greatest(own_id,other_id);
 if p_action<>'request' and relation.sender is null then return 'unavailable'; end if;
 if p_action='request' then
  -- Silent suppression: no rejection status or rejecting party is exposed.
  if exists(select 1 from public.puls_friend_declines where sender=own_id and recipient=other_id and retry_after>now()) then return 'ok'; end if;
  if relation.sender is not null then return 'exists'; end if;
  insert into public.puls_friendships(sender,recipient) values(own_id,other_id);
 elsif p_action='accept' then
  if relation.recipient is distinct from own_id or relation.status is distinct from 'pending' then return 'unavailable'; end if;
  update public.puls_friendships set status='accepted' where sender=other_id and recipient=own_id;
 elsif p_action='decline' then
  if relation.recipient is distinct from own_id or relation.status is distinct from 'pending' then return 'unavailable'; end if;
  insert into public.puls_friend_declines(sender,recipient,retry_after) values(other_id,own_id,now()+interval '7 days')
   on conflict(sender,recipient) do update set retry_after=excluded.retry_after;
  delete from public.puls_friendships where sender=other_id and recipient=own_id;
 else
  delete from public.puls_friendships where least(sender,recipient)=least(own_id,other_id) and greatest(sender,recipient)=greatest(own_id,other_id);
 end if;
 return 'ok';
end $$;

create or replace function public.puls_friends_nudge(p_code text)
returns text language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); other_id uuid;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select user_id into other_id from public.puls_friend_profiles where friend_code=upper(btrim(p_code));
 if other_id is null or other_id=own_id then return 'unavailable'; end if;
 -- Same transaction lock as request/removal. Simultaneous sends cannot bypass 12 h.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(own_id,other_id)::text||greatest(own_id,other_id)::text,0));
 if not exists(select 1 from public.puls_friendships where status='accepted' and least(sender,recipient)=least(own_id,other_id) and greatest(sender,recipient)=greatest(own_id,other_id)) then return 'unavailable'; end if;
 if not exists(select 1 from public.puls_friend_profiles where user_id=other_id and last_training is not null and (streak_broken or last_training<=(now() at time zone 'Europe/Berlin')::date-4)) then return 'active'; end if;
 if exists(select 1 from public.puls_friend_nudges where sender=own_id and recipient=other_id and sent_at>now()-interval '12 hours') then return 'limited'; end if;
 insert into public.puls_friend_nudges(sender,recipient) values(own_id,other_id);
 return 'ok';
end $$;

create or replace function public.puls_friends_read(p_ids uuid[])
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid();
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if coalesce(cardinality(p_ids),0)>50 then raise exception 'Too many nudges'; end if;
 update public.puls_friend_nudges set read_at=now() where recipient=own_id and id=any(p_ids) and read_at is null;
 return true;
end $$;

create or replace function public.puls_friends_disable()
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid();
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 delete from public.puls_friend_profiles where user_id=own_id;
 return true;
end $$;

revoke all on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean),public.puls_friends_snapshot(),public.puls_friends_action(text,text),public.puls_friends_nudge(text),public.puls_friends_read(uuid[]),public.puls_friends_disable() from public,anon;
grant execute on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean),public.puls_friends_snapshot(),public.puls_friends_action(text,text),public.puls_friends_nudge(text),public.puls_friends_read(uuid[]),public.puls_friends_disable() to authenticated;
commit;
