-- Manual payout request idempotency.

alter table controlplane.payout_requests
  add column if not exists request_key varchar(200);

create unique index if not exists payout_requests_account_request_key_uidx
  on controlplane.payout_requests(account_id,request_key)
  where request_key is not null;
