-- PiXBrasil production financial runtime.
-- Versioned source of the already validated backend-only settlement and manual payout primitives.

create or replace function pixbrasil.ensure_brl_financial_accounts(p_account_id uuid)
returns table(out_wallet_id uuid, out_customer_ledger_account_id uuid)
language plpgsql
as $$
declare
  v_asset_id uuid;
  v_wallet_id uuid;
  v_customer_ledger_id uuid;
begin
  select a.id into v_asset_id
  from public.assets a
  where a.code='BRL' and a.status='ACTIVE'
  limit 1;

  if v_asset_id is null then
    raise exception 'BRL asset is not configured';
  end if;

  insert into public.wallets(id,account_id,asset_id,status,created_at,updated_at)
  values(gen_random_uuid(),p_account_id,v_asset_id,'ACTIVE',now(),now())
  on conflict (account_id,asset_id) do update set updated_at=now()
  returning public.wallets.id into v_wallet_id;

  insert into public.wallet_balances(
    id,wallet_id,available,pending,reserved,blocked,updated_at
  )
  values(gen_random_uuid(),v_wallet_id,0,0,0,0,now())
  on conflict (wallet_id) do nothing;

  insert into public.ledger_accounts(
    id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
  )
  values(
    gen_random_uuid(),
    'CUSTOMER:'||p_account_id::text||':BRL',
    'CUSTOMER',
    p_account_id,
    v_asset_id,
    'Customer BRL',
    true,
    now(),
    now()
  )
  on conflict (code) do update set active=true,updated_at=now()
  returning public.ledger_accounts.id into v_customer_ledger_id;

  return query select v_wallet_id,v_customer_ledger_id;
end;
$$;

revoke all on function pixbrasil.ensure_brl_financial_accounts(uuid)
from public, anon, authenticated;

do $$
declare
  v_asset_id uuid;
begin
  select a.id into v_asset_id from public.assets a where a.code='BRL' limit 1;

  insert into public.ledger_accounts(
    id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
  )
  values(
    gen_random_uuid(),'CLEARING:PIX:BRL','CLEARING',null,null,v_asset_id,
    'PIX BRL Clearing',true,now(),now()
  )
  on conflict (code) do update set active=true,updated_at=now();

  insert into public.ledger_accounts(
    id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
  )
  values(
    gen_random_uuid(),'REVENUE:PIXBRASIL:BRL','REVENUE',null,null,v_asset_id,
    'PiXBrasil BRL Revenue',true,now(),now()
  )
  on conflict (code) do update set active=true,updated_at=now();

  insert into public.ledger_accounts(
    id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
  )
  values(
    gen_random_uuid(),'CLEARING:PAYOUT:BRL','CLEARING',null,null,v_asset_id,
    'Manual Payout BRL Clearing',true,now(),now()
  )
  on conflict (code) do update set active=true,updated_at=now();
end $$;

create or replace function pixbrasil.post_verified_pix_settlement(
  p_payment_intent_id uuid
)
returns table(
  out_settlement_id uuid,
  out_settlement_status text,
  out_net_brl numeric,
  out_available_at timestamptz,
  out_wallet_id uuid
)
language plpgsql
as $$
declare
  v_pi record;
  v_existing record;
  v_quote jsonb;
  v_gross numeric(36,18);
  v_provider_fee numeric(36,18);
  v_platform_fee numeric(36,18);
  v_net numeric(36,18);
  v_asset_id uuid;
  v_wallet_id uuid;
  v_customer_ledger_id uuid;
  v_clearing_id uuid;
  v_revenue_id uuid;
  v_ledger_tx_id uuid;
  v_provider_id uuid;
  v_provider_reference text;
  v_rule record;
  v_settlement_status text;
  v_available_at timestamptz;
  v_settlement_id uuid;
  v_clearing_amount numeric(36,18);
begin
  select pi.* into v_pi
  from pixbrasil.payment_intents pi
  where pi.id=p_payment_intent_id
  for update;

  if not found then
    raise exception 'PaymentIntent % not found', p_payment_intent_id;
  end if;

  if v_pi.status <> 'SUCCEEDED' then
    raise exception 'PaymentIntent % is not SUCCEEDED', p_payment_intent_id;
  end if;

  select s.id,s.status,s.net_brl,s.available_at into v_existing
  from pixbrasil.settlements s
  where s.payment_intent_id=p_payment_intent_id
  limit 1;

  if found then
    select w.id into v_wallet_id
    from public.wallets w
    join public.assets a on a.id=w.asset_id and a.code='BRL'
    where w.account_id=v_pi.account_id
    limit 1;

    return query
    select v_existing.id,v_existing.status,v_existing.net_brl,
           v_existing.available_at,v_wallet_id;
    return;
  end if;

  v_quote := coalesce(
    v_pi.metadata->'economicsQuote',
    v_pi.metadata->'shadowQuote',
    '{}'::jsonb
  );
  v_gross := v_pi.amount;
  v_provider_fee := coalesce(
    nullif(v_quote->>'providerRouteCostBrl','')::numeric,
    0
  );
  v_platform_fee := coalesce(
    nullif(v_quote->>'platformFeeBrl','')::numeric,
    0
  );
  v_net := coalesce(
    nullif(v_quote->>'estimatedMerchantNetBrl','')::numeric,
    v_gross-v_provider_fee-v_platform_fee
  );

  if v_net < 0 then
    raise exception 'Negative merchant net for PaymentIntent %',p_payment_intent_id;
  end if;

  select a.id into v_asset_id from public.assets a where a.code='BRL' limit 1;

  select e.out_wallet_id,e.out_customer_ledger_account_id
    into v_wallet_id,v_customer_ledger_id
  from pixbrasil.ensure_brl_financial_accounts(v_pi.account_id) e;

  select la.id into v_clearing_id
  from public.ledger_accounts la where la.code='CLEARING:PIX:BRL' limit 1;

  select la.id into v_revenue_id
  from public.ledger_accounts la
  where la.code='REVENUE:PIXBRASIL:BRL'
  limit 1;

  select rr.availability_mode,rr.available_after_minutes,rr.max_release_minutes
    into v_rule
  from pixbrasil.release_profiles rp
  join pixbrasil.release_rules rr on rr.release_profile_id=rp.id
  where rp.code=coalesce(v_pi.metadata->>'releaseProfile','')
    and rr.rail='PIX'
    and rr.enabled=true
  order by rr.created_at desc
  limit 1;

  if v_rule.availability_mode='IMMEDIATE' then
    v_settlement_status := 'AVAILABLE';
    v_available_at := now() +
      make_interval(mins => coalesce(v_rule.available_after_minutes,0));
  elsif v_rule.availability_mode='FIXED_DELAY' then
    v_settlement_status := 'PENDING';
    v_available_at := now() +
      make_interval(
        mins => coalesce(
          v_rule.available_after_minutes,
          v_rule.max_release_minutes,
          1440
        )
      );
  else
    v_settlement_status := 'PENDING';
    v_available_at := now() +
      make_interval(mins => coalesce(v_rule.max_release_minutes,1440));
  end if;

  insert into pixbrasil.settlements(
    id,payment_intent_id,gross_brl,provider_fee_brl,platform_fee_brl,net_brl,
    settlement_asset,settlement_network,settlement_amount,status,available_at,
    metadata,created_at,updated_at
  )
  values(
    gen_random_uuid(),p_payment_intent_id,v_gross,v_provider_fee,
    v_platform_fee,v_net,'BRL',null,v_net,v_settlement_status,v_available_at,
    jsonb_build_object(
      'source','VERIFIED_PROVIDER_WEBHOOK',
      'releaseProfile',v_pi.metadata->>'releaseProfile',
      'releaseClass',v_pi.metadata->>'releaseClass'
    ),
    now(),now()
  )
  returning id into v_settlement_id;

  select p.id,pa.provider_payment_id
    into v_provider_id,v_provider_reference
  from pixbrasil.provider_attempts pa
  join pixbrasil.gateway_connections gc on gc.id=pa.gateway_connection_id
  join public.providers p on p.id=gc.provider_id
  where pa.payment_intent_id=p_payment_intent_id
  order by pa.attempt_no desc
  limit 1;

  insert into public.ledger_transactions(
    id,reference,type,status,idempotency_key,external_reference,metadata,
    created_at,posted_at
  )
  values(
    gen_random_uuid(),
    'PIXBRASIL:SETTLEMENT:'||p_payment_intent_id::text,
    'FIAT_DEPOSIT',
    'POSTED',
    'pixbrasil:settlement:'||p_payment_intent_id::text,
    v_pi.external_reference,
    jsonb_build_object(
      'paymentIntentId',p_payment_intent_id,
      'providerFeeBrl',v_provider_fee,
      'platformFeeBrl',v_platform_fee,
      'settlementId',v_settlement_id
    ),
    now(),now()
  )
  on conflict (idempotency_key) do nothing;

  select lt.id into v_ledger_tx_id
  from public.ledger_transactions lt
  where lt.idempotency_key='pixbrasil:settlement:'||p_payment_intent_id::text
  limit 1;

  if not exists(
    select 1 from public.ledger_entries le
    where le.ledger_transaction_id=v_ledger_tx_id
  ) then
    v_clearing_amount := v_gross-v_provider_fee;

    if v_clearing_amount > 0 then
      insert into public.ledger_entries(
        id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
      )
      values(
        gen_random_uuid(),v_ledger_tx_id,v_clearing_id,v_asset_id,
        'DEBIT',v_clearing_amount,now()
      );
    end if;

    if v_net > 0 then
      insert into public.ledger_entries(
        id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
      )
      values(
        gen_random_uuid(),v_ledger_tx_id,v_customer_ledger_id,v_asset_id,
        'CREDIT',v_net,now()
      );
    end if;

    if v_platform_fee > 0 then
      insert into public.ledger_entries(
        id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
      )
      values(
        gen_random_uuid(),v_ledger_tx_id,v_revenue_id,v_asset_id,
        'CREDIT',v_platform_fee,now()
      );
    end if;

    insert into public.transactions(
      id,account_id,wallet_id,ledger_transaction_id,provider_id,type,status,
      asset_id,amount,fee_asset_id,fee_amount,provider_reference,idempotency_key,
      metadata,created_at,updated_at,completed_at
    )
    values(
      gen_random_uuid(),v_pi.account_id,v_wallet_id,v_ledger_tx_id,v_provider_id,
      'FIAT_DEPOSIT','COMPLETED',v_asset_id,v_gross,v_asset_id,
      v_provider_fee+v_platform_fee,v_provider_reference,
      'pixbrasil:transaction:'||p_payment_intent_id::text,
      jsonb_build_object(
        'paymentIntentId',p_payment_intent_id,
        'settlementId',v_settlement_id,
        'netBrl',v_net
      ),
      now(),now(),now()
    )
    on conflict (idempotency_key) do nothing;

    if v_settlement_status='AVAILABLE' then
      update public.wallet_balances wb
      set available=wb.available+v_net,updated_at=now()
      where wb.wallet_id=v_wallet_id;
    else
      update public.wallet_balances wb
      set pending=wb.pending+v_net,updated_at=now()
      where wb.wallet_id=v_wallet_id;
    end if;
  end if;

  return query
  select v_settlement_id,v_settlement_status,v_net,v_available_at,v_wallet_id;
end;
$$;

revoke all on function pixbrasil.post_verified_pix_settlement(uuid)
from public, anon, authenticated;

create or replace function pixbrasil.release_due_settlements(p_limit integer default 100)
returns integer
language plpgsql
as $$
declare
  v_row record;
  v_wallet_id uuid;
  v_count integer := 0;
begin
  for v_row in
    select s.id,s.net_brl,pi.account_id
    from pixbrasil.settlements s
    join pixbrasil.payment_intents pi on pi.id=s.payment_intent_id
    where s.status='PENDING'
      and s.available_at is not null
      and s.available_at <= now()
    order by s.available_at
    for update of s skip locked
    limit greatest(1,least(coalesce(p_limit,100),500))
  loop
    select e.out_wallet_id into v_wallet_id
    from pixbrasil.ensure_brl_financial_accounts(v_row.account_id) e;

    update public.wallet_balances wb
    set pending=wb.pending-v_row.net_brl,
        available=wb.available+v_row.net_brl,
        updated_at=now()
    where wb.wallet_id=v_wallet_id
      and wb.pending >= v_row.net_brl;

    if found then
      update pixbrasil.settlements s
      set status='AVAILABLE',
          metadata=s.metadata||jsonb_build_object('releasedAt',now()),
          updated_at=now()
      where s.id=v_row.id;
      v_count := v_count+1;
    else
      update pixbrasil.settlements s
      set metadata=s.metadata||jsonb_build_object(
        'releaseError','INSUFFICIENT_PENDING_BALANCE',
        'releaseCheckedAt',now()
      ),
      updated_at=now()
      where s.id=v_row.id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function pixbrasil.release_due_settlements(integer)
from public, anon, authenticated;

create unique index if not exists payout_requests_account_external_reference_key
on controlplane.payout_requests(account_id,external_reference)
where external_reference is not null;

create or replace function controlplane.create_manual_payout_ticket(
  p_account_id uuid,
  p_auth_user_id uuid,
  p_amount numeric,
  p_rail text,
  p_idempotency_key text
)
returns table(
  out_payout_id uuid,
  out_status text,
  out_amount numeric,
  out_asset_code text,
  out_external_reference text
)
language plpgsql
as $$
declare
  v_user_id uuid;
  v_asset_id uuid;
  v_wallet_id uuid;
  v_payout_id uuid;
  v_reference text;
  v_existing record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payout amount must be positive';
  end if;

  if upper(coalesce(p_rail,'')) not in ('PIX','CRYPTO') then
    raise exception 'Payout rail must be PIX or CRYPTO';
  end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'Idempotency key is required';
  end if;

  select u.id into v_user_id
  from public.users u
  join public.account_memberships am on am.user_id=u.id
  where u.auth_user_id=p_auth_user_id
    and am.account_id=p_account_id
    and am.status='ACTIVE'
    and am.role in ('OWNER','ADMIN','FINANCE')
  limit 1;

  if v_user_id is null then
    raise exception 'Account payout access is not granted';
  end if;

  v_reference := 'TICKET:'||left(p_idempotency_key,120);

  select pr.id,pr.status,pr.amount,pr.external_reference into v_existing
  from controlplane.payout_requests pr
  where pr.account_id=p_account_id
    and pr.external_reference=v_reference
  limit 1;

  if found then
    return query
    select v_existing.id,v_existing.status,v_existing.amount,
           'BRL'::text,v_existing.external_reference;
    return;
  end if;

  select a.id into v_asset_id from public.assets a where a.code='BRL' limit 1;

  select e.out_wallet_id into v_wallet_id
  from pixbrasil.ensure_brl_financial_accounts(p_account_id) e;

  update public.wallet_balances wb
  set available=wb.available-p_amount,
      reserved=wb.reserved+p_amount,
      updated_at=now()
  where wb.wallet_id=v_wallet_id
    and wb.available >= p_amount;

  if not found then
    raise exception 'Insufficient available balance';
  end if;

  insert into controlplane.payout_requests(
    id,account_id,wallet_id,asset_id,amount,destination_type,destination_snapshot,
    status,external_reference,proof_metadata,requested_by,created_at,updated_at
  )
  values(
    gen_random_uuid(),p_account_id,v_wallet_id,v_asset_id,p_amount,
    'TELEGRAM_TICKET',
    jsonb_build_object(
      'rail',upper(p_rail),
      'channel','TELEGRAM',
      'destinationState','AWAITING_OPERATOR'
    ),
    'APPROVAL_REQUIRED',v_reference,
    jsonb_build_object('source','CLIENT_PORTAL'),
    p_auth_user_id,now(),now()
  )
  returning id into v_payout_id;

  return query
  select v_payout_id,'APPROVAL_REQUIRED'::text,p_amount,'BRL'::text,v_reference;
end;
$$;

revoke all on function controlplane.create_manual_payout_ticket(
  uuid,uuid,numeric,text,text
) from public, anon, authenticated;

create or replace function controlplane.cancel_manual_payout_ticket(
  p_payout_id uuid,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_row record;
  v_allowed boolean;
begin
  select pr.* into v_row
  from controlplane.payout_requests pr
  where pr.id=p_payout_id
  for update;

  if not found then raise exception 'Payout ticket not found'; end if;

  select exists(
    select 1
    from public.users u
    join public.account_memberships am on am.user_id=u.id
    where u.auth_user_id=p_auth_user_id
      and am.account_id=v_row.account_id
      and am.status='ACTIVE'
      and am.role in ('OWNER','ADMIN','FINANCE')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Account payout access is not granted';
  end if;

  if v_row.status not in ('DRAFT','APPROVAL_REQUIRED') then
    raise exception 'Payout ticket can no longer be canceled';
  end if;

  update public.wallet_balances wb
  set reserved=wb.reserved-v_row.amount,
      available=wb.available+v_row.amount,
      updated_at=now()
  where wb.wallet_id=v_row.wallet_id
    and wb.reserved >= v_row.amount;

  if not found then
    raise exception 'Reserved payout balance is inconsistent';
  end if;

  update controlplane.payout_requests pr
  set status='CANCELED',updated_at=now()
  where pr.id=p_payout_id;

  return true;
end;
$$;

revoke all on function controlplane.cancel_manual_payout_ticket(uuid,uuid)
from public, anon, authenticated;

create or replace function controlplane.reject_manual_payout(
  p_payout_id uuid,
  p_admin_auth_user_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
as $$
declare
  v_row record;
  v_admin boolean;
begin
  select exists(
    select 1 from controlplane.admin_users au
    where au.auth_user_id=p_admin_auth_user_id and au.status='ACTIVE'
  ) into v_admin;
  if not v_admin then raise exception 'Admin access is not granted'; end if;

  select pr.* into v_row
  from controlplane.payout_requests pr
  where pr.id=p_payout_id
  for update;

  if not found then raise exception 'Payout ticket not found'; end if;
  if v_row.status not in ('DRAFT','APPROVAL_REQUIRED','APPROVED','PROCESSING') then
    raise exception 'Payout ticket cannot be rejected in current state';
  end if;

  update public.wallet_balances wb
  set reserved=wb.reserved-v_row.amount,
      available=wb.available+v_row.amount,
      updated_at=now()
  where wb.wallet_id=v_row.wallet_id
    and wb.reserved >= v_row.amount;

  if not found then
    raise exception 'Reserved payout balance is inconsistent';
  end if;

  update controlplane.payout_requests pr
  set status='REJECTED',
      proof_metadata=pr.proof_metadata||jsonb_build_object(
        'rejectedBy',p_admin_auth_user_id,
        'rejectedAt',now(),
        'reason',coalesce(p_reason,'')
      ),
      updated_at=now()
  where pr.id=p_payout_id;

  return true;
end;
$$;

revoke all on function controlplane.reject_manual_payout(uuid,uuid,text)
from public, anon, authenticated;

create or replace function controlplane.mark_manual_payout_paid(
  p_payout_id uuid,
  p_admin_auth_user_id uuid,
  p_proof_reference text
)
returns boolean
language plpgsql
as $$
declare
  v_row record;
  v_admin boolean;
  v_asset_id uuid;
  v_customer_ledger_id uuid;
  v_clearing_id uuid;
  v_ledger_tx_id uuid;
begin
  select exists(
    select 1 from controlplane.admin_users au
    where au.auth_user_id=p_admin_auth_user_id and au.status='ACTIVE'
  ) into v_admin;
  if not v_admin then raise exception 'Admin access is not granted'; end if;

  if nullif(trim(coalesce(p_proof_reference,'')),'') is null then
    raise exception 'Proof reference is required';
  end if;

  select pr.* into v_row
  from controlplane.payout_requests pr
  where pr.id=p_payout_id
  for update;

  if not found then raise exception 'Payout ticket not found'; end if;
  if v_row.status='PAID' or v_row.status='CONFIRMED' then return true; end if;
  if v_row.status not in ('APPROVAL_REQUIRED','APPROVED','PROCESSING') then
    raise exception 'Payout ticket cannot be paid in current state';
  end if;

  update public.wallet_balances wb
  set reserved=wb.reserved-v_row.amount,updated_at=now()
  where wb.wallet_id=v_row.wallet_id
    and wb.reserved >= v_row.amount;

  if not found then
    raise exception 'Reserved payout balance is inconsistent';
  end if;

  select a.id into v_asset_id from public.assets a where a.code='BRL' limit 1;

  select e.out_customer_ledger_account_id into v_customer_ledger_id
  from pixbrasil.ensure_brl_financial_accounts(v_row.account_id) e;

  select la.id into v_clearing_id
  from public.ledger_accounts la
  where la.code='CLEARING:PAYOUT:BRL'
  limit 1;

  insert into public.ledger_transactions(
    id,reference,type,status,idempotency_key,external_reference,metadata,
    created_at,posted_at
  )
  values(
    gen_random_uuid(),
    'PIXBRASIL:PAYOUT:'||p_payout_id::text,
    'FIAT_WITHDRAWAL','POSTED',
    'pixbrasil:payout:'||p_payout_id::text,
    v_row.external_reference,
    jsonb_build_object(
      'payoutId',p_payout_id,
      'proofReference',p_proof_reference,
      'manual',true
    ),
    now(),now()
  )
  on conflict (idempotency_key) do nothing;

  select lt.id into v_ledger_tx_id
  from public.ledger_transactions lt
  where lt.idempotency_key='pixbrasil:payout:'||p_payout_id::text
  limit 1;

  if not exists(
    select 1 from public.ledger_entries le
    where le.ledger_transaction_id=v_ledger_tx_id
  ) then
    insert into public.ledger_entries(
      id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
    )
    values
      (
        gen_random_uuid(),v_ledger_tx_id,v_customer_ledger_id,v_asset_id,
        'DEBIT',v_row.amount,now()
      ),
      (
        gen_random_uuid(),v_ledger_tx_id,v_clearing_id,v_asset_id,
        'CREDIT',v_row.amount,now()
      );

    insert into public.transactions(
      id,account_id,wallet_id,ledger_transaction_id,provider_id,type,status,
      asset_id,amount,fee_asset_id,fee_amount,provider_reference,idempotency_key,
      metadata,created_at,updated_at,completed_at
    )
    values(
      gen_random_uuid(),v_row.account_id,v_row.wallet_id,v_ledger_tx_id,null,
      'FIAT_WITHDRAWAL','COMPLETED',v_asset_id,v_row.amount,null,null,
      p_proof_reference,
      'pixbrasil:payout-transaction:'||p_payout_id::text,
      jsonb_build_object('payoutId',p_payout_id,'manual',true),
      now(),now(),now()
    )
    on conflict (idempotency_key) do nothing;
  end if;

  update controlplane.payout_requests pr
  set status='PAID',
      paid_at=coalesce(pr.paid_at,now()),
      proof_metadata=pr.proof_metadata||jsonb_build_object(
        'paidBy',p_admin_auth_user_id,
        'paidAt',now(),
        'proofReference',p_proof_reference
      ),
      updated_at=now()
  where pr.id=p_payout_id;

  return true;
end;
$$;

revoke all on function controlplane.mark_manual_payout_paid(uuid,uuid,text)
from public, anon, authenticated;

create or replace function controlplane.confirm_manual_payout(
  p_payout_id uuid,
  p_admin_auth_user_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_admin boolean;
begin
  select exists(
    select 1 from controlplane.admin_users au
    where au.auth_user_id=p_admin_auth_user_id and au.status='ACTIVE'
  ) into v_admin;
  if not v_admin then raise exception 'Admin access is not granted'; end if;

  update controlplane.payout_requests pr
  set status='CONFIRMED',
      confirmed_at=coalesce(pr.confirmed_at,now()),
      proof_metadata=pr.proof_metadata||jsonb_build_object(
        'confirmedBy',p_admin_auth_user_id,
        'confirmedAt',now()
      ),
      updated_at=now()
  where pr.id=p_payout_id
    and pr.status='PAID';

  if not found then
    if exists(
      select 1 from controlplane.payout_requests
      where id=p_payout_id and status='CONFIRMED'
    ) then
      return true;
    end if;
    raise exception 'Payout must be PAID before confirmation';
  end if;

  return true;
end;
$$;

revoke all on function controlplane.confirm_manual_payout(uuid,uuid)
from public, anon, authenticated;

insert into controlplane.system_settings(key,value,description,updated_at)
values(
  'payout_telegram_username',
  '"AlphanesisRoot"'::jsonb,
  'Manual payout desk on Telegram until automated payout rails are enabled.',
  now()
)
on conflict (key) do update
set value=excluded.value,
    description=excluded.description,
    updated_at=now();

-- Provision the BRL wallet/ledger account for active merchants without changing balances.
select e.out_wallet_id,e.out_customer_ledger_account_id
from public.accounts a
join pixbrasil.merchants m on m.account_id=a.id
cross join lateral pixbrasil.ensure_brl_financial_accounts(a.id) e
where m.status='ACTIVE';
