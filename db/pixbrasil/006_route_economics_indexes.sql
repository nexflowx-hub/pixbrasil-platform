-- Cover new foreign keys identified by Supabase performance advisor.

create index if not exists merchant_api_key_store_grants_store_idx
  on pixbrasil.merchant_api_key_store_grants(store_id);

create index if not exists merchant_api_keys_created_by_idx
  on pixbrasil.merchant_api_keys(created_by)
  where created_by is not null;

create index if not exists route_cost_profiles_gateway_connection_idx
  on pixbrasil.route_cost_profiles(gateway_connection_id);

create index if not exists store_financial_profiles_fee_idx
  on pixbrasil.store_financial_profiles(fee_profile_id)
  where fee_profile_id is not null;
