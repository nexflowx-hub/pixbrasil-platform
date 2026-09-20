import { cookies } from "next/headers";

const CORE_API_URL = (
  process.env.PIXBRASIL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.pixbrasil.org"
).replace(/\/+$/, "");

const ACCESS_COOKIE = "__Host-pixbrasil_access";

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;

  if (!access) {
    return Response.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  const body = await request.text();
  const response = await fetch(
    CORE_API_URL +
      "/api/v1/me/accounts/" +
      encodeURIComponent(accountId) +
      "/payout-ticket",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  const payload = await response.text();
  return new Response(payload, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
