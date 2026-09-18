import type {
  NormalizedProviderStatus,
  PixCreateChargeInput,
  PixProviderAdapter,
  ProviderCapabilities,
  ProviderCreateOutcome,
  ProviderHealthResult,
  ProviderRecoveryOutcome,
} from "./provider-adapter";
import {
  asRecord,
  onlyDigits,
  ProviderConfigurationError,
  readJson,
  type FetchLike,
} from "./provider-utils";

const DEFAULT_BASE_URL = "https://api.misticpay.com/api";

interface MisticPayCredentials {
  ci: string;
  cs: string;
  baseUrl: string;
}

function parseCredentials(value: unknown): MisticPayCredentials {
  const credentials = asRecord(value);
  const ci = String(credentials.ci ?? "").trim();
  const cs = String(credentials.cs ?? "").trim();
  const baseUrl = String(credentials.baseUrl ?? DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");

  if (!ci || !cs) {
    throw new ProviderConfigurationError("MisticPay ci/cs credentials are required.");
  }

  return { ci, cs, baseUrl };
}

export class MisticPayAdapter implements PixProviderAdapter {
  readonly code = "MISTICPAY" as const;

  readonly capabilities: ProviderCapabilities = {
    pixBrl: true,
    supportsIdempotencyKey: false,
    supportsRecoveryByExternalId: false,
    supportsWebhookSignature: false,
    supportsS2SVerification: true,
    supportsRefund: false,
  };

  constructor(private readonly fetchImpl: FetchLike = globalThis.fetch) {}

  private async post(
    path: string,
    credentials: MisticPayCredentials,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    return this.fetchImpl(`${credentials.baseUrl}${path}`, {
      method: "POST",
      headers: {
        ci: credentials.ci,
        cs: credentials.cs,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  }

  async createCharge(
    input: PixCreateChargeInput,
    credentialsValue: unknown,
  ): Promise<ProviderCreateOutcome> {
    const credentials = parseCredentials(credentialsValue);
    const amount = Number(input.amount);
    const payerDocument = onlyDigits(input.payer.taxId);
    const payerName = String(input.payer.name ?? "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        kind: "REJECTED",
        code: "INVALID_AMOUNT",
        message: "Amount must be positive.",
        retriable: false,
      };
    }

    if (input.currency !== "BRL") {
      return {
        kind: "REJECTED",
        code: "PIX_BRL_REQUIRED",
        message: "MisticPay PIX route requires BRL.",
        retriable: false,
      };
    }

    if (!payerName) {
      return {
        kind: "REJECTED",
        code: "PAYER_NAME_REQUIRED",
        message: "MisticPay requires payer name.",
        retriable: false,
      };
    }

    if (!/^\d{11}$/.test(payerDocument) && !/^\d{14}$/.test(payerDocument)) {
      return {
        kind: "REJECTED",
        code: "INVALID_TAX_ID",
        message: "CPF/CNPJ is required.",
        retriable: false,
      };
    }

    const providerPayload = {
      amount: Number(amount.toFixed(2)),
      payerName,
      payerDocument,
      transactionId: input.paymentIntentId,
      description: String(
        input.description || `Pagamento ${input.externalReference}`,
      ).slice(0, 180),
      projectWebhook: input.webhookUrl,
    };

    let response: Response;
    try {
      response = await this.post("/transactions/create", credentials, providerPayload);
    } catch (error) {
      return {
        kind: "AMBIGUOUS",
        message: error instanceof Error ? error.message : "MisticPay network failure",
        requiresRecovery: true,
      };
    }

    const body = await readJson(response);

    if (response.status >= 400 && response.status < 500) {
      return {
        kind: "REJECTED",
        code: "MISTICPAY_REJECTED",
        message: String(body.message ?? "MisticPay rejected the charge."),
        retriable: false,
      };
    }

    if (!response.ok) {
      return {
        kind: "AMBIGUOUS",
        message: `MisticPay returned HTTP ${response.status} after charge creation request.`,
        requiresRecovery: true,
      };
    }

    const data = asRecord(body.data);
    const providerPaymentId = String(data.transactionId ?? "").trim();
    const copyPaste = String(data.copyPaste ?? "").trim();

    if (!providerPaymentId || !copyPaste) {
      return {
        kind: "AMBIGUOUS",
        message: "MisticPay returned an incomplete successful response.",
        requiresRecovery: true,
      };
    }

    return {
      kind: "CREATED",
      providerPaymentId,
      payload: body,
    };
  }

  async recoverCreate(
    _idempotencyReference: string,
    _credentials: unknown,
  ): Promise<ProviderRecoveryOutcome> {
    return {
      kind: "UNKNOWN",
      message:
        "MisticPay recovery by client external reference is not confirmed by the current integration contract.",
    };
  }

  async getCharge(
    providerPaymentId: string,
    credentialsValue: unknown,
  ): Promise<unknown> {
    const credentials = parseCredentials(credentialsValue);
    const response = await this.post("/transactions/check", credentials, {
      transactionId: providerPaymentId,
    });
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(`MisticPay getCharge returned HTTP ${response.status}.`);
    }

    return body;
  }

  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
    credentials: unknown,
  ): Promise<unknown> {
    const root = asRecord(payload);
    const transactionId = String(
      root.transactionId ?? asRecord(root.data).transactionId ?? "",
    ).trim();

    if (!transactionId) {
      throw new Error("MisticPay webhook does not contain transactionId.");
    }

    return this.getCharge(transactionId, credentials);
  }

  mapProviderStatus(payload: unknown): NormalizedProviderStatus {
    const root = asRecord(payload);
    const transaction = asRecord(root.transaction);
    const data = asRecord(root.data);
    const dataTransaction = asRecord(data.transaction);
    const state = String(
      transaction.transactionState ??
        dataTransaction.transactionState ??
        data.transactionState ??
        root.transactionState ??
        root.status ??
        "",
    )
      .trim()
      .toUpperCase();

    if (state === "COMPLETO") return "SUCCEEDED";
    if (state === "FALHA") return "FAILED";
    if (state === "CANCELADO") return "CANCELED";
    if (["PENDENTE", "PENDING"].includes(state)) return "PENDING";
    return "UNKNOWN";
  }

  async healthCheck(_credentials: unknown): Promise<ProviderHealthResult> {
    // The currently verified MisticPay integration does not expose a harmless
    // dedicated health endpoint. Runtime health should therefore be derived
    // passively from real attempts and S2S verification metrics.
    return {
      status: "UNKNOWN",
      latencyMs: 0,
      detail: "PASSIVE_HEALTH_ONLY",
    };
  }
}
