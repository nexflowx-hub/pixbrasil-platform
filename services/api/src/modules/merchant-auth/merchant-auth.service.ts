import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import type { MerchantApiContext } from "./merchant-auth.types";

interface MerchantKeyRow {
  api_key_id: string;
  merchant_id: string;
  account_id: string;
  merchant_code: string | null;
  scopes: string[];
  allowed_store_ids: string[];
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

@Injectable()
export class MerchantAuthService {
  constructor(private readonly database: DatabaseService) {}

  async authenticate(
    headers: Record<string, string | string[] | undefined>,
    requiredScope = "payments:create",
  ): Promise<MerchantApiContext> {
    const authorization = headerValue(headers, "authorization").trim();
    const xApiKey = headerValue(headers, "x-api-key").trim();
    const token = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : xApiKey;

    if (!token || !token.startsWith("pix_")) {
      throw new UnauthorizedException("Valid PiXBrasil API key required.");
    }

    const keyHash = createHash("sha256").update(token).digest("hex");
    const result = await this.database.query<MerchantKeyRow>(
      `
      select
        k.id as api_key_id,
        k.merchant_id,
        m.account_id,
        m.metadata->>'merchantCode' as merchant_code,
        k.scopes::text[] as scopes,
        coalesce(
          array_agg(g.store_id::text order by g.store_id)
            filter (where g.store_id is not null),
          '{}'::text[]
        ) as allowed_store_ids
      from pixbrasil.merchant_api_keys k
      join pixbrasil.merchants m on m.id=k.merchant_id
      left join pixbrasil.merchant_api_key_store_grants g on g.api_key_id=k.id
      join public.accounts a on a.id=m.account_id
      where k.key_hash=$1::char(64)
        and k.status='ACTIVE'
        and (k.expires_at is null or k.expires_at > now())
        and m.status='ACTIVE'
        and a.status='ACTIVE'
      group by k.id,m.id,a.id
      `,
      [keyHash],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException("Invalid or inactive PiXBrasil API key.");
    }

    if (!row.scopes?.includes(requiredScope)) {
      throw new ForbiddenException(
        `API key does not have required scope: ${requiredScope}`,
      );
    }

    await this.database.query(
      `
      update pixbrasil.merchant_api_keys
      set last_used_at=now()
      where id=$1::uuid
      `,
      [row.api_key_id],
    );

    return {
      apiKeyId: row.api_key_id,
      merchantId: row.merchant_id,
      accountId: row.account_id,
      merchantCode: row.merchant_code ?? undefined,
      scopes: row.scopes ?? [],
      allowedStoreIds: row.allowed_store_ids ?? [],
    };
  }
}
