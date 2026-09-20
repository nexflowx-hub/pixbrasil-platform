import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ accountId: string; payoutId: string }>;
  },
) {
  const { accountId, payoutId } = await context.params;

  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" +
        encodeURIComponent(accountId) +
        "/payout-tickets/" +
        encodeURIComponent(payoutId) +
        "/cancel",
      { method: "POST" },
    ),
  );
}
