import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { MerchantWebhooksModule } from "../merchant-webhooks/merchant-webhooks.module";
import { FinanceModule } from "../finance/finance.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [ProvidersModule, MerchantWebhooksModule, FinanceModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
