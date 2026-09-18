export type ProviderCode = "PIXGO" | "MISTICPAY" | (string & {});

export interface ProviderCapabilities {
  pixBrl: boolean;
  supportsIdempotencyKey: boolean;
  supportsRecoveryByExternalId: boolean;
  supportsWebhookSignature: boolean;
  supportsS2SVerification: boolean;
  supportsRefund: boolean;
}

export type ProviderCreateOutcome =
  | { kind: "CREATED"; providerPaymentId: string; payload: unknown }
  | { kind: "REJECTED"; code?: string; message?: string; retriable: false }
  | { kind: "UNAVAILABLE"; message?: string; retriable: true }
  | { kind: "AMBIGUOUS"; message?: string; requiresRecovery: true };

export type ProviderRecoveryOutcome =
  | { kind: "FOUND"; providerPaymentId: string; payload: unknown }
  | { kind: "NOT_FOUND" }
  | { kind: "UNKNOWN"; message?: string };

export interface PixCreateChargeInput {
  paymentIntentId: string;
  externalReference: string;
  amount: string;
  currency: "BRL";
  payer: {
    name?: string;
    taxId: string;
    email?: string;
    phone?: string;
  };
  description?: string;
  webhookUrl: string;
}

export interface PixProviderAdapter {
  readonly code: ProviderCode;
  readonly capabilities: ProviderCapabilities;

  createCharge(input: PixCreateChargeInput, credentials: unknown): Promise<ProviderCreateOutcome>;
  recoverCreate(externalReference: string, credentials: unknown): Promise<ProviderRecoveryOutcome>;
  getCharge(providerPaymentId: string, credentials: unknown): Promise<unknown>;
  verifyWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    credentials: unknown,
  ): Promise<unknown>;
  healthCheck(credentials: unknown): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
}
