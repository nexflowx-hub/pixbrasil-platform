import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { RoutingModule } from "./modules/routing/routing.module";

@Module({
  imports: [HealthModule, RoutingModule],
})
export class AppModule {}
