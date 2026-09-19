import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { ProviderAdapterRegistry } from "../providers/provider-adapter.registry";
import type { NormalizedProviderStatus } from "../providers/provider-adapter";
import { MerchantWebhooksService } from "../merchant-webhooks/merchant-webhooks.service";

interface MisticWebhookPayload {
  transactionId?: string | number;
  transactionType?: string;
  transactionMethod?: string;
  status?: string;
  value?: number;
  fee?: number;
  e2e?: string;
  ispb?: string;
  bankName?: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly providers: ProviderAdapterRegistry,
    private readonly merchantWebhooks: MerchantWebhooksService,
  ) {}

  async handleMisticPay(
    payload: MisticWebhookPayload,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const transactionId = String(payload.transactionId ?? "").trim();
    if (!transactionId) {
      throw new BadRequestException(
        "MisticPay webhook is missing transactionId.",
      );
    }

    const connection = await this.loadConnection("misticpay-primary");
    const credentials = this.parseCredentials(
      connection.decrypted_secret!,
      "MisticPay",
    );
    const adapter = this.providers.get("MISTICPAY");

    let verifiedPayload: unknown;
    let verifiedStatus: NormalizedProviderStatus;
    try {
      verifiedPayload = await adapter.verifyWebhook(
        payload,
        headers,
        credentials,
      );
      verifiedStatus = adapter.mapProviderStatus(verifiedPayload);
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? "MisticPay webhook could not be verified S2S."
          : "MisticPay webhook verification failed.",
      );
    }

    const eventType =
      String(payload.transactionType ?? "UNKNOWN").toUpperCase() +
      ":" +
      String(payload.status ?? verifiedStatus ?? "UNKNOWN").toUpperCase();
    const eventKey = transactionId + ":" + eventType;

    const redactedPayload = {
      transactionId,
      transactionType: payload.transactionType ?? null,
      transactionMethod: payload.transactionMethod ?? null,
      status: payload.status ?? null,
      verifiedStatus,
      value: payload.value ?? null,
      fee: payload.fee ?? null,
      e2e: payload.e2e ?? null,
      ispb: payload.ispb ?? null,
      bankName: payload.bankName ?? null,
    };

    const persisted = await this.persistVerifiedEvent({
      connectionId: connection.connection_id,
      eventKey,
      eventType,
      payload: redactedPayload,
    });

    const payment = await this.applyVerifiedPaymentStatus(
      connection.connection_id,
      transactionId,
      verifiedStatus,
      "MISTICPAY",
    );

    if (payment && !persisted.replay) {
      await this.merchantWebhooks.deliverPaymentEvent(
        this.toMerchantEventType(payment.status),
        payment,
      );
    }

    return {
      success: true,
      accepted: true,
      replay: persisted.replay,
      provider: "MISTICPAY",
      transactionId,
      verifiedStatus,
    };
  }

  async handlePixGo(
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ) {
    const root = payload;
    const nested =
      root.data && typeof root.data === "object" && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : {};

    const paymentId = String(
      nested.payment_id ?? root.payment_id ?? root.paymentId ?? "",
    ).trim();
    const eventName = String(
      root.event ??
        this.headerValue(headers, "x-webhook-event") ??
        "UNKNOWN",
    )
      .trim()
      .toLowerCase();

    if (!paymentId) {
      throw new BadRequestException("PixGo webhook is missing payment_id.");
    }

    const connection = await this.loadConnection("pixgo-primary");
    const credentials = this.parseCredentials(
      connection.decrypted_secret!,
      "PixGo",
    );
    const adapter = this.providers.get("PIXGO");

    let verifiedPayload: unknown;
    let verifiedStatus: NormalizedProviderStatus;
    try {
      verifiedPayload = await adapter.verifyWebhook(
        payload,
        headers,
        credentials,
        rawBody,
      );
      verifiedStatus = adapter.mapProviderStatus(verifiedPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.startsWith("PIXGO_WEBHOOK_") ||
        message.includes("payment_id")
      ) {
        throw new BadRequestException("PixGo webhook signature is invalid.");
      }
      throw new BadGatewayException(
        "PixGo webhook could not be confirmed S2S.",
      );
    }

    const eventType = eventName || "unknown";
    const eventKey = paymentId + ":" + eventType;

    const amounts =
      nested.amounts &&
      typeof nested.amounts === "object" &&
      !Array.isArray(nested.amounts)
        ? (nested.amounts as Record<string, unknown>)
        : {};

    const redactedPayload = {
      paymentId,
      externalId: String(
        nested.external_id ?? root.external_id ?? "",
      ).slice(0, 200) || null,
      event: eventType,
      verifiedStatus,
      gross: amounts.gross ?? nested.amount ?? root.amount ?? null,
      net: amounts.net ?? null,
      completedAt: nested.completed_at ?? root.completed_at ?? null,
      expiredAt: nested.expired_at ?? root.expired_at ?? null,
      refundedAt: nested.refunded_at ?? root.refunded_at ?? null,
    };

    const persisted = await this.persistVerifiedEvent({
      connectionId: connection.connection_id,
      eventKey,
      eventType,
      payload: redactedPayload,
    });

    const payment = await this.applyVerifiedPaymentStatus(
      connection.connection_id,
      paymentId,
      verifiedStatus,
      "PIXGO",
    );

    if (payment && !persisted.replay) {
      await this.merchantWebhooks.deliverPaymentEvent(
        this.toMerchantEventType(payment.status),
        payment,
      );
    }

    return {
      success: true,
      accepted: true,
      replay: persisted.replay,
      provider: "PIXGO",
      paymentId,
      event: eventType,
      verifiedStatus,
    };
  }

  private async loadConnection(alias: string) {
    const connection = await this.database.query<{
      connection_id: string;
      decrypted_secret: string | null;
    }>(
      `
      select
        gc.id as connection_id,
        v.decrypted_secret
      from pixbrasil.gateway_connections gc
      left join vault.decrypted_secrets v on v.id=gc.vault_secret_id
      where gc.alias=$1::varchar
      limit 1
      `,
      [alias],
    );

    const row = connection.rows[0];
    if (!row?.decrypted_secret) {
      throw new ServiceUnavailableException(
        "Provider credentials are not available for webhook verification.",
      );
    }

    return row;
  }

  private parseCredentials(value: string, provider: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      throw new ServiceUnavailableException(
        provider + " Vault credential is malformed.",
      );
    }
  }

  private async persistVerifiedEvent(input: {
    connectionId: string;
    eventKey: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) {
    const serialized = JSON.stringify(input.payload);
    const payloadHash = createHash("sha256")
      .update(serialized)
      .digest("hex");

    const inserted = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.provider_webhook_events(
        gateway_connection_id,
        provider_event_key,
        event_type,
        status,
        payload_hash,
        payload,
        received_at,
        processed_at
      )
      values(
        $1::uuid,$2::text,$3::text,'PROCESSED',
        $4::text,$5::jsonb,now(),now()
      )
      on conflict (gateway_connection_id,provider_event_key)
      do nothing
      returning id
      `,
      [
        input.connectionId,
        input.eventKey,
        input.eventType,
        payloadHash,
        serialized,
      ],
    );

    return { replay: !inserted.rows[0] };
  }

  private async applyVerifiedPaymentStatus(
    connectionId: string,
    providerPaymentId: string,
    status: NormalizedProviderStatus,
    providerCode: string,
  ) {
    const paymentStatus =
      status === "SUCCEEDED"
        ? "SUCCEEDED"
        : status === "FAILED"
          ? "FAILED"
          : status === "CANCELED" || status === "REFUNDED"
            ? "CANCELED"
            : status === "PENDING"
              ? "PENDING_PAYMENT"
              : null;

    if (!paymentStatus) return;

    const result = await this.database.query<{
      payment_intent_id: string;
      merchant_id: string;
      reference: string | null;
      amount: string;
      currency: string;
      status: string;
      store_code: string | null;
      completed_at: string | null;
    }>(
      `
      with matched_attempt as (
        select pa.id,pa.payment_intent_id
        from pixbrasil.provider_attempts pa
        where pa.gateway_connection_id=$1::uuid
          and pa.provider_payment_id=$2::text
        order by pa.attempt_no desc
        limit 1
      ),
      updated_attempt as (
        update pixbrasil.provider_attempts pa
        set response_metadata=coalesce(pa.response_metadata,'{}'::jsonb) ||
              jsonb_build_object(
                'lastWebhookStatus',$3::text,
                'lastWebhookProvider',$4::text,
                'lastWebhookAt',now()
              )
        where pa.id=(select id from matched_attempt)
        returning pa.id
      ),
      updated_intent as (
        update pixbrasil.payment_intents pi
        set status=$5::text,
            completed_at=case
              when $5::text='SUCCEEDED' then coalesce(pi.completed_at,now())
              else pi.completed_at
            end,
            metadata=coalesce(pi.metadata,'{}'::jsonb) ||
              jsonb_build_object(
                'lastVerifiedProviderStatus',$3::text,
                'lastVerifiedProvider',$4::text,
                'lastWebhookAt',now()
              ),
            updated_at=now()
        where pi.id=(select payment_intent_id from matched_attempt)
        returning
          pi.id,
          pi.merchant_id,
          pi.store_id,
          pi.external_reference,
          pi.amount,
          pi.currency,
          pi.status,
          pi.completed_at
      )
      select
        ui.id as payment_intent_id,
        ui.merchant_id,
        ui.external_reference as reference,
        ui.amount::text,
        ui.currency,
        ui.status,
        s.code as store_code,
        ui.completed_at::text
      from updated_intent ui
      left join pixbrasil.stores s on s.id=ui.store_id
      `,
      [connectionId, providerPaymentId, status, providerCode, paymentStatus],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      paymentIntentId: row.payment_intent_id,
      merchantId: row.merchant_id,
      reference: row.reference,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      storeCode: row.store_code,
      providerCode,
      providerPaymentId,
      completedAt: row.completed_at,
    };
  }

  private toMerchantEventType(status: string) {
    if (status === "SUCCEEDED") return "payment.succeeded" as const;
    if (status === "FAILED") return "payment.failed" as const;
    if (status === "CANCELED") return "payment.canceled" as const;
    return "payment.pending" as const;
  }

  private headerValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }
}
