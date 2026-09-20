import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialCoreModule } from "../financial-core/financial-core.module";
import { MerchantWebhooksModule } from "../merchant-webhooks/merchant-webhooks.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [ProvidersModule, MerchantWebhooksModule, FinancialCoreModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
