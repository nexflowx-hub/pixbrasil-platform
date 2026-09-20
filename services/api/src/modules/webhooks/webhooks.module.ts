import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { MerchantWebhooksModule } from "../merchant-webhooks/merchant-webhooks.module";
import { SettlementModule } from "../settlement/settlement.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [ProvidersModule, MerchantWebhooksModule, SettlementModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
