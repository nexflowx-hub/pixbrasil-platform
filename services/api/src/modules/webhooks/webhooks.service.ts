import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { ProviderAdapterRegistry } from "../providers/provider-adapter.registry";

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
  ) {}

  async handleMisticPay(
    payload: MisticWebhookPayload,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const transactionId = String(payload.transactionId ?? "").trim();
    if (!transactionId) {
      throw new BadGatewayException("MisticPay webhook is missing transactionId.");
    }

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
      where gc.alias='misticpay-primary'
      limit 1
      `,
    );

    const row = connection.rows[0];
    if (!row?.decrypted_secret) {
      throw new ServiceUnavailableException(
        "MisticPay credentials are not available for S2S verification.",
      );
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    const eventId = randomUUID();
    const eventType =
      String(payload.transactionType ?? "UNKNOWN").toUpperCase() +
      ":" +
      String(payload.status ?? "UNKNOWN").toUpperCase();

    const redactedPayload = {
      transactionId,
      transactionType: payload.transactionType ?? null,
      transactionMethod: payload.transactionMethod ?? null,
      status: payload.status ?? null,
      value: payload.value ?? null,
      fee: payload.fee ?? null,
      e2e: payload.e2e ?? null,
      ispb: payload.ispb ?? null,
      bankName: payload.bankName ?? null,
    };

    await this.database.query(
      `
      insert into public.webhook_events(
        id,
        provider_code,
        external_event_id,
        event_type,
        status,
        payload_hash,
        payload,
        attempt_count,
        received_at,
        updated_at
      )
      values(
        $1::uuid,
        'MISTICPAY',
        $2::varchar,
        $3::varchar,
        'RECEIVED',
        $4::varchar,
        $5::jsonb,
        1,
        now(),
        now()
      )
      `,
      [
        eventId,
        transactionId,
        eventType,
        payloadHash,
        JSON.stringify(redactedPayload),
      ],
    );

    let credentials: unknown;
    try {
      credentials = JSON.parse(row.decrypted_secret);
    } catch {
      await this.markFailed(eventId, "INVALID_VAULT_CREDENTIAL_JSON");
      throw new ServiceUnavailableException(
        "MisticPay Vault credential is malformed.",
      );
    }

    try {
      const adapter = this.providers.get("MISTICPAY");
      const verifiedPayload = await adapter.verifyWebhook(
        payload,
        headers,
        credentials,
      );
      const verifiedStatus = adapter.mapProviderStatus(verifiedPayload);

      await this.database.query(
        `
        update public.webhook_events
        set status='PROCESSED',
            payload=payload || jsonb_build_object(
              'verifiedS2S', true,
              'verifiedStatus', $2::text,
              'connectionId', $3::text
            ),
            processed_at=now(),
            updated_at=now()
        where id=$1::uuid
        `,
        [eventId, verifiedStatus, row.connection_id],
      );

      return {
        success: true,
        accepted: true,
        provider: "MISTICPAY",
        transactionId,
        verifiedStatus,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "MISTICPAY_S2S_VERIFY_FAILED";
      await this.markFailed(eventId, message);
      throw new BadGatewayException(
        "MisticPay webhook could not be verified S2S.",
      );
    }
  }

  private async markFailed(eventId: string, message: string) {
    await this.database.query(
      `
      update public.webhook_events
      set status='FAILED',
          error=$2::text,
          updated_at=now()
      where id=$1::uuid
      `,
      [eventId, message.slice(0, 2000)],
    );
  }
}
