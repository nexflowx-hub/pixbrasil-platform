import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ accountId: string; apiKeyId: string }> },
) {
  const { accountId, apiKeyId } = await context.params;
  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" +
        encodeURIComponent(accountId) +
        "/api-keys/" +
        encodeURIComponent(apiKeyId) +
        "/revoke",
      { method: "POST" },
    ),
  );
}
