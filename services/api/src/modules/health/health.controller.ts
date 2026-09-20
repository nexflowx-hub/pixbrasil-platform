import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { APP_VERSION } from "../../config/build-info";
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
      version: APP_VERSION,
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
