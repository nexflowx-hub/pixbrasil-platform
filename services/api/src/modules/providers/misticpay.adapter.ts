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
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  authMode: "BASIC" | "LEGACY";
}

function parseCredentials(value: unknown): MisticPayCredentials {
  const credentials = asRecord(value);
  const modernClientId = String(
    credentials.clientId ?? credentials.client_id ?? credentials.pk ?? "",
  ).trim();
  const modernClientSecret = String(
    credentials.clientSecret ??
      credentials.client_secret ??
      credentials.sk ??
      "",
  ).trim();
  const legacyCi = String(credentials.ci ?? "").trim();
  const legacyCs = String(credentials.cs ?? "").trim();
  const baseUrl = String(credentials.baseUrl ?? DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");

  if (modernClientId && modernClientSecret) {
    return {
      clientId: modernClientId,
      clientSecret: modernClientSecret,
      baseUrl,
      authMode: "BASIC",
    };
  }

  if (legacyCi && legacyCs) {
    return {
      clientId: legacyCi,
      clientSecret: legacyCs,
      baseUrl,
      authMode: "LEGACY",
    };
  }

  throw new ProviderConfigurationError(
    "MisticPay clientId/clientSecret credentials are required.",
  );
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

  private headers(credentials: MisticPayCredentials): Record<string, string> {
    if (credentials.authMode === "BASIC") {
      return {
        Authorization:
          "Basic " +
          Buffer.from(
            `${credentials.clientId}:${credentials.clientSecret}`,
          ).toString("base64"),
        "Content-Type": "application/json",
      };
    }

    return {
      ci: credentials.clientId,
      cs: credentials.clientSecret,
      "Content-Type": "application/json",
    };
  }

  private async post(
    path: string,
    credentials: MisticPayCredentials,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    return this.fetchImpl(`${credentials.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(credentials),
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
      response = await this.post(
        "/transactions/create",
        credentials,
        providerPayload,
      );
    } catch (error) {
      return {
        kind: "AMBIGUOUS",
        message:
          error instanceof Error ? error.message : "MisticPay network failure",
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
      throw new Error(
        `MisticPay getCharge returned HTTP ${response.status}.`,
      );
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

  async healthCheck(
    credentialsValue: unknown,
  ): Promise<ProviderHealthResult> {
    const credentials = parseCredentials(credentialsValue);
    const startedAt = Date.now();

    if (credentials.authMode !== "BASIC") {
      return {
        status: "DEGRADED",
        latencyMs: 0,
        detail: "LEGACY_CI_CS_REQUIRES_MIGRATION",
      };
    }

    try {
      const response = await this.fetchImpl(
        `${credentials.baseUrl}/users/info`,
        {
          method: "GET",
          headers: this.headers(credentials),
          signal: AbortSignal.timeout(5_000),
        },
      );

      return {
        status: response.ok ? "HEALTHY" : "DEGRADED",
        latencyMs: Date.now() - startedAt,
        detail: response.ok ? undefined : `HTTP_${response.status}`,
      };
    } catch (error) {
      return {
        status: "DOWN",
        latencyMs: Date.now() - startedAt,
        detail:
          error instanceof Error ? error.message : "NETWORK_ERROR",
      };
    }
  }
}
