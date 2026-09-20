import { cookies } from "next/headers";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://aakdyumavlzgyklbrsrw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_lyIwbPhKld_yf0gZQb-Ecg_sY1UyQ5T";

const CORE_API_URL = (
  process.env.PIXBRASIL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.pixbrasil.org"
).replace(/\/+$/, "");

const COOKIE_PREFIX = process.env.NODE_ENV === "production" ? "__Host-" : "";
const ACCESS_COOKIE = COOKIE_PREFIX + "pixbrasil_access";
const REFRESH_COOKIE = COOKIE_PREFIX + "pixbrasil_refresh";

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createClientSession(email: string, password: string) {
  const response = await fetch(
    SUPABASE_URL + "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as TokenPayload &
    Record<string, unknown>;

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    return {
      ok: false as const,
      status: response.status || 401,
      message:
        typeof payload.msg === "string"
          ? payload.msg
          : typeof payload.message === "string"
            ? payload.message
            : "Email ou senha inválidos.",
    };
  }

  const store = await cookies();
  store.set(
    ACCESS_COOKIE,
    payload.access_token,
    cookieOptions(Math.max(60, Number(payload.expires_in ?? 3600))),
  );
  store.set(
    REFRESH_COOKIE,
    payload.refresh_token,
    cookieOptions(60 * 60 * 24 * 30),
  );

  return { ok: true as const };
}

export async function clearClientSession() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;

  if (access) {
    await fetch(SUPABASE_URL + "/auth/v1/logout", {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + access,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  store.set(ACCESS_COOKIE, "", cookieOptions(0));
  store.set(REFRESH_COOKIE, "", cookieOptions(0));
}

async function refreshClientSession() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const response = await fetch(
    SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as TokenPayload;
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    store.set(ACCESS_COOKIE, "", cookieOptions(0));
    store.set(REFRESH_COOKIE, "", cookieOptions(0));
    return null;
  }

  store.set(
    ACCESS_COOKIE,
    payload.access_token,
    cookieOptions(Math.max(60, Number(payload.expires_in ?? 3600))),
  );
  store.set(
    REFRESH_COOKIE,
    payload.refresh_token,
    cookieOptions(60 * 60 * 24 * 30),
  );

  return payload.access_token;
}

async function accessToken() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function clientCoreFetch(
  path: string,
  init: RequestInit = {},
) {
  let token = await accessToken();
  if (!token) return new Response(null, { status: 401 });

  const request = (value: string) => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", "Bearer " + value);

    return fetch(CORE_API_URL + path, {
      ...init,
      headers,
      cache: "no-store",
    });
  };

  let response = await request(token);
  if (response.status === 401) {
    token = await refreshClientSession();
    if (!token) return response;
    response = await request(token);
  }

  return response;
}

export async function pipeCoreResponse(response: Response) {
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
