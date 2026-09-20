import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { MerchantWebhooksModule } from "../merchant-webhooks/merchant-webhooks.module";
import { SettlementsModule } from "../settlements/settlements.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [ProvidersModule, MerchantWebhooksModule, SettlementsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
