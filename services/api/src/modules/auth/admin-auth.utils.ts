import { UnauthorizedException } from "@nestjs/common";
import type { AuthenticatorAssuranceLevel } from "./admin-auth.types";

interface ValidatedJwtClaims {
  sub: string;
  aal: AuthenticatorAssuranceLevel;
}

export function extractBearerToken(authorization?: string): string {
  if (!authorization) {
    throw new UnauthorizedException("Missing Authorization bearer token.");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new UnauthorizedException("Invalid Authorization bearer token.");
  }

  return token;
}

export function decodeValidatedJwtClaims(token: string): ValidatedJwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new UnauthorizedException("Malformed Supabase access token.");
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    if (typeof parsed.sub !== "string" || !parsed.sub) {
      throw new Error("missing subject");
    }

    return {
      sub: parsed.sub,
      aal: parsed.aal === "aal2" ? "aal2" : "aal1",
    };
  } catch {
    throw new UnauthorizedException("Malformed Supabase access token.");
  }
}
