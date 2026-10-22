-- PULS private per-user profiles. Run once in Supabase SQL Editor.
begin;
create table if not exists public.puls_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 1 check(revision > 0),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=5000000),
 updated_at timestamptz not null default now()
);
alter table public.puls_profiles enable row level security;
revoke all on public.puls_profiles from anon, authenticated;
grant select,insert,update on public.puls_profiles to authenticated;
drop policy if exists puls_own_select on public.puls_profiles;
create policy puls_own_select on public.puls_profiles for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists puls_own_insert on public.puls_profiles;
create policy puls_own_insert on public.puls_profiles for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists puls_own_update on public.puls_profiles;
create policy puls_own_update on public.puls_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create or replace function public.puls_save_profile(p_expected_revision bigint,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.puls_profiles;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if jsonb_typeof(p_payload)<>'object' or not(p_payload ? 'foods') or not(p_payload ? 'goals') then raise exception 'Invalid profile'; end if;
 if p_expected_revision=0 then
  insert into public.puls_profiles(user_id,payload,revision) values(auth.uid(),p_payload,1)
  on conflict(user_id) do nothing returning * into saved;
 else
  update public.puls_profiles set payload=p_payload,revision=revision+1,updated_at=now()
   where user_id=auth.uid() and revision=p_expected_revision returning * into saved;
 end if;
 if saved.user_id is null then return null; end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.puls_save_profile(bigint,jsonb) from public,anon;
grant execute on function public.puls_save_profile(bigint,jsonb) to authenticated;
commit;