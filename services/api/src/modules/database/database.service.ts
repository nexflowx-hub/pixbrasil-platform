import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

export type RuntimeDependencyStatus = "ONLINE" | "OFFLINE" | "NOT_CONFIGURED";

export interface RuntimeDependencyHealth {
  status: RuntimeDependencyStatus;
  latencyMs: number;
  detail?: string;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly connectionString = process.env.DATABASE_URL?.trim();
  private readonly pool = this.connectionString
    ? new Pool({
        connectionString: this.connectionString,
        max: positiveInteger(process.env.DATABASE_POOL_MAX, 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: "pixbrasil-api",
      })
    : undefined;

  isConfigured(): boolean {
    return Boolean(this.pool);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error("DATABASE_URL is not configured.");
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(
    handler: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw new Error("DATABASE_URL is not configured.");

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await handler(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<RuntimeDependencyHealth> {
    if (!this.pool) {
      return { status: "NOT_CONFIGURED", latencyMs: 0, detail: "DATABASE_URL_MISSING" };
    }

    const startedAt = performance.now();
    try {
      const result = await this.pool.query<{
        pixbrasil_ready: boolean;
        controlplane_ready: boolean;
      }>(`
        select
          to_regnamespace('pixbrasil') is not null as pixbrasil_ready,
          to_regnamespace('controlplane') is not null as controlplane_ready
      `);

      const row = result.rows[0];
      const schemasReady = Boolean(row?.pixbrasil_ready) && Boolean(row?.controlplane_ready);
      return {
        status: schemasReady ? "ONLINE" : "OFFLINE",
        latencyMs: Math.round(performance.now() - startedAt),
        detail: schemasReady ? undefined : "CORE_SCHEMAS_MISSING",
      };
    } catch (error) {
      return {
        status: "OFFLINE",
        latencyMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.name : "DATABASE_ERROR",
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
