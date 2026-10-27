-- Solo los dos usuarios provisionados por administración pueden acceder al mismo patrimonio.
-- Las claims app_metadata se asignan con Auth Admin; un usuario no puede otorgárselas.
-- No modifica auth.users ni políticas de ninguna tabla de FaroOS.
begin;
create function public.zay_workspace_id() returns uuid
language sql stable set search_path = '' as $$
 select case when auth.uid() is not null
  and coalesce((auth.jwt()->'app_metadata'->>'zay_access')::boolean,false)
 then nullif(auth.jwt()->'app_metadata'->>'zay_workspace','')::uuid
 else null end;
$$;
revoke all on function public.zay_workspace_id() from public, anon;
grant execute on function public.zay_workspace_id() to authenticated;
drop policy "Read own Zay account" on public.zay_accounts;
create policy "Zay members read shared account" on public.zay_accounts for select to authenticated using(user_id=public.zay_workspace_id());
drop policy "Read own backups" on public.zay_account_versions;
create policy "Zay members read shared backups" on public.zay_account_versions for select to authenticated using(user_id=public.zay_workspace_id());
create or replace function public.zay_save_account(p_state jsonb, p_expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.zay_workspace_id(); current_revision bigint; next_revision bigint;
begin
 if u is null then raise exception 'ZAY_UNAUTHORIZED'; end if;
 if octet_length(p_state::text) > 20000000 then raise exception 'ZAY_SIZE_LIMIT'; end if;
 perform public.zay_validate_state(p_state);
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select revision into current_revision from public.zay_accounts where user_id=u for update;
 if coalesce(current_revision,0) <> p_expected_revision then raise exception 'ZAY_CONFLICT'; end if;
 next_revision:=coalesce(current_revision,0)+1;
 if current_revision is not null then
  insert into public.zay_account_versions(user_id,state,revision) select user_id,state,revision from public.zay_accounts where user_id=u;
 end if;
 insert into public.zay_accounts(user_id,state,revision) values(u,p_state,next_revision)
 on conflict(user_id) do update set state=excluded.state, revision=excluded.revision, updated_at=now();
 delete from public.zay_account_versions where user_id=u and id not in(select id from public.zay_account_versions where user_id=u order by id desc limit 20);
 return next_revision;
end; $$;
revoke all on function public.zay_save_account(jsonb,bigint) from public, anon;
grant execute on function public.zay_save_account(jsonb,bigint) to authenticated;
commit;
