-- v93 strength scale 2: 14 rank groups, stage index 0..39. Manual migration only (not executed by agents).
-- Prerequisite: backend/friends.sql -> backend/friends-ranks.sql; backend/friends-strength.sql may or may not
-- be applied, this file replaces it completely. Do not re-run friends-strength.sql afterwards.
-- rank_scale NULL = legacy scale 0..24 (app versions up to 92, which keep publishing without the key);
-- rank_scale 2 = scale 0..39. Clients map legacy values when displaying. NULL p_strength preserves summaries,
-- an explicit {strength_rank:null,lift_ranks:[]} still clears them. Repeatable in one transaction.
begin;
alter table public.puls_friend_profiles add column if not exists strength_rank smallint;
alter table public.puls_friend_profiles add column if not exists lift_ranks jsonb;
alter table public.puls_friend_profiles add column if not exists rank_scale smallint;
-- The old one-argument validator is referenced by a constraint: drop constraints first, then replace it
-- (no overload remains).
alter table public.puls_friend_profiles drop constraint if exists puls_friend_profiles_strength_rank_check;
alter table public.puls_friend_profiles drop constraint if exists puls_friend_profiles_lift_ranks_check;
alter table public.puls_friend_profiles drop constraint if exists puls_friend_profiles_rank_scale_check;
drop function if exists public.puls_valid_lift_ranks(jsonb);
create or replace function public.puls_valid_lift_ranks(value jsonb,max_rank integer)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; seen text[] := array[]::text[]; key_text text; rank_value numeric; ratio_value numeric;
begin
 if value is null then return true; end if;
 if max_rank is null or max_rank not in (24,39) then return false; end if;
 if jsonb_typeof(value)<>'array' then return false; end if;
 if jsonb_array_length(value)>40 or octet_length(value::text)>32768 then return false; end if;
 for item in select * from jsonb_array_elements(value) loop
  if jsonb_typeof(item)<>'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(item))<>4 or not (item ?& array['key','name','rankIndex','ratio']) then return false; end if;
  if jsonb_typeof(item->'key')<>'string' or jsonb_typeof(item->'name')<>'string'
   or jsonb_typeof(item->'rankIndex')<>'number' or jsonb_typeof(item->'ratio')<>'number' then return false; end if;
  key_text := item->>'key';
  if key_text !~ '^[a-z0-9-]{1,180}$' or key_text=any(seen)
   or char_length(btrim(item->>'name'))<1 or char_length(item->>'name')>120 then return false; end if;
  rank_value := (item->>'rankIndex')::numeric; ratio_value := (item->>'ratio')::numeric;
  if rank_value<>trunc(rank_value) or rank_value not between 0 and max_rank
   or ratio_value<=0 or ratio_value>1000 or ratio_value<>round(ratio_value,2) then return false; end if;
  seen := array_append(seen,key_text);
 end loop;
 return true;
end $$;
revoke all on function public.puls_valid_lift_ranks(jsonb,integer) from public,anon,authenticated;
alter table public.puls_friend_profiles add constraint puls_friend_profiles_rank_scale_check check (rank_scale is null or rank_scale=2);
alter table public.puls_friend_profiles add constraint puls_friend_profiles_strength_rank_check
 check (strength_rank between 0 and case when rank_scale=2 then 39 else 24 end);
alter table public.puls_friend_profiles add constraint puls_friend_profiles_lift_ranks_check
 check (public.puls_valid_lift_ranks(lift_ranks,case when rank_scale=2 then 39 else 24 end));
alter table public.puls_friend_profiles enable row level security;
-- Retain the owner policy and RPC-only access from friends.sql.
revoke all on public.puls_friend_profiles from public,anon,authenticated;
-- Same signature as friends-strength.sql: replaced in place. Older signatures are removed so
-- PostgREST named/default arguments stay unique.
drop function if exists public.puls_friends_publish(text,integer,date,boolean,bigint,boolean);
drop function if exists public.puls_friends_publish(text,integer,date,boolean,bigint,boolean,integer);
create or replace function public.puls_friends_publish(p_display_name text,p_streak integer,p_last_training date,p_streak_broken boolean,p_source_revision bigint,p_enable boolean default false,p_xp integer default null,p_strength jsonb default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); attempt integer; profile_revision bigint; scale_value smallint := null; max_rank integer := 24;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;

 if p_strength is not null then
  if jsonb_typeof(p_strength)<>'object' then raise exception 'Invalid strength summary' using errcode='22023'; end if;
  if octet_length(p_strength::text)>32768 or not (p_strength ?& array['strength_rank','lift_ranks'])
   or (select count(*) from jsonb_object_keys(p_strength))<>case when p_strength ? 'rank_scale' then 3 else 2 end
   then raise exception 'Invalid strength summary' using errcode='22023'; end if;
  if p_strength ? 'rank_scale' then
   if jsonb_typeof(p_strength->'rank_scale')<>'number' or (p_strength->>'rank_scale')::numeric<>2 then
    raise exception 'Invalid strength summary' using errcode='22023'; end if;
   scale_value := 2; max_rank := 39;
  end if;
  if jsonb_typeof(p_strength->'strength_rank') not in ('number','null') or jsonb_typeof(p_strength->'lift_ranks')<>'array'
   or not public.puls_valid_lift_ranks(p_strength->'lift_ranks',max_rank) then raise exception 'Invalid strength summary' using errcode='22023'; end if;
  if p_strength->'strength_rank'<>'null'::jsonb then
   if (p_strength->>'strength_rank')::numeric<>trunc((p_strength->>'strength_rank')::numeric)
    or (p_strength->>'strength_rank')::numeric not between 0 and max_rank then raise exception 'Invalid strength rank' using errcode='22023'; end if;
  end if;
 end if;
 if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 40
  or (p_xp is not null and p_xp not between 0 and 10000000)
  or p_streak is null or p_streak not between 0 and 100000 or p_streak_broken is null
  or p_last_training>(now() at time zone 'Europe/Berlin')::date+1 or (p_last_training is null and (p_streak<>0 or p_streak_broken)) then
  raise exception 'Invalid friend summary' using errcode='22023';
 end if;
 -- Read only the caller's revision, never their payload. Hold a short row lock so
 -- profile CAS and summary publication cannot cross between check and update.
 select revision into profile_revision from public.puls_profiles where user_id=own_id for share;
 if p_source_revision is null or profile_revision is distinct from p_source_revision then return false; end if;
 -- Background updates cannot re-enable sharing after disabling on another device.
 -- Rank, lifts and scale always change together, so legacy publishes reset rank_scale to NULL.
 if not coalesce(p_enable,false) then
  update public.puls_friend_profiles set display_name=btrim(p_display_name),streak=p_streak,
   xp=coalesce(p_xp,xp),strength_rank=case when p_strength is null then strength_rank else (p_strength->>'strength_rank')::smallint end,
   lift_ranks=case when p_strength is null then lift_ranks else p_strength->'lift_ranks' end,
   rank_scale=case when p_strength is null then rank_scale else scale_value end,last_training=p_last_training,streak_broken=p_streak_broken,source_revision=p_source_revision,updated_at=now()
   where user_id=own_id and source_revision<=p_source_revision;
  return found;
 end if;
 for attempt in 1..5 loop
  begin
   insert into public.puls_friend_profiles(user_id,friend_code,display_name,streak,last_training,streak_broken,source_revision,xp,strength_rank,lift_ranks,rank_scale)
    values (own_id,upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),btrim(p_display_name),p_streak,p_last_training,p_streak_broken,p_source_revision,p_xp,(p_strength->>'strength_rank')::smallint,p_strength->'lift_ranks',scale_value)
   on conflict (user_id) do update set display_name=excluded.display_name,streak=excluded.streak,
    xp=coalesce(p_xp,public.puls_friend_profiles.xp),
    strength_rank=case when p_strength is null then public.puls_friend_profiles.strength_rank else excluded.strength_rank end,
    lift_ranks=case when p_strength is null then public.puls_friend_profiles.lift_ranks else excluded.lift_ranks end,
    rank_scale=case when p_strength is null then public.puls_friend_profiles.rank_scale else excluded.rank_scale end,last_training=excluded.last_training,streak_broken=excluded.streak_broken,source_revision=excluded.source_revision,updated_at=now()
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
 select jsonb_build_object('code',p.friend_code,'name',p.display_name,'xp',p.xp,'strength_rank',p.strength_rank,'lift_ranks',p.lift_ranks,'rank_scale',p.rank_scale) into result
  from public.puls_friend_profiles p where p.user_id=own_id;
 return jsonb_build_object('self',result,
  'friends',coalesce((select jsonb_agg(jsonb_build_object('code',p.friend_code,'name',p.display_name,
   'xp',p.xp,'strength_rank',p.strength_rank,'lift_ranks',p.lift_ranks,'rank_scale',p.rank_scale,'streak',case when p.last_training<=(now() at time zone 'Europe/Berlin')::date-4 then 0 else p.streak end,
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

revoke all on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean,integer,jsonb),public.puls_friends_snapshot() from public,anon;
grant execute on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean,integer,jsonb),public.puls_friends_snapshot() to authenticated;
notify pgrst, 'reload schema';
commit;
