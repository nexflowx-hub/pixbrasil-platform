import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { ClientAccountAccess, ClientContext } from "./client-auth.types";
import {
  decodeValidatedJwtClaims,
  extractBearerToken,
} from "../auth/admin-auth.utils";

interface SupabaseAuthUser {
  id?: string;
  email?: string;
}

interface ClientUserRow {
  user_id: string;
  auth_user_id: string;
  user_status: string;
}

interface ClientAccountRow {
  account_id: string;
  account_type: ClientAccountAccess["accountType"];
  account_status: string;
  kyc_status: string;
  role: ClientAccountAccess["role"];
  base_currency: string;
}

@Injectable()
export class ClientAuthService {
  private readonly supabaseUrl = process.env.SUPABASE_URL
    ?.trim()
    .replace(/\/+$/, "");
  private readonly publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  constructor(private readonly database: DatabaseService) {}

  async authenticate(authorization?: string): Promise<ClientContext> {
    if (!this.supabaseUrl || !this.publishableKey) {
      throw new ServiceUnavailableException(
        "Supabase Auth runtime configuration is incomplete.",
      );
    }

    const token = extractBearerToken(authorization);
    const authUser = await this.validateWithSupabaseAuth(token);
    const claims = decodeValidatedJwtClaims(token);

    if (!authUser.id || claims.sub !== authUser.id) {
      throw new UnauthorizedException("Supabase token subject mismatch.");
    }

    const userResult = await this.database.query<ClientUserRow>(
      `
      select
        u.id as user_id,
        u.auth_user_id,
        u.status::text as user_status
      from public.users u
      where u.auth_user_id=$1::uuid
        and u.status in ('ACTIVE','PENDING')
      limit 1
      `,
      [authUser.id],
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new ForbiddenException(
        "No active PiXBrasil client profile is linked to this identity.",
      );
    }

    const accountResult = await this.database.query<ClientAccountRow>(
      `
      select
        a.id as account_id,
        a.type::text as account_type,
        a.status::text as account_status,
        a.kyc_status::text as kyc_status,
        am.role,
        a.base_currency
      from public.account_memberships am
      join public.accounts a on a.id=am.account_id
      where am.user_id=$1::uuid
        and am.status='ACTIVE'
        and a.status <> 'CLOSED'
      order by
        case a.type::text
          when 'BUSINESS' then 0
          when 'INDIVIDUAL' then 1
          else 2
        end,
        a.created_at asc
      `,
      [user.user_id],
    );

    return {
      authUserId: user.auth_user_id,
      userId: user.user_id,
      email: authUser.email,
      userStatus: user.user_status,
      aal: claims.aal,
      accounts: accountResult.rows.map((row) => ({
        accountId: row.account_id,
        accountType: row.account_type,
        accountStatus: row.account_status,
        kycStatus: row.kyc_status,
        role: row.role,
        baseCurrency: row.base_currency,
      })),
    };
  }

  private async validateWithSupabaseAuth(
    token: string,
  ): Promise<SupabaseAuthUser> {
    let response: Response;
    try {
      response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: this.publishableKey!,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Supabase Auth is temporarily unavailable.",
      );
    }

    if (!response.ok) {
      throw new UnauthorizedException("Invalid or expired Supabase session.");
    }

    return (await response.json()) as SupabaseAuthUser;
  }
}
