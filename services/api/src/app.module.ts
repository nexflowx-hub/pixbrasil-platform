import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { RoutingModule } from "./modules/routing/routing.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";

@Module({
  imports: [
    HealthModule,
    AuthModule,
    AdminModule,
    ProvidersModule,
    RoutingModule,
    WebhooksModule,
  ],
})
export class AppModule {}
