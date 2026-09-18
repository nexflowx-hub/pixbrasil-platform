const REQUIRED_RUNTIME_VARIABLES = [
  "DATABASE_URL",
  "REDIS_URL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

export function assertRuntimeConfiguration(): void {
  if (process.env.RUNTIME_STRICT !== "true") return;

  const missing = REQUIRED_RUNTIME_VARIABLES.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required PiXBrasil runtime configuration: ${missing.join(", ")}`,
    );
  }
}
