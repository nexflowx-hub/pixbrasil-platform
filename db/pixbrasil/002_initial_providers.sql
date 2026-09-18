-- Initial PiXBrasil provider library.
-- Providers are registered DISABLED and have no credentials/connections.

with pixgo_insert as (
  insert into public.providers (
    id, code, name, type, environment, status, priority, created_at, updated_at
  )
  select
    gen_random_uuid(),
    'PIXGO',
    'PixGo',
    'FIAT'::"ProviderType",
    'PRODUCTION'::"ProviderEnvironment",
    'DISABLED'::"ProviderStatus",
    100,
    now(),
    now()
  where not exists (
    select 1 from public.providers where lower(code) = 'pixgo'
  )
  returning id
),
pixgo as (
  select id from pixgo_insert
  union all
  select id from public.providers where lower(code) = 'pixgo'
  limit 1
),
pixgo_caps(code, metadata) as (
  values
    ('PIX_BRL_CREATE', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('PIX_BRL_STATUS', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('RECOVERY_BY_EXTERNAL_ID', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('WEBHOOK', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('S2S_STATUS', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb)
)
insert into public.provider_capabilities (
  id, provider_id, asset_id, code, enabled, metadata, created_at, updated_at
)
select
  gen_random_uuid(),
  p.id,
  null,
  c.code,
  true,
  c.metadata,
  now(),
  now()
from pixgo p
cross join pixgo_caps c
where not exists (
  select 1
  from public.provider_capabilities pc
  where pc.provider_id = p.id
    and pc.code = c.code
    and pc.asset_id is null
);

with mistic_insert as (
  insert into public.providers (
    id, code, name, type, environment, status, priority, created_at, updated_at
  )
  select
    gen_random_uuid(),
    'MISTICPAY',
    'MisticPay',
    'FIAT'::"ProviderType",
    'PRODUCTION'::"ProviderEnvironment",
    'DISABLED'::"ProviderStatus",
    100,
    now(),
    now()
  where not exists (
    select 1 from public.providers where lower(code) = 'misticpay'
  )
  returning id
),
mistic as (
  select id from mistic_insert
  union all
  select id from public.providers where lower(code) = 'misticpay'
  limit 1
),
mistic_caps(code, metadata) as (
  values
    ('PIX_BRL_CREATE', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('PIX_BRL_STATUS', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('WEBHOOK', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb),
    ('S2S_VERIFICATION', '{"product":"PIXBRASIL","observedFrom":"XPAYMENTS"}'::jsonb)
)
insert into public.provider_capabilities (
  id, provider_id, asset_id, code, enabled, metadata, created_at, updated_at
)
select
  gen_random_uuid(),
  p.id,
  null,
  c.code,
  true,
  c.metadata,
  now(),
  now()
from mistic p
cross join mistic_caps c
where not exists (
  select 1
  from public.provider_capabilities pc
  where pc.provider_id = p.id
    and pc.code = c.code
    and pc.asset_id is null
);
