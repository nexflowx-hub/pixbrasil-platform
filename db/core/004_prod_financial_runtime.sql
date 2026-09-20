-- Production financial runtime support.
-- Applied to Atlas Financial Core before release.

alter table controlplane.payout_requests
  add column if not exists idempotency_key varchar(200);

create unique index if not exists payout_requests_account_id_idempotency_key_uq
  on controlplane.payout_requests(account_id,idempotency_key)
  where idempotency_key is not null;

create index if not exists payout_requests_status_created_idx
  on controlplane.payout_requests(status,created_at desc);

with brl as (
  select id from public.assets where code='BRL' and status='ACTIVE' limit 1
),
business_accounts as (
  select a.id as account_id,brl.id as asset_id
  from public.accounts a cross join brl
  where a.type='BUSINESS' and a.status <> 'CLOSED'
)
insert into public.wallets(id,account_id,asset_id,status,created_at,updated_at)
select gen_random_uuid(),ba.account_id,ba.asset_id,'ACTIVE',now(),now()
from business_accounts ba
on conflict (account_id,asset_id) do update
set updated_at=now();

with brl as (
  select id from public.assets where code='BRL' and status='ACTIVE' limit 1
)
insert into public.wallet_balances(
  id,wallet_id,available,pending,reserved,blocked,updated_at
)
select gen_random_uuid(),w.id,0,0,0,0,now()
from public.wallets w
join public.accounts a on a.id=w.account_id and a.type='BUSINESS'
join brl on brl.id=w.asset_id
on conflict (wallet_id) do nothing;

insert into public.ledger_accounts(
  id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
)
select
  gen_random_uuid(),
  'CUSTOMER:' || a.id::text || ':BRL',
  'CUSTOMER',
  a.id,
  null,
  ass.id,
  'Customer BRL',
  true,
  now(),
  now()
from public.accounts a
join public.assets ass on ass.code='BRL'
where a.type='BUSINESS'
on conflict (code) do update
set active=true,updated_at=now();
