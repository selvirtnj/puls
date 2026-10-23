-- Self-service deletion only. Installing this function does not delete an account.
begin;
create or replace function public.puls_delete_own_account(p_confirmation text)
returns boolean language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid();
begin
 if own_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_confirmation is distinct from 'DELETE' then raise exception 'Explicit confirmation required'; end if;
 -- A token refresh does not reset session creation time. Require a fresh sign-in.
 if not exists (
  select 1 from auth.sessions s
  where s.id::text=auth.jwt()->>'session_id' and s.user_id=own_id
   and s.created_at >= pg_catalog.now()-interval '5 minutes'
 ) then raise exception 'Please sign in again before deleting your account' using errcode='28000'; end if;
 -- Never accepts a user ID from the client. The profiles FK cascades on deletion.
 delete from auth.users where id=own_id;
 if not found then raise exception 'Account no longer exists'; end if;
 return true;
end $$;
revoke all on function public.puls_delete_own_account(text) from public,anon;
grant execute on function public.puls_delete_own_account(text) to authenticated;
commit;
