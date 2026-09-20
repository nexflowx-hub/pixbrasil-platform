-- PiXBrasil production financial core v1
-- Provisions BRL wallets/ledger accounts for business accounts and secures
-- payout destinations in Supabase Vault.

alter table controlplane.payout_requests
  add column if not exists destination_vault_secret_id uuid;

create index if not exists payout_requests_status_created_idx
  on controlplane.payout_requests(status, created_at desc);

create index if not exists payout_requests_account_created_idx
  on controlplane.payout_requests(account_id, created_at desc);

update public.assets
set deposit_enabled=true,
    withdraw_enabled=true,
    updated_at=current_timestamp
where code='BRL'
  and status='ACTIVE';

-- Provision a BRL wallet for every active Business account.
insert into public.wallets(
  id,account_id,asset_id,status,provider_id,provider_account_id,created_at,updated_at
)
select
  gen_random_uuid(),
  a.id,
  ass.id,
  'ACTIVE'::"WalletStatus",
  null,
  null,
  current_timestamp,
  current_timestamp
from public.accounts a
join public.assets ass on ass.code='BRL'
where a.type='BUSINESS'
  and a.status='ACTIVE'
on conflict (account_id,asset_id) do nothing;

insert into public.wallet_balances(
  id,wallet_id,available,pending,reserved,blocked,updated_at
)
select
  gen_random_uuid(),
  w.id,
  0,0,0,0,
  current_timestamp
from public.wallets w
join public.accounts a on a.id=w.account_id
join public.assets ass on ass.id=w.asset_id and ass.code='BRL'
where a.type='BUSINESS'
on conflict (wallet_id) do nothing;

-- Customer liability account per Business account.
insert into public.ledger_accounts(
  id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
)
select
  gen_random_uuid(),
  'CUSTOMER:' || a.id::text || ':BRL',
  'CUSTOMER'::"LedgerAccountType",
  a.id,
  null,
  ass.id,
  coalesce(m.trade_name,'Business') || ' BRL',
  true,
  current_timestamp,
  current_timestamp
from public.accounts a
join public.assets ass on ass.code='BRL'
left join pixbrasil.merchants m on m.account_id=a.id
where a.type='BUSINESS'
  and a.status='ACTIVE'
on conflict (code) do nothing;

-- Platform ledger accounts for balanced PIX postings.
insert into public.ledger_accounts(
  id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
)
select gen_random_uuid(),'CLEARING:PIX:BRL','CLEARING'::"LedgerAccountType",
       null,null,ass.id,'PIX BRL Clearing',true,current_timestamp,current_timestamp
from public.assets ass where ass.code='BRL'
on conflict (code) do nothing;

insert into public.ledger_accounts(
  id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
)
select gen_random_uuid(),'REVENUE:PIXBRASIL:BRL','REVENUE'::"LedgerAccountType",
       null,null,ass.id,'PiXBrasil BRL Revenue',true,current_timestamp,current_timestamp
from public.assets ass where ass.code='BRL'
on conflict (code) do nothing;

insert into public.ledger_accounts(
  id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
)
select gen_random_uuid(),'EXPENSE:PIX_PROVIDER:BRL','EXPENSE'::"LedgerAccountType",
       null,null,ass.id,'PIX Provider Cost',true,current_timestamp,current_timestamp
from public.assets ass where ass.code='BRL'
on conflict (code) do nothing;

-- D1 is an operational 24h hold in PiXBrasil v1. Provider status remains
-- verified independently by the provider adapter/webhook.
update pixbrasil.release_rules rr
set availability_mode='FIXED_DELAY',
    available_after_minutes=1440,
    max_release_minutes=1440,
    updated_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb) ||
      '{"productionPolicy":"D1_24H_INTERNAL_HOLD"}'::jsonb
from pixbrasil.release_profiles rp
where rr.release_profile_id=rp.id
  and rp.code='PIX_D1'
  and rr.rail='PIX'
  and rr.enabled=true;

comment on column controlplane.payout_requests.destination_vault_secret_id is
  'Supabase Vault secret id containing the payout destination. destination_snapshot stores masked metadata only.';


-- PixGo currently enforces a minimum PIX amount of BRL 10.00.
update pixbrasil.routing_routes rr
set min_amount=greatest(coalesce(rr.min_amount,0),10),
    updated_at=now()
from pixbrasil.gateway_connections gc
join public.providers p on p.id=gc.provider_id
where rr.gateway_connection_id=gc.id
  and p.code='PIXGO'
  and rr.enabled=true;

update controlplane.feature_flags
set description='Production manual payout ticket queue. Requests reserve Wallet BRL and are completed by operations.',
    updated_at=now()
where key='manual_payouts';

update controlplane.feature_flags
set description='Global production routing enforcement. Enable only with ENFORCED Store policies and matching API runtime.',
    updated_at=now()
where key='routing_enforcement';
