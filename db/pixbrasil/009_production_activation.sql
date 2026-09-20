-- PiXBrasil production activation for the Novidades.Store merchant.
-- The global default policy deliberately remains SHADOW.
-- No API key is created by this migration.

with target_policies as (
  select rp.id
  from pixbrasil.routing_policies rp
  join pixbrasil.stores s on s.id=rp.store_id
  join pixbrasil.merchants m on m.id=s.merchant_id
  where m.trade_name='Novidades.Store'
    and s.code in ('SIGNUM','AUTOHUB360','MYPETS-LOJA','MYPETS-ONG','SAUDAVEL-LOJA')
    and rp.status='ACTIVE'
)
update pixbrasil.routing_policies rp
set activation_mode='ENFORCED',
    updated_at=now()
where rp.id in (select id from target_policies);

update controlplane.feature_flags
set enabled=true,
    config=jsonb_build_object(
      'mode','PRODUCTION',
      'scope','ENFORCED_POLICIES_ONLY'
    ),
    description='Enable provider-backed payment execution for ACTIVE Stores whose routing policy is ENFORCED.',
    updated_at=now()
where key='routing_enforcement';

update controlplane.feature_flags
set enabled=true,
    config=jsonb_build_object(
      'mode','TELEGRAM_MANUAL',
      'automaticExecution',false
    ),
    description='Enable manual payout ticket requests. Funds are reserved in Wallet BRL and finalized by Operations.',
    updated_at=now()
where key='manual_payouts';

update controlplane.feature_flags
set enabled=false,
    config=jsonb_build_object(
      'deprecated',true,
      'replacement','routing_enforcement + ENFORCED routing policy'
    ),
    description='Deprecated pilot flag retained for compatibility. Production execution uses routing_enforcement and ENFORCED policies.',
    updated_at=now()
where key='pilot_live_execution';

update controlplane.feature_flags
set enabled=false,
    updated_at=now()
where key in ('manual_ledger_adjustments','provider_auto_webhook_registration');

insert into public.audit_logs(
  id,actor_type,actor_user_id,action,resource_type,resource_id,
  before,after,metadata,created_at
)
values(
  gen_random_uuid(),'SYSTEM',null,'PIXBRASIL_PRODUCTION_ACTIVATED',
  'merchant','NOVIDADES_STORE',
  jsonb_build_object(
    'routingEnforcement',false,
    'manualPayouts',false,
    'routingMode','SHADOW'
  ),
  jsonb_build_object(
    'routingEnforcement',true,
    'manualPayouts',true,
    'routingMode','ENFORCED',
    'automaticPayouts',false
  ),
  jsonb_build_object(
    'stores',jsonb_build_array(
      'SIGNUM','AUTOHUB360','MYPETS-LOJA','MYPETS-ONG','SAUDAVEL-LOJA'
    ),
    'payoutMode','TELEGRAM_MANUAL',
    'globalDefaultPolicy','SHADOW'
  ),
  now()
);
