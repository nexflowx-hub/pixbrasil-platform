-- PiXBrasil production financial runtime controls.
-- The live switch is intentionally seeded OFF. Enable only after API v0.6.0
-- is ONLINE/READY and the target account has APPROVED KYC.

insert into controlplane.feature_flags(
  key,enabled,config,description,updated_at
)
values(
  'live_payment_execution',
  false,
  jsonb_build_object(
    'merchantIds',jsonb_build_array('2ec01185-919c-48d2-8af2-4a8fbbcbed47'),
    'storeCodes',jsonb_build_array(
      'SIGNUM','AUTOHUB360','MYPETS-LOJA','MYPETS-ONG','SAUDAVEL-LOJA'
    )
  ),
  'Production PIX provider execution. Requires routing enforcement, ENFORCED Store policy, ACTIVE account and APPROVED KYC.',
  now()
)
on conflict (key) do update
set config=excluded.config,
    description=excluded.description,
    updated_at=now();

update controlplane.feature_flags
set description='Production manual payout ticket queue. Requests reserve Wallet BRL and are completed by operations.',
    config=coalesce(config,'{}'::jsonb) || jsonb_build_object('mode','TELEGRAM_MANUAL'),
    updated_at=now()
where key='manual_payouts';
