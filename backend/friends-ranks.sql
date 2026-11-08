-- v87 ranks; prerequisite: backend/friends.sql. Manual, reviewed SQL step only.
-- Re-runnable transaction. Existing six-argument clients use p_xp DEFAULT NULL;
-- their updates retain previously published XP. No profile payloads are read.
begin;
alter table public.puls_friend_profiles
 add column if not exists xp integer
 constraint puls_friend_profiles_xp_check check (xp between 0 and 10000000);
-- Also repair a previously installed v87 column without rewriting known XP.
alter table public.puls_friend_profiles alter column xp drop not null;
alter table public.puls_friend_profiles alter column xp drop default;
alter table public.puls_friend_profiles enable row level security;
-- Retain the owner policy and RPC-only access from friends.sql.
revoke all on public.puls_friend_profiles from public,anon,authenticated;
-- Do not leave both signatures: PostgREST named/default arguments must be unique.
drop function if exists public.puls_friends_publish(text,integer,date,boolean,bigint,boolean);
create or replace function public.puls_friends_publish(p_display_name text,p_streak integer,p_last_training date,p_streak_broken boolean,p_source_revision bigint,p_enable boolean default false,p_xp integer default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); attempt integer; profile_revision bigint;
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
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
 if not coalesce(p_enable,false) then
  update public.puls_friend_profiles set display_name=btrim(p_display_name),streak=p_streak,
   xp=coalesce(p_xp,xp),last_training=p_last_training,streak_broken=p_streak_broken,source_revision=p_source_revision,updated_at=now()
   where user_id=own_id and source_revision<=p_source_revision;
  return found;
 end if;
 for attempt in 1..5 loop
  begin
   insert into public.puls_friend_profiles(user_id,friend_code,display_name,streak,last_training,streak_broken,source_revision,xp)
    values (own_id,upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),btrim(p_display_name),p_streak,p_last_training,p_streak_broken,p_source_revision,p_xp)
   on conflict (user_id) do update set display_name=excluded.display_name,streak=excluded.streak,
    xp=coalesce(p_xp,public.puls_friend_profiles.xp),last_training=excluded.last_training,streak_broken=excluded.streak_broken,source_revision=excluded.source_revision,updated_at=now()
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
 select jsonb_build_object('code',p.friend_code,'name',p.display_name,'xp',p.xp) into result
  from public.puls_friend_profiles p where p.user_id=own_id;
 return jsonb_build_object('self',result,
  'friends',coalesce((select jsonb_agg(jsonb_build_object('code',p.friend_code,'name',p.display_name,
   'xp',p.xp,'streak',case when p.last_training<=(now() at time zone 'Europe/Berlin')::date-4 then 0 else p.streak end,
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

revoke all on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean,integer),public.puls_friends_snapshot() from public,anon;
grant execute on function public.puls_friends_publish(text,integer,date,boolean,bigint,boolean,integer),public.puls_friends_snapshot() to authenticated;
notify pgrst, 'reload schema';
commit;
