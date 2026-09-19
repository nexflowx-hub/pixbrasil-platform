-- Cover merchant webhook foreign keys identified by Supabase performance advisor.

create index if not exists merchant_webhook_deliveries_merchant_idx
  on pixbrasil.merchant_webhook_deliveries(merchant_id, created_at desc);

create index if not exists merchant_webhook_deliveries_payment_idx
  on pixbrasil.merchant_webhook_deliveries(payment_intent_id)
  where payment_intent_id is not null;

create index if not exists merchant_webhook_endpoints_creator_idx
  on pixbrasil.merchant_webhook_endpoints(created_by_api_key_id)
  where created_by_api_key_id is not null;
