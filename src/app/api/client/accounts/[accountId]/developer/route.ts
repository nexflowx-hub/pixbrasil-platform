import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  return pipeCoreResponse(
    await clientCoreFetch(
      "/api/v1/me/accounts/" + encodeURIComponent(accountId) + "/developer",
    ),
  );
}
