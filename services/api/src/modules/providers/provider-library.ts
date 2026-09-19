import type { ProviderCapabilities, ProviderCode } from "./provider-adapter";

export interface ProviderDefinition {
  code: ProviderCode;
  displayName: string;
  capabilities: ProviderCapabilities;
}

export const INITIAL_PROVIDER_LIBRARY: ProviderDefinition[] = [
  {
    code: "PIXGO",
    displayName: "PixGo",
    capabilities: {
      pixBrl: true,
      supportsIdempotencyKey: false,
      supportsRecoveryByExternalId: true,
      supportsWebhookSignature: true,
      supportsS2SVerification: true,
      supportsRefund: false,
    },
  },
  {
    code: "MISTICPAY",
    displayName: "MisticPay",
    capabilities: {
      pixBrl: true,
      supportsIdempotencyKey: false,
      supportsRecoveryByExternalId: false,
      supportsWebhookSignature: false,
      supportsS2SVerification: true,
      supportsRefund: false,
    },
  },
];
