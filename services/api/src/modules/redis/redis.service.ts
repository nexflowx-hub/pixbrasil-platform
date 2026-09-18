import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createClient } from "redis";
import type { RuntimeDependencyHealth } from "../database/database.service";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisUrl = process.env.REDIS_URL?.trim();
  private readonly client = this.redisUrl
    ? createClient({
        url: this.redisUrl,
        socket: { connectTimeout: 5_000, reconnectStrategy: false },
      })
    : undefined;

  constructor() {
    this.client?.on("error", () => undefined);
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async health(): Promise<RuntimeDependencyHealth> {
    if (!this.client) {
      return { status: "NOT_CONFIGURED", latencyMs: 0, detail: "REDIS_URL_MISSING" };
    }

    const startedAt = performance.now();
    try {
      if (!this.client.isOpen) await this.client.connect();
      const pong = await this.client.ping();
      return {
        status: pong === "PONG" ? "ONLINE" : "OFFLINE",
        latencyMs: Math.round(performance.now() - startedAt),
        detail: pong === "PONG" ? undefined : "UNEXPECTED_REDIS_PING",
      };
    } catch (error) {
      return {
        status: "OFFLINE",
        latencyMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.name : "REDIS_ERROR",
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }
}
