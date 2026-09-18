import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AdminContext } from "./admin-auth.types";
import {
  decodeValidatedJwtClaims,
  extractBearerToken,
} from "./admin-auth.utils";

interface SupabaseAuthUser {
  id?: string;
  email?: string;
}

interface AdminAuthorizationRow {
  admin_user_id: string;
  auth_user_id: string;
  display_name: string | null;
  require_mfa: boolean;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AdminAuthService {
  private readonly supabaseUrl = process.env.SUPABASE_URL
    ?.trim()
    .replace(/\/+$/, "");
  private readonly publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  constructor(private readonly database: DatabaseService) {}

  async authenticate(authorization?: string): Promise<AdminContext> {
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

    const authorizationResult =
      await this.database.query<AdminAuthorizationRow>(
        `
        select
          au.id as admin_user_id,
          au.auth_user_id,
          au.display_name,
          au.require_mfa,
          coalesce(
            array_agg(distinct r.code order by r.code)
              filter (where r.code is not null),
            '{}'::varchar[]
          )::text[] as roles,
          coalesce(
            array_agg(distinct p.code order by p.code)
              filter (where p.code is not null),
            '{}'::varchar[]
          )::text[] as permissions
        from controlplane.admin_users au
        left join controlplane.admin_user_roles aur
          on aur.admin_user_id = au.id
         and (aur.expires_at is null or aur.expires_at > now())
        left join controlplane.roles r
          on r.id = aur.role_id
         and r.active = true
        left join controlplane.role_permissions rp
          on rp.role_id = r.id
        left join controlplane.permissions p
          on p.id = rp.permission_id
        where au.auth_user_id = $1::uuid
          and au.status = 'ACTIVE'
        group by
          au.id,
          au.auth_user_id,
          au.display_name,
          au.require_mfa
        `,
        [authUser.id],
      );

    const admin = authorizationResult.rows[0];
    if (!admin) {
      throw new ForbiddenException("User is not an active PiXBrasil admin.");
    }

    if (admin.require_mfa && claims.aal !== "aal2") {
      throw new ForbiddenException(
        "PiXBrasil Admin requires an AAL2 session.",
      );
    }

    return {
      authUserId: admin.auth_user_id,
      adminUserId: admin.admin_user_id,
      email: authUser.email,
      displayName: admin.display_name ?? undefined,
      aal: claims.aal,
      roles: admin.roles ?? [],
      permissions: admin.permissions ?? [],
    };
  }

  private async validateWithSupabaseAuth(
    token: string,
  ): Promise<SupabaseAuthUser> {
    let response: Response;

    try {
      response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        method: "GET",
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
