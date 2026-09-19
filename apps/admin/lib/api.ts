import { supabase } from "./supabase";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "https://api.pixbrasil.org";

export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : `API request failed (${response.status})`;
    const error = new Error(message);
    Object.assign(error, { status: response.status });
    throw error;
  }

  return (await response.json()) as T;
}
