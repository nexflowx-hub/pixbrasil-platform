-- Production webhook delivery idempotency.
-- Prevent duplicate merchant payment-event deliveries per endpoint/payment/event.

create unique index if not exists merchant_webhook_deliveries_payment_event_uq
  on pixbrasil.merchant_webhook_deliveries(
    endpoint_id,
    payment_intent_id,
    event_type
  )
  where payment_intent_id is not null;
