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
  elapsedMs,
  onlyDigits,
  ProviderConfigurationError,
  readJson,
  type FetchLike,
} from "./provider-utils";

const DEFAULT_BASE_URL = "https://pixgo.org/api/v1";

interface PixGoCredentials {
  apiKey: string;
  baseUrl: string;
}

function parseCredentials(value: unknown): PixGoCredentials {
  const credentials = asRecord(value);
  const apiKey = String(credentials.apiKey ?? credentials.api_key ?? "").trim();
  const baseUrl = String(credentials.baseUrl ?? DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");

  if (!apiKey) {
    throw new ProviderConfigurationError("PixGo apiKey is required.");
  }

  return { apiKey, baseUrl };
}

export class PixGoAdapter implements PixProviderAdapter {
  readonly code = "PIXGO" as const;

  readonly capabilities: ProviderCapabilities = {
    pixBrl: true,
    supportsIdempotencyKey: false,
    supportsRecoveryByExternalId: true,
    supportsWebhookSignature: true,
    supportsS2SVerification: true,
    supportsRefund: false,
  };

  constructor(private readonly fetchImpl: FetchLike = globalThis.fetch) {}

  async createCharge(
    input: PixCreateChargeInput,
    credentialsValue: unknown,
  ): Promise<ProviderCreateOutcome> {
    const credentials = parseCredentials(credentialsValue);
    const amount = Number(input.amount);
    const payerDocument = onlyDigits(input.payer.taxId);

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
        message: "PixGo PIX route requires BRL.",
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

    const payload: Record<string, unknown> = {
      amount: Number(amount.toFixed(2)),
      receiver_cpf: payerDocument,
      external_id: input.paymentIntentId,
      description: String(
        input.description || `Pagamento ${input.externalReference}`,
      ).slice(0, 200),
      webhook_url: input.webhookUrl,
    };

    if (input.payer.name) payload.receiver_name = input.payer.name.slice(0, 100);
    if (input.payer.email) payload.receiver_email = input.payer.email.slice(0, 255);

    const phone = onlyDigits(input.payer.phone);
    if (phone.length === 10 || phone.length === 11) {
      payload.receiver_phone = phone;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${credentials.baseUrl}/payment/create`, {
        method: "POST",
        headers: {
          "X-API-Key": credentials.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      return {
        kind: "AMBIGUOUS",
        message: error instanceof Error ? error.message : "PixGo network failure",
        requiresRecovery: true,
      };
    }

    const body = await readJson(response);

    if (response.status >= 400 && response.status < 500) {
      return {
        kind: "REJECTED",
        code: String(body.error ?? "PIXGO_REJECTED"),
        message: String(body.message ?? "PixGo rejected the charge."),
        retriable: false,
      };
    }

    if (!response.ok) {
      return {
        kind: "AMBIGUOUS",
        message: `PixGo returned HTTP ${response.status} after charge creation request.`,
        requiresRecovery: true,
      };
    }

    const data = asRecord(body.data);
    const providerPaymentId = String(data.payment_id ?? "").trim();
    const copyPaste = String(data.qr_code ?? "").trim();

    if (!providerPaymentId || !copyPaste) {
      return {
        kind: "AMBIGUOUS",
        message: "PixGo returned an incomplete successful response.",
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
    idempotencyReference: string,
    credentialsValue: unknown,
  ): Promise<ProviderRecoveryOutcome> {
    const credentials = parseCredentials(credentialsValue);
    const url =
      `${credentials.baseUrl}/payments?external_id=` +
      `${encodeURIComponent(idempotencyReference)}&limit=20&offset=0`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { "X-API-Key": credentials.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      return {
        kind: "UNKNOWN",
        message: error instanceof Error ? error.message : "PixGo recovery unavailable",
      };
    }

    if (!response.ok) {
      return {
        kind: "UNKNOWN",
        message: `PixGo recovery returned HTTP ${response.status}.`,
      };
    }

    const body = await readJson(response);
    const rows = Array.isArray(body.data) ? body.data : [];
    const matched = rows
      .map(asRecord)
      .find((row) => String(row.external_id ?? "") === idempotencyReference);

    if (!matched) return { kind: "NOT_FOUND" };

    const providerPaymentId = String(matched.payment_id ?? "").trim();
    if (!providerPaymentId) {
      return {
        kind: "UNKNOWN",
        message: "PixGo recovery found a row without payment_id.",
      };
    }

    return {
      kind: "FOUND",
      providerPaymentId,
      payload: matched,
    };
  }

  async getCharge(
    providerPaymentId: string,
    credentialsValue: unknown,
  ): Promise<unknown> {
    const credentials = parseCredentials(credentialsValue);
    const response = await this.fetchImpl(
      `${credentials.baseUrl}/payment/${encodeURIComponent(providerPaymentId)}`,
      {
        method: "GET",
        headers: { "X-API-Key": credentials.apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    );

    const body = await readJson(response);
    if (!response.ok && response.status !== 410) {
      throw new Error(`PixGo getCharge returned HTTP ${response.status}.`);
    }
    return body;
  }

  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
    credentials: unknown,
  ): Promise<unknown> {
    const root = asRecord(payload);
    const data = asRecord(root.data);
    const paymentId = String(
      data.payment_id ?? root.payment_id ?? root.paymentId ?? "",
    ).trim();

    if (!paymentId) {
      throw new Error("PixGo webhook does not contain payment_id.");
    }

    return this.getCharge(paymentId, credentials);
  }

  mapProviderStatus(payload: unknown): NormalizedProviderStatus {
    const root = asRecord(payload);
    const data = asRecord(root.data);
    const status = String(
      data.status ?? root.status ?? root.event ?? "",
    )
      .trim()
      .toLowerCase();

    if (["completed", "complete", "paid", "succeeded", "payment.completed"].includes(status)) {
      return "SUCCEEDED";
    }
    if (["failed", "rejected", "payment.failed"].includes(status)) return "FAILED";
    if (["expired", "canceled", "cancelled", "payment.expired"].includes(status)) {
      return "CANCELED";
    }
    if (["refunded", "payment.refunded"].includes(status)) return "REFUNDED";
    if (["pending", "created", "waiting_payment"].includes(status)) return "PENDING";
    return "UNKNOWN";
  }

  async healthCheck(credentialsValue: unknown): Promise<ProviderHealthResult> {
    const credentials = parseCredentials(credentialsValue);
    const startedAt = Date.now();

    try {
      const response = await this.fetchImpl(
        `${credentials.baseUrl}/payments?external_id=__pixbrasil_healthcheck__&limit=1&offset=0`,
        {
          method: "GET",
          headers: { "X-API-Key": credentials.apiKey },
          signal: AbortSignal.timeout(5_000),
        },
      );

      return {
        status: response.ok ? "HEALTHY" : "DEGRADED",
        latencyMs: elapsedMs(startedAt),
        detail: response.ok ? undefined : `HTTP_${response.status}`,
      };
    } catch (error) {
      return {
        status: "DOWN",
        latencyMs: elapsedMs(startedAt),
        detail: error instanceof Error ? error.message : "NETWORK_ERROR",
      };
    }
  }
}
