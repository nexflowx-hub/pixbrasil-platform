export type FetchLike = typeof fetch;

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  return asRecord(body);
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}
