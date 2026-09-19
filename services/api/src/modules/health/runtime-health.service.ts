import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class RuntimeHealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async snapshot() {
    const [database, redis] = await Promise.all([
      this.database.health(),
      this.redis.health(),
    ]);
    const ready = database.status === "ONLINE" && redis.status === "ONLINE";
    return {
      success: ready,
      service: "PiXBrasil",
      component: "api",
      version: process.env.APP_VERSION ?? "0.4.0",
      status: ready ? "READY" : "NOT_READY",
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
