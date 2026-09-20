import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module";
import { ClientModule } from "./modules/client/client.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { FinancialModule } from "./modules/financial/financial.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { MerchantWebhooksModule } from "./modules/merchant-webhooks/merchant-webhooks.module";
import { RoutingModule } from "./modules/routing/routing.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";

@Module({
  imports: [
    HealthModule,
    FinancialModule,
    AuthModule,
    AdminModule,
    ClientModule,
    ProvidersModule,
    PaymentsModule,
    MerchantWebhooksModule,
    RoutingModule,
    WebhooksModule,
  ],
})
export class AppModule {}
