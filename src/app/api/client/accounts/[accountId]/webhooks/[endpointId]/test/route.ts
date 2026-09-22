import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ accountId: string; endpointId: string }> },
) {
  const { accountId, endpointId } = await context.params;
  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" +
        encodeURIComponent(accountId) +
        "/webhooks/" +
        encodeURIComponent(endpointId) +
        "/test",
      { method: "POST" },
    ),
  );
}
