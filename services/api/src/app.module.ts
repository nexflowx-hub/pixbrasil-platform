import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { RoutingModule } from "./modules/routing/routing.module";

@Module({
  imports: [HealthModule, ProvidersModule, RoutingModule],
})
export class AppModule {}
