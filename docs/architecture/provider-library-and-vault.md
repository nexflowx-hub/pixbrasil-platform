# Provider Library and Gateway Vault

## Provider library

A Provider is the reusable integration definition.

Initial library:

- PIXGO
- MISTICPAY

Future providers must enter through the same adapter/registry contract rather than new controller branches.

## Provider account

A Provider Account represents one commercial/API account opened with a provider.

One provider can have multiple accounts:

```text
PIXGO
 ├─ Account A
 ├─ Account B
 └─ Account C
```

This lets routing distribute traffic between accounts of the same provider as well as across different providers.

Provider Account may contain identifiers and non-secret operational metadata.

It must not store plaintext credentials.

## Gateway connection

`pixbrasil.gateway_connections` binds:

- provider
- provider account
- optional merchant
- optional store
- operational alias
- environment
- vault secret reference
- status
- capabilities/limits/metadata

Examples:

- `pixgo-primary`
- `pixgo-volume-b`
- `misticpay-primary`
- `misticpay-enterprise`

Aliases are operational labels only. Business logic must not infer capabilities from alias text.

## Vault

`vault_secret_id` is an opaque reference to encrypted secret storage.

Runtime resolves credentials server-side.

Never return decrypted provider credentials through:

- browser APIs
- logs
- audit events
- routing decisions
- analytics
- webhook payload mirrors
- frontend environment variables

Credential rotation must not require changing routing policy identity.

## Adapter contract

Required adapter operations:

- createCharge
- recoverCreate
- getCharge
- verifyWebhook
- mapProviderStatus
- healthCheck

Adapters publish capabilities including:

- supportsIdempotencyKey
- supportsRecoveryByExternalId
- supportsWebhookSignature
- supportsS2SVerification
- supportsRefund

## PixGo

Current adapter assumptions observed from the XPAYMENTS flow:

- PIX/BRL creation
- X-API-Key authentication
- recovery/search by external_id
- status lookup
- webhook signal followed by provider verification

Ambiguous create failures can attempt recovery by external reference before any failover decision.

## MisticPay

Current adapter assumptions observed from XPAYMENTS:

- PIX/BRL creation
- CI/CS server credentials
- transaction status check
- S2S revalidation before financial posting

Current contract does not confirm safe recovery by client external reference after ambiguous create. Automatic failover after an ambiguous create is therefore prohibited until reconciliation proves safety.

## Library governance

A provider must progress through:

```text
REGISTERED
→ ACCOUNT_CONFIGURED
→ VAULT_CONFIGURED
→ CONNECTION_DISABLED
→ SHADOW
→ ACTIVE
```

No provider should become routable merely because an adapter class exists.
