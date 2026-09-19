-- Novidades.Store controlled pilot.
-- The percentages below are route economics, not PiXBrasil platform margin.
-- Pilot platform markup is intentionally zero until commercial pricing is defined.

insert into public.pricing_plans(
  id,code,label,fee_basis_points,active,sort_order,metadata,created_at,updated_at
)
select gen_random_uuid(),'PIXBRASIL_BUSINESS_PILOT','PiXBrasil Business Pilot',0,true,5,
       '{"product":"PIXBRASIL","pricingSource":"pixbrasil.fee_profiles","legacyFeeBpsIgnored":true}'::jsonb,
       now(),now()
where not exists (
  select 1 from public.pricing_plans where code='PIXBRASIL_BUSINESS_PILOT'
);

insert into public.policy_profiles(
  id,code,label,operational_mode,
  allow_fiat_deposit,allow_fiat_withdrawal,
  allow_crypto_deposit,allow_crypto_withdrawal,
  allow_exchange,allow_internal_transfer,allow_investment,
  active,metadata,created_at,updated_at
)
select gen_random_uuid(),'PIXBRASIL_BUSINESS_PILOT','PiXBrasil Business Pilot',
       'CONTROLLED',true,true,false,true,false,false,false,
       true,
       '{"product":"PIXBRASIL","mode":"LIVE_PILOT","merchantPortalAuth":"PENDING"}'::jsonb,
       now(),now()
where not exists (
  select 1 from public.policy_profiles where code='PIXBRASIL_BUSINESS_PILOT'
);

insert into public.users(id,auth_user_id,email,status,created_at,updated_at)
select gen_random_uuid(),gen_random_uuid(),'svc-novidades-store@internal.pixbrasil.org','ACTIVE',now(),now()
where not exists (
  select 1 from public.users where email='svc-novidades-store@internal.pixbrasil.org'
);

insert into public.accounts(
  id,user_id,type,status,kyc_status,country_code,base_currency,
  created_at,updated_at,identity_level,pricing_plan_id,policy_profile_id
)
select
  gen_random_uuid(),u.id,'BUSINESS','ACTIVE','NOT_STARTED','BR','BRL',
  now(),now(),'BASIC',pp.id,pol.id
from public.users u
cross join lateral (
  select id from public.pricing_plans
  where code='PIXBRASIL_BUSINESS_PILOT'
  order by created_at desc limit 1
) pp
cross join lateral (
  select id from public.policy_profiles
  where code='PIXBRASIL_BUSINESS_PILOT'
  order by created_at desc limit 1
) pol
where u.email='svc-novidades-store@internal.pixbrasil.org'
  and not exists (
    select 1 from public.accounts a where a.user_id=u.id and a.type='BUSINESS'
  );

insert into public.account_products(account_id,product_code,status,metadata)
select a.id,'PIXBRASIL','ACTIVE','{"pilot":true,"integrationMode":"S2S"}'::jsonb
from public.accounts a
join public.users u on u.id=a.user_id
where u.email='svc-novidades-store@internal.pixbrasil.org'
  and a.type='BUSINESS'
on conflict (account_id,product_code) do update
set status='ACTIVE',metadata=excluded.metadata,updated_at=now();

insert into pixbrasil.merchants(account_id,status,tier_code,legal_name,trade_name,metadata)
select
  a.id,'ACTIVE','BUSINESS_PILOT',null,'Novidades.Store',
  '{"merchantCode":"NOVIDADES_STORE","pilot":true,"integrationMode":"S2S","pricingMode":"ROUTE_COST_PLUS_PLATFORM_FEE","kycGate":"PENDING","portalAuth":"PENDING"}'::jsonb
from public.accounts a
join public.users u on u.id=a.user_id
where u.email='svc-novidades-store@internal.pixbrasil.org'
  and a.type='BUSINESS'
  and not exists (
    select 1 from pixbrasil.merchants m where m.account_id=a.id
  );

insert into pixbrasil.stores(merchant_id,code,name,status,currency,metadata)
select m.id,v.code,v.name,'ACTIVE','BRL',v.metadata
from pixbrasil.merchants m
cross join (
  values
    ('SIGNUM','Signum','{"routeClass":"D0","expectedProvider":"MISTICPAY","pilot":true}'::jsonb),
    ('AUTOHUB360','AutoHub360','{"routeClass":"D0","expectedProvider":"MISTICPAY","pilot":true}'::jsonb),
    ('MYPETS-LOJA','MyPets-Loja','{"routeClass":"D0","expectedProvider":"MISTICPAY","pilot":true}'::jsonb),
    ('MYPETS-ONG','MyPets-ONG','{"routeClass":"D1","expectedProvider":"PIXGO","pilot":true}'::jsonb),
    ('SAUDAVEL-LOJA','Saudavel-Loja','{"routeClass":"D0","expectedProvider":"MISTICPAY","pilot":true}'::jsonb)
) as v(code,name,metadata)
where m.trade_name='Novidades.Store'
on conflict (merchant_id,code) do update
set name=excluded.name,status='ACTIVE',metadata=excluded.metadata,updated_at=now();

insert into pixbrasil.route_cost_profiles(code,name,gateway_connection_id,release_class,status,metadata)
select 'MISTICPAY_D0','MisticPay PIX D0',gc.id,'D0','ACTIVE',
       '{"provider":"MISTICPAY","commercialModel":"ROUTE_COST_BASELINE","source":"USER_SPECIFIED_2026-09-19"}'::jsonb
from pixbrasil.gateway_connections gc
where gc.alias='misticpay-primary'
on conflict (code) do update
set gateway_connection_id=excluded.gateway_connection_id,release_class='D0',
    status='ACTIVE',metadata=excluded.metadata,updated_at=now();

insert into pixbrasil.route_cost_profiles(code,name,gateway_connection_id,release_class,status,metadata)
select 'PIXGO_D1','PixGo PIX D1',gc.id,'D1','ACTIVE',
       '{"provider":"PIXGO","commercialModel":"ROUTE_COST_BASELINE","source":"USER_SPECIFIED_2026-09-19"}'::jsonb
from pixbrasil.gateway_connections gc
where gc.alias='pixgo-primary'
on conflict (code) do update
set gateway_connection_id=excluded.gateway_connection_id,release_class='D1',
    status='ACTIVE',metadata=excluded.metadata,updated_at=now();

insert into pixbrasil.release_profiles(code,name,release_class,status,metadata)
values
('PIX_D0','PIX D0 Immediate Release','D0','ACTIVE','{"source":"USER_SPECIFIED_2026-09-19"}'::jsonb),
('PIX_D1','PIX D1 Controlled Release','D1','ACTIVE','{"source":"USER_SPECIFIED_2026-09-19"}'::jsonb)
on conflict (code) do update
set name=excluded.name,release_class=excluded.release_class,status=excluded.status,
    metadata=excluded.metadata,updated_at=now();

delete from pixbrasil.route_cost_rules
where route_cost_profile_id in (
  select id from pixbrasil.route_cost_profiles where code in ('MISTICPAY_D0','PIXGO_D1')
);

insert into pixbrasil.route_cost_rules(
  route_cost_profile_id,direction,rail,asset_code,network_code,
  fee_bps,fixed_fee_brl,min_amount_brl,max_amount_brl,metadata
)
values
((select id from pixbrasil.route_cost_profiles where code='MISTICPAY_D0'),'INBOUND','PIX',null,null,600,0,null,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost"}'),
((select id from pixbrasil.route_cost_profiles where code='MISTICPAY_D0'),'OUTBOUND','PIX',null,null,600,2,null,49.99,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost","lowAmountSurcharge":true}'),
((select id from pixbrasil.route_cost_profiles where code='MISTICPAY_D0'),'OUTBOUND','PIX',null,null,600,0,50,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost"}'),
((select id from pixbrasil.route_cost_profiles where code='MISTICPAY_D0'),'OUTBOUND','CRYPTO','USDT','BEP20',600,0,null,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost","feeAssumption":"same outbound rate as route"}'),
((select id from pixbrasil.route_cost_profiles where code='PIXGO_D1'),'INBOUND','PIX',null,null,750,0,null,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost"}'),
((select id from pixbrasil.route_cost_profiles where code='PIXGO_D1'),'OUTBOUND','PIX',null,null,650,0,null,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost"}'),
((select id from pixbrasil.route_cost_profiles where code='PIXGO_D1'),'OUTBOUND','CRYPTO',null,null,650,0,null,null,'{"source":"USER_SPECIFIED","meaning":"provider_route_cost","assetScope":"ANY"}');

delete from pixbrasil.release_rules
where release_profile_id in (
  select id from pixbrasil.release_profiles where code in ('PIX_D0','PIX_D1')
);

insert into pixbrasil.release_rules(
  release_profile_id,rail,asset_code,network_code,
  availability_mode,available_after_minutes,max_release_minutes,
  payout_mode,ticket_required,metadata
)
values
((select id from pixbrasil.release_profiles where code='PIX_D0'),'PIX',null,null,'IMMEDIATE',0,20,'CONTROLLED',false,'{"description":"PIX payout target <=20 minutes"}'),
((select id from pixbrasil.release_profiles where code='PIX_D0'),'CRYPTO','USDT','BEP20','IMMEDIATE',0,30,'CONTROLLED',false,'{"description":"USDT BEP20 payout target <=30 minutes"}'),
((select id from pixbrasil.release_profiles where code='PIX_D1'),'PIX',null,null,'PROVIDER_RELEASE',null,1440,'MANUAL_TICKET',true,'{"description":"Manual PIX payout after provider release; maximum release window 24h"}'),
((select id from pixbrasil.release_profiles where code='PIX_D1'),'CRYPTO',null,null,'PROVIDER_RELEASE',null,1440,'MANUAL_TICKET',true,'{"description":"Manual crypto payout, any supported asset/network, after provider release; maximum release window 24h"}');

insert into pixbrasil.fee_profiles(code,name,scope_type,merchant_id,currency,priority,status,metadata)
select
  'NOVIDADES_STORE_PILOT_PLATFORM','Novidades.Store Pilot Platform Pricing',
  'MERCHANT',m.id,'BRL',50,'ACTIVE',
  '{"platformMarkupMode":"ZERO_DURING_PILOT","routeCostPassedSeparately":true,"configurable":true}'::jsonb
from pixbrasil.merchants m
where m.trade_name='Novidades.Store'
on conflict (code) do update
set merchant_id=excluded.merchant_id,status='ACTIVE',metadata=excluded.metadata,updated_at=now();

delete from pixbrasil.fee_rules
where fee_profile_id=(select id from pixbrasil.fee_profiles where code='NOVIDADES_STORE_PILOT_PLATFORM');

insert into pixbrasil.fee_rules(
  fee_profile_id,payment_method,transaction_type,fee_bps,fixed_fee_brl,
  settlement_delay_days,enabled,metadata
)
values
((select id from pixbrasil.fee_profiles where code='NOVIDADES_STORE_PILOT_PLATFORM'),'PIX','PAYMENT',0,0,0,true,'{"component":"PLATFORM_MARKUP","pilot":true}'),
((select id from pixbrasil.fee_profiles where code='NOVIDADES_STORE_PILOT_PLATFORM'),'PIX','PAYOUT',0,0,0,true,'{"component":"PLATFORM_MARKUP","pilot":true}'),
((select id from pixbrasil.fee_profiles where code='NOVIDADES_STORE_PILOT_PLATFORM'),'CRYPTO','PAYOUT',0,0,0,true,'{"component":"PLATFORM_MARKUP","pilot":true}');

insert into pixbrasil.store_financial_profiles(
  store_id,route_cost_profile_id,release_profile_id,fee_profile_id,
  allow_cross_release_class_failover,metadata
)
select
  s.id,
  case when s.code='MYPETS-ONG'
    then (select id from pixbrasil.route_cost_profiles where code='PIXGO_D1')
    else (select id from pixbrasil.route_cost_profiles where code='MISTICPAY_D0')
  end,
  case when s.code='MYPETS-ONG'
    then (select id from pixbrasil.release_profiles where code='PIX_D1')
    else (select id from pixbrasil.release_profiles where code='PIX_D0')
  end,
  (select id from pixbrasil.fee_profiles where code='NOVIDADES_STORE_PILOT_PLATFORM'),
  false,
  '{"pilot":true,"crossReleaseClassFailover":"DENIED","pricingResolution":"STORE_PROFILE_THEN_MERCHANT_THEN_ACCOUNT"}'::jsonb
from pixbrasil.stores s
join pixbrasil.merchants m on m.id=s.merchant_id
where m.trade_name='Novidades.Store'
on conflict (store_id) do update
set route_cost_profile_id=excluded.route_cost_profile_id,
    release_profile_id=excluded.release_profile_id,
    fee_profile_id=excluded.fee_profile_id,
    allow_cross_release_class_failover=false,
    metadata=excluded.metadata,
    updated_at=now();

insert into pixbrasil.routing_policies(
  merchant_id,store_id,name,payment_method,currency,strategy,
  activation_mode,status,priority,config
)
select
  m.id,s.id,
  'NS-' || s.code || '-PIX-' || case when s.code='MYPETS-ONG' then 'D1' else 'D0' end,
  'PIX','BRL','PRIORITY_FAILOVER','SHADOW','ACTIVE',10,
  jsonb_build_object(
    'routeClass',case when s.code='MYPETS-ONG' then 'D1' else 'D0' end,
    'crossReleaseClassFailover',false,'pilot',true,'merchantCode','NOVIDADES_STORE'
  )
from pixbrasil.merchants m
join pixbrasil.stores s on s.merchant_id=m.id
where m.trade_name='Novidades.Store'
  and not exists (
    select 1 from pixbrasil.routing_policies rp
    where rp.store_id=s.id and rp.payment_method='PIX' and rp.currency='BRL'
      and rp.status in ('ACTIVE','PAUSED')
  );

insert into pixbrasil.routing_routes(
  policy_id,gateway_connection_id,priority,weight,health_required,conditions,enabled
)
select
  rp.id,gc.id,10,1,true,
  jsonb_build_object(
    'requiredReleaseClass',case when s.code='MYPETS-ONG' then 'D1' else 'D0' end,
    'safeFailoverWithinClassOnly',true
  ),
  true
from pixbrasil.routing_policies rp
join pixbrasil.stores s on s.id=rp.store_id
join pixbrasil.merchants m on m.id=s.merchant_id
join pixbrasil.gateway_connections gc
  on gc.alias=case when s.code='MYPETS-ONG' then 'pixgo-primary' else 'misticpay-primary' end
where m.trade_name='Novidades.Store'
  and not exists (
    select 1 from pixbrasil.routing_routes rr
    where rr.policy_id=rp.id and rr.gateway_connection_id=gc.id
  );
