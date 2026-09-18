# Provider Library and Gateway Vault

## Provider

A Provider is the reusable product definition: PIXGO, MISTICPAY and future PIX/acquiring/on-ramp providers. It never stores merchant secrets.

## Provider account

A Provider Account represents a commercial/API account opened with the provider. A provider can have multiple accounts/environments.

## Gateway connection

A PiXBrasil Gateway Connection binds provider + provider account + optional merchant/store + operational alias + environment + vault secret reference + status + routing metadata.

Aliases such as pixgo-primary or misticpay-enterprise are operational only. Business logic must not infer capabilities from the alias text.

## Vault

Credentials belong in encrypted secret storage. PiXBrasil stores only a vault_secret_id reference. Backend resolves secrets server-side. Never return decrypted provider credentials through browser APIs, logs, audit events, routing decisions, webhook payloads or frontend env variables.

## Adapter contract

Required adapter operations: createCharge, recoverCreate, getCharge, verifyWebhook, mapProviderStatus and healthCheck.

Adapters publish capabilities including supportsIdempotencyKey, supportsRecoveryByExternalId, supportsWebhookSignature, supportsS2SVerification and supportsRefund.

## PixGo

Observed in XPAYMENTS: PIX/BRL creation, X-API-Key auth, recovery/search by external_id, status lookup and webhook flow. PiXBrasil keeps recovery behavior behind the generic adapter contract.

## MisticPay

Observed in XPAYMENTS: PIX/BRL creation, CI/CS server credentials, transaction check endpoint and S2S revalidation before financial posting. PiXBrasil keeps the same principle: webhook signal is not authoritative financial proof by itself.