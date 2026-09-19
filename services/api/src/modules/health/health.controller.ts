import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { RuntimeHealthService } from "./runtime-health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly runtimeHealth: RuntimeHealthService) {}

  @Get()
  health() {
    return {
      success: true,
      service: "PiXBrasil",
      component: "api",
      version: process.env.APP_VERSION ?? "0.3.0",
      status: "ONLINE",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready() {
    const snapshot = await this.runtimeHealth.snapshot();
    if (!snapshot.success) throw new ServiceUnavailableException(snapshot);
    return snapshot;
  }
}
