-- Production live-execution allowlist.
-- Runtime also requires routing_enforcement=true and Store policy ENFORCED.

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
  'Production PIX provider execution allowlist. Requires routing enforcement and an ENFORCED Store policy.',
  now()
)
on conflict (key) do update
set config=excluded.config,
    description=excluded.description,
    updated_at=now();
