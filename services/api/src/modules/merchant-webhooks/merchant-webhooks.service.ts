import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DatabaseService } from "../database/database.service";
import type { MerchantApiContext } from "../merchant-auth/merchant-auth.types";

const PAYMENT_EVENTS = [
  "payment.pending",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
] as const;

type PaymentEventType = (typeof PAYMENT_EVENTS)[number];

interface EndpointRow {
  id: string;
  merchant_id: string;
  name: string;
  endpoint_url: string;
  events: string[];
  status: string;
  failure_count: number;
  last_delivery_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface DeliveryPayment {
  paymentIntentId: string;
  merchantId: string;
  reference: string | null;
  amount: number;
  currency: string;
  status: string;
  storeCode: string | null;
  providerCode: string | null;
  providerPaymentId: string | null;
  completedAt: string | null;
  metadata?: Record<string, unknown> | null;
}

function merchantMetadata(
  value: Record<string, unknown> | null | undefined,
) {
  if (!value) return {};

  const internalKeys = new Set([
    "routingMode",
    "routingDecisionId",
    "productionQuote",
    "shadowQuote",
    "releaseProfile",
    "releaseClass",
    "providerAction",
    "providerPaymentId",
    "providerError",
    "reconciliationReason",
    "lastVerifiedProviderStatus",
    "lastVerifiedProvider",
    "lastWebhookAt",
  ]);

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !internalKeys.has(key)),
  );
}

function readEvents(value: unknown): PaymentEventType[] {
  if (value == null) return [...PAYMENT_EVENTS];
  if (!Array.isArray(value)) {
    throw new BadRequestException("events must be an array.");
  }

  const events = [...new Set(value.map((item) => String(item).trim()))]
    .filter(Boolean);

  if (!events.length) {
    throw new BadRequestException("At least one webhook event is required.");
  }

  for (const event of events) {
    if (!PAYMENT_EVENTS.includes(event as PaymentEventType)) {
      throw new BadRequestException(
        "Unsupported event: " + event,
      );
    }
  }

  return events as PaymentEventType[];
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();

  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb")) {
    return true;
  }

  const ipv4 = normalized.startsWith("::ffff:")
    ? normalized.slice("::ffff:".length)
    : normalized;

  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ipv4)) return false;

  const [a, b] = ipv4.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function validateEndpointUrl(value: unknown): Promise<string> {
  const raw = String(value ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException("endpointUrl must be a valid HTTPS URL.");
  }

  if (url.protocol !== "https:") {
    throw new BadRequestException("Merchant webhooks require HTTPS.");
  }

  if (url.username || url.password) {
    throw new BadRequestException(
      "Webhook URLs must not contain embedded credentials.",
    );
  }

  if (url.hash) {
    throw new BadRequestException("Webhook URLs must not contain fragments.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new BadRequestException(
      "Webhook endpoint must resolve to a public host.",
    );
  }

  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new BadRequestException(
      "Webhook endpoint must not target a private network.",
    );
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestException(
      "Webhook endpoint hostname could not be resolved.",
    );
  }

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new BadRequestException(
      "Webhook endpoint must resolve only to public IP addresses.",
    );
  }

  return url.toString();
}

@Injectable()
export class MerchantWebhooksService implements OnModuleInit, OnModuleDestroy {
  private retryTimer?: NodeJS.Timeout;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit() {
    this.retryTimer = setInterval(() => {
      void this.retryDueDeliveries().catch(() => undefined);
    }, 60_000);
    this.retryTimer.unref();
    void this.retryDueDeliveries().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async listEndpoints(merchant: MerchantApiContext) {
    const result = await this.database.query<EndpointRow>(
      `
      select
        id,
        merchant_id,
        name,
        endpoint_url,
        events::text[],
        status,
        failure_count,
        last_delivery_at::text,
        last_error,
        created_at::text
      from pixbrasil.merchant_webhook_endpoints
      where merchant_id=$1::uuid
      order by created_at desc
      `,
      [merchant.merchantId],
    );

    return {
      success: true,
      data: result.rows.map((row) => ({
        endpointId: row.id,
        name: row.name,
        endpointUrl: row.endpoint_url,
        events: row.events,
        status: row.status,
        failureCount: row.failure_count,
        lastDeliveryAt: row.last_delivery_at,
        lastError: row.last_error,
        createdAt: row.created_at,
      })),
    };
  }

  async createEndpoint(
    merchant: MerchantApiContext,
    body: Record<string, unknown>,
  ) {
    const endpointUrl = await validateEndpointUrl(
      body.endpointUrl ?? body.url,
    );
    const name =
      String(body.name ?? "").trim().slice(0, 120) ||
      "Production webhook";
    const events = readEvents(body.events);

    const existing = await this.database.query<{ id: string }>(
      `
      select id
      from pixbrasil.merchant_webhook_endpoints
      where merchant_id=$1::uuid
        and endpoint_url=$2::text
      limit 1
      `,
      [merchant.merchantId, endpointUrl],
    );

    if (existing.rows[0]) {
      throw new ConflictException(
        "A webhook endpoint with this URL already exists for the merchant.",
      );
    }

    const secret = "whsec_" + randomBytes(32).toString("base64url");
    const fingerprint = createHash("sha256")
      .update(secret)
      .digest("hex");

    const vault = await this.database.query<{ id: string }>(
      `
      select vault.create_secret(
        $1::text,
        $2::text,
        $3::text
      )::text as id
      `,
      [
        secret,
        "pixbrasil-merchant-webhook-" + randomUUID(),
        "PiXBrasil merchant webhook signing secret",
      ],
    );

    const vaultSecretId = vault.rows[0]?.id;
    if (!vaultSecretId) {
      throw new ConflictException(
        "Unable to store webhook signing secret.",
      );
    }

    let inserted: { id: string } | undefined;
    try {
      const result = await this.database.query<{ id: string }>(
        `
        insert into pixbrasil.merchant_webhook_endpoints(
          merchant_id,
          name,
          endpoint_url,
          vault_secret_id,
          secret_fingerprint,
          events,
          status,
          created_by_api_key_id,
          metadata
        )
        values(
          $1::uuid,$2::varchar,$3::text,$4::uuid,$5::char(64),
          $6::text[],'ACTIVE',$7::uuid,
          jsonb_build_object('secretReturnedOnce',true,'version','v1')
        )
        returning id
        `,
        [
          merchant.merchantId,
          name,
          endpointUrl,
          vaultSecretId,
          fingerprint,
          events,
          merchant.apiKeyId,
        ],
      );
      inserted = result.rows[0];
    } catch {
      throw new ConflictException(
        "A webhook endpoint with this URL already exists for the merchant.",
      );
    }

    return {
      success: true,
      data: {
        endpointId: inserted!.id,
        name,
        endpointUrl,
        events,
        status: "ACTIVE",
        signingSecret: secret,
        signingAlgorithm: "HMAC-SHA256",
        signatureHeader: "X-PiXBrasil-Signature",
        timestampHeader: "X-PiXBrasil-Timestamp",
        warning:
          "The signing secret is shown once and cannot be recovered.",
      },
    };
  }

  async revokeEndpoint(
    merchant: MerchantApiContext,
    endpointId: string,
  ) {
    const result = await this.database.query<{ id: string }>(
      `
      update pixbrasil.merchant_webhook_endpoints
      set status='REVOKED',
          revoked_at=coalesce(revoked_at,now()),
          updated_at=now()
      where id=$1::uuid
        and merchant_id=$2::uuid
      returning id
      `,
      [endpointId, merchant.merchantId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException("Webhook endpoint not found.");
    }

    return {
      success: true,
      data: { endpointId, status: "REVOKED" },
    };
  }

  async testEndpoint(
    merchant: MerchantApiContext,
    endpointId: string,
  ) {
    const endpoint = await this.loadEndpointWithSecret(
      merchant.merchantId,
      endpointId,
    );

    const deliveryId = randomUUID();
    const payload = {
      id: deliveryId,
      type: "webhook.test",
      createdAt: new Date().toISOString(),
      data: {
        merchantCode: merchant.merchantCode ?? null,
        message: "PiXBrasil webhook endpoint test.",
      },
    };

    const result = await this.sendDelivery({
      endpoint,
      deliveryId,
      eventType: "webhook.test",
      payload,
      merchantId: merchant.merchantId,
      paymentIntentId: null,
    });

    return {
      success: result.delivered,
      data: {
        endpointId,
        deliveryId,
        status: result.delivered ? "DELIVERED" : "FAILED",
        httpStatus: result.httpStatus,
      },
    };
  }

  async deliverPaymentEvent(
    eventType: PaymentEventType,
    payment: DeliveryPayment,
  ) {
    const endpoints = await this.database.query<
      EndpointRow & { decrypted_secret: string | null }
    >(
      `
      select
        e.id,
        e.merchant_id,
        e.name,
        e.endpoint_url,
        e.events::text[],
        e.status,
        e.failure_count,
        e.last_delivery_at::text,
        e.last_error,
        e.created_at::text,
        v.decrypted_secret
      from pixbrasil.merchant_webhook_endpoints e
      left join vault.decrypted_secrets v on v.id=e.vault_secret_id
      where e.merchant_id=$1::uuid
        and e.status='ACTIVE'
        and $2::text = any(e.events)
      order by e.created_at
      `,
      [payment.merchantId, eventType],
    );

    for (const endpoint of endpoints.rows) {
      if (!endpoint.decrypted_secret) continue;

      const deliveryId = randomUUID();
      const payload = {
        id: deliveryId,
        type: eventType,
        createdAt: new Date().toISOString(),
        data: {
          paymentIntentId: payment.paymentIntentId,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          store: {
            code: payment.storeCode,
          },
          completedAt: payment.completedAt,
          metadata: merchantMetadata(payment.metadata),
        },
      };

      await this.sendDelivery({
        endpoint,
        deliveryId,
        eventType,
        payload,
        merchantId: payment.merchantId,
        paymentIntentId: payment.paymentIntentId,
      });
    }
  }

  private async loadEndpointWithSecret(
    merchantId: string,
    endpointId: string,
  ) {
    const result = await this.database.query<
      EndpointRow & { decrypted_secret: string | null }
    >(
      `
      select
        e.id,
        e.merchant_id,
        e.name,
        e.endpoint_url,
        e.events::text[],
        e.status,
        e.failure_count,
        e.last_delivery_at::text,
        e.last_error,
        e.created_at::text,
        v.decrypted_secret
      from pixbrasil.merchant_webhook_endpoints e
      left join vault.decrypted_secrets v on v.id=e.vault_secret_id
      where e.id=$1::uuid
        and e.merchant_id=$2::uuid
        and e.status='ACTIVE'
      limit 1
      `,
      [endpointId, merchantId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("Active webhook endpoint not found.");
    }
    if (!row.decrypted_secret) {
      throw new ConflictException("Webhook signing secret is unavailable.");
    }
    return row;
  }

  private async sendDelivery(input: {
    endpoint: EndpointRow & { decrypted_secret: string | null };
    deliveryId: string;
    eventType: string;
    payload: Record<string, unknown>;
    merchantId: string;
    paymentIntentId: string | null;
  }) {
    const body = JSON.stringify(input.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac(
      "sha256",
      input.endpoint.decrypted_secret!,
    )
      .update(timestamp + "." + body)
      .digest("hex");

    const inserted = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.merchant_webhook_deliveries(
        id,
        endpoint_id,
        merchant_id,
        payment_intent_id,
        event_type,
        payload,
        status,
        attempt_count
      )
      values(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::varchar,$6::jsonb,
        'PENDING',0
      )
      on conflict do nothing
      returning id
      `,
      [
        input.deliveryId,
        input.endpoint.id,
        input.merchantId,
        input.paymentIntentId,
        input.eventType,
        body,
      ],
    );

    let deliveryId = inserted.rows[0]?.id ?? input.deliveryId;

    if (!inserted.rows[0] && input.paymentIntentId) {
      const existing = await this.database.query<{
        id: string;
        status: string;
      }>(
        `
        select id,status
        from pixbrasil.merchant_webhook_deliveries
        where endpoint_id=$1::uuid
          and payment_intent_id=$2::uuid
          and event_type=$3::varchar
        order by created_at desc
        limit 1
        `,
        [input.endpoint.id, input.paymentIntentId, input.eventType],
      );

      if (existing.rows[0]) {
        deliveryId = existing.rows[0].id;
        if (existing.rows[0].status === "DELIVERED") {
          return {
            delivered: true,
            httpStatus: 200,
            deliveryId,
            deduplicated: true,
          };
        }
      }
    }

    let response: Response | null = null;
    let error = "";
    try {
      await validateEndpointUrl(input.endpoint.endpoint_url);
      response = await fetch(input.endpoint.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PiXBrasil-Webhooks/1.0",
          "X-PiXBrasil-Event": input.eventType,
          "X-PiXBrasil-Delivery": deliveryId,
          "X-PiXBrasil-Timestamp": timestamp,
          "X-PiXBrasil-Signature": "v1=" + signature,
        },
        body,
        signal: AbortSignal.timeout(3_000),
        redirect: "error",
      });
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Webhook delivery failed.";
    }

    const responseExcerpt = response
      ? (await response.text().catch(() => "")).slice(0, 500)
      : "";
    const delivered = Boolean(response?.ok);

    await this.database.query(
      `
      update pixbrasil.merchant_webhook_deliveries
      set status=$2::varchar,
          attempt_count=attempt_count+1,
          http_status=$3::int,
          response_excerpt=$4::text,
          last_attempt_at=now(),
          next_attempt_at=case
            when $2::varchar='FAILED' then now() + interval '5 minutes'
            else null
          end,
          error=$5::text,
          delivered_at=case
            when $2::varchar='DELIVERED' then now()
            else delivered_at
          end
      where id=$1::uuid
      `,
      [
        deliveryId,
        delivered ? "DELIVERED" : "FAILED",
        response?.status ?? null,
        responseExcerpt || null,
        error || null,
      ],
    );

    await this.database.query(
      `
      update pixbrasil.merchant_webhook_endpoints
      set last_delivery_at=now(),
          failure_count=case
            when $2::boolean then 0
            else failure_count+1
          end,
          last_error=case
            when $2::boolean then null
            else $3::text
          end,
          updated_at=now()
      where id=$1::uuid
      `,
      [
        input.endpoint.id,
        delivered,
        error ||
          (response ? "HTTP " + response.status : "Delivery failed"),
      ],
    );

    return {
      delivered,
      httpStatus: response?.status ?? null,
      deliveryId,
      deduplicated: false,
    };
  }

  private async retryDueDeliveries() {
    const due = await this.database.query<
      EndpointRow & {
        delivery_id: string;
        event_type: string;
        payload: Record<string, unknown>;
        payment_intent_id: string | null;
        decrypted_secret: string | null;
        merchant_id: string;
      }
    >(
      `
      select
        d.id as delivery_id,
        d.event_type,
        d.payload,
        d.payment_intent_id,
        d.merchant_id,
        e.id,
        e.name,
        e.endpoint_url,
        e.events::text[],
        e.status,
        e.failure_count,
        e.last_delivery_at::text,
        e.last_error,
        e.created_at::text,
        v.decrypted_secret
      from pixbrasil.merchant_webhook_deliveries d
      join pixbrasil.merchant_webhook_endpoints e on e.id=d.endpoint_id
      left join vault.decrypted_secrets v on v.id=e.vault_secret_id
      where d.status='FAILED'
        and d.next_attempt_at is not null
        and d.next_attempt_at <= now()
        and d.attempt_count < 8
        and e.status='ACTIVE'
      order by d.next_attempt_at asc
      limit 50
      `,
    );

    let retried = 0;
    for (const row of due.rows) {
      if (!row.decrypted_secret) continue;

      await this.sendDelivery({
        endpoint: row,
        deliveryId: row.delivery_id,
        eventType: row.event_type,
        payload: row.payload,
        merchantId: row.merchant_id,
        paymentIntentId: row.payment_intent_id,
      });
      retried += 1;
    }

    return { retried };
  }
}
