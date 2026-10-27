-- Zay: snapshots privados, importes enteros en centavos y escritura atómica CAS.
begin;
create table public.zay_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint state_size check (octet_length(state::text) <= 20000000),
 constraint state_version check (state->>'version' = '1' and state->>'currency' = 'MXN')
);
alter table public.zay_accounts enable row level security;
create policy "Read own Zay account" on public.zay_accounts for select to authenticated using (auth.uid() = user_id);
revoke all on public.zay_accounts from anon, authenticated;
grant select on public.zay_accounts to authenticated;
create table public.zay_account_versions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 state jsonb not null,
 revision bigint not null,
 created_at timestamptz not null default now()
);
alter table public.zay_account_versions enable row level security;
create policy "Read own backups" on public.zay_account_versions for select to authenticated using (auth.uid()=user_id);
revoke all on public.zay_account_versions from anon, authenticated;
grant select on public.zay_account_versions to authenticated;

create function public.zay_validate_state(p jsonb) returns void
language plpgsql set search_path = '' as $$
declare l jsonb; x jsonb; product jsonb; sold bigint; all_ids text[] := '{}'; item_id text; a numeric;
begin
 if jsonb_typeof(p) <> 'object' or p->>'version' <> '1' or p->>'currency' <> 'MXN'
 or coalesce(length(trim(p->>'name')),0) not between 1 and 250
 or coalesce(p->>'opening','') !~ '^\d+$' or (p->>'opening')::numeric > 100000000000000
 or coalesce(p->>'openingDate','') !~ '^\d{4}-\d{2}-\d{2}$'
 then raise exception 'ZAY_INVALID_STATE'; end if;
 if (p->>'openingDate')::date > current_date then raise exception 'ZAY_INVALID_DATE'; end if;
 foreach item_id in array array['movements','lots','plans','audit'] loop
  if jsonb_typeof(p->item_id) is distinct from 'array' then raise exception 'ZAY_INVALID_ARRAY'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p->'movements') loop
  if coalesce(x->>'amount','') !~ '^-?\d+$' or abs((x->>'amount')::numeric) not between 1 and 100000000000000
  or coalesce(length(trim(x->>'concept')),0) not between 1 and 250
  or coalesce(x->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (x->>'date')::date < (p->>'openingDate')::date or (x->>'date')::date > current_date then raise exception 'ZAY_INVALID_MOVEMENT'; end if;
 end loop;
 for l in select value from jsonb_array_elements(p->'lots') loop
  if coalesce(length(trim(l->>'name')),0) not between 1 and 250 then raise exception 'ZAY_INVALID_LOT'; end if;
  foreach item_id in array array['products','sales','rules'] loop
   if jsonb_typeof(l->item_id) is distinct from 'array' then raise exception 'ZAY_INVALID_ARRAY'; end if;
  end loop;
  for product in select value from jsonb_array_elements(l->'products') loop
   if coalesce(product->>'units','') !~ '^\d+$' or (product->>'units')::numeric not between 1 and 100000
    or coalesce(product->>'cost','') !~ '^\d+$' or coalesce(product->>'price','') !~ '^\d+$'
    or (product->>'cost')::numeric * (product->>'units')::numeric > 100000000000000
    or (product->>'price')::numeric * (product->>'units')::numeric > 100000000000000
    or coalesce(length(trim(product->>'name')),0) not between 1 and 250
    or coalesce(product->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (product->>'date')::date < (p->>'openingDate')::date or (product->>'date')::date > current_date
    or length(coalesce(product->>'photo','')) > 800000 then raise exception 'ZAY_INVALID_PRODUCT'; end if;
   select coalesce(sum((value->>'units')::bigint),0) into sold from jsonb_array_elements(l->'sales') where value->>'productId'=product->>'id' and coalesce((value->>'voided')::boolean,false)=false;
   if sold > (product->>'units')::bigint then raise exception 'ZAY_INSUFFICIENT_STOCK'; end if;
  end loop;
  for x in select value from jsonb_array_elements(l->'sales') loop
   select value into product from jsonb_array_elements(l->'products') where value->>'id'=x->>'productId';
   if product is null or coalesce(x->>'units','') !~ '^\d+$' or (x->>'units')::numeric < 1
    or coalesce(x->>'price','') !~ '^\d+$' or (x->>'price')::numeric < 1
    or (x->>'price')::numeric*(x->>'units')::numeric > 100000000000000
    or coalesce(x->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (x->>'date')::date < (product->>'date')::date or (x->>'date')::date > current_date
    or (x ? 'paidDate' and ((x->>'paidDate')::date < (x->>'date')::date or (x->>'paidDate')::date > current_date)) then raise exception 'ZAY_INVALID_SALE'; end if;
  end loop;
  for x in select value from jsonb_array_elements(l->'rules') loop
   if coalesce(x->>'type','') not in ('fixed','percent') or coalesce(x->>'base','') not in ('sales','cost')
    or coalesce(x->>'value','') !~ '^\d+$' or (x->>'value')::numeric > 100000000000000
    or (x->>'type'='percent' and (x->>'value')::numeric > 10000)
    or coalesce(length(trim(x->>'name')),0) not between 1 and 250
    or ((x ? 'paidDate') <> (x ? 'paidAmount'))
    or (x ? 'paidAmount' and (coalesce(x->>'paidAmount','') !~ '^\d+$' or (x->>'paidAmount')::numeric > 100000000000000 or (x->>'paidDate')::date > current_date or (x->>'paidDate')::date < (p->>'openingDate')::date))
   then raise exception 'ZAY_INVALID_RULE'; end if;
  end loop;
 end loop;
 for x in select value from jsonb_array_elements(p->'plans') loop
  if coalesce(x->>'amount','') !~ '^\d+$' or (x->>'amount')::numeric not between 1 and 100000000000000
   or coalesce(length(trim(x->>'concept')),0) not between 1 and 250
   or coalesce(x->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (x->>'date')::date < (p->>'openingDate')::date then raise exception 'ZAY_INVALID_PLAN'; end if;
  if x ? 'lotId' and ((x ? 'movementId') or not exists(select 1 from jsonb_array_elements(p->'lots') lot_row where lot_row->>'id'=x->>'lotId')) then raise exception 'ZAY_INVALID_PLAN_LOT'; end if;
  if x ? 'movementId' and not exists(select 1 from jsonb_array_elements(p->'movements') m where m->>'id'=x->>'movementId' and (m->>'amount')::numeric=-(x->>'amount')::numeric and coalesce((m->>'voided')::boolean,false)=false) then raise exception 'ZAY_INVALID_PLAN_PAYMENT'; end if;
 end loop;
 for item_id in
  select value->>'id' from jsonb_array_elements(p->'movements') union all
  select value->>'id' from jsonb_array_elements(p->'plans') union all
  select value->>'id' from jsonb_array_elements(p->'lots') union all
  select item->>'id' from jsonb_array_elements(p->'lots') lot_row, lateral jsonb_array_elements(lot_row->'products') item union all
  select item->>'id' from jsonb_array_elements(p->'lots') lot_row, lateral jsonb_array_elements(lot_row->'sales') item union all
  select item->>'id' from jsonb_array_elements(p->'lots') lot_row, lateral jsonb_array_elements(lot_row->'rules') item
 loop
  if item_id is null or item_id='' or item_id=any(all_ids) then raise exception 'ZAY_INVALID_ID'; end if;
  all_ids:=array_append(all_ids,item_id);
 end loop;
end; $$;
revoke all on function public.zay_validate_state(jsonb) from public, anon, authenticated;

create function public.zay_save_account(p_state jsonb, p_expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); current_revision bigint; next_revision bigint;
begin
 if u is null then raise exception 'ZAY_UNAUTHORIZED'; end if;
 if octet_length(p_state::text) > 20000000 then raise exception 'ZAY_SIZE_LIMIT'; end if;
 perform public.zay_validate_state(p_state);
 -- Serializa también la creación inicial: dos equipos no pueden crear revision 1.
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
