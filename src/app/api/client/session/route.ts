import { clientCoreFetch, pipeCoreResponse } from "@/lib/client-session";

export async function GET() {
  return pipeCoreResponse(await clientCoreFetch("/api/v1/me/session"));
}
