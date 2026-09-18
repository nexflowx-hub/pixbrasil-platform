# Database Foundation V1

Applied design goals:

- shared AtlasWallet Supabase physical project
- private `pixbrasil` schema
- no duplicate wallet/ledger truth
- PF routing may be scoped directly by `account_id`
- PJ routing may be scoped by merchant/store
- tier conditions are supported in policies/routes
- daily/monthly volume limits have explicit aggregate buckets
- health, cost, latency and success-rate evidence can be recorded
- PixGo and MisticPay are seeded into the shared provider library in DISABLED state
- no provider credentials are stored by the seed
- no gateway connection is created by the seed
- no routing policy is enforced by the seed

Activation requires a later controlled step:
provider account → Vault secret → gateway connection → SHADOW policy → observed decisions → ENFORCED policy.
