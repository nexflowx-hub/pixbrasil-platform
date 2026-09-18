import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      success: true,
      service: "PiXBrasil",
      component: "api",
      version: "0.1.0",
      status: "ONLINE",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  ready() {
    return {
      success: true,
      service: "PiXBrasil",
      component: "api",
      status: "STARTING_FOUNDATION",
      database: "NOT_CONNECTED",
      redis: "NOT_CONNECTED",
      timestamp: new Date().toISOString(),
    };
  }
}
