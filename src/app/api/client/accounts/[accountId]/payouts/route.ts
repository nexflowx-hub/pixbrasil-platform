import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" + encodeURIComponent(accountId) + "/payouts",
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  const body = await request.text();

  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" + encodeURIComponent(accountId) + "/payouts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      },
    ),
  );
}
