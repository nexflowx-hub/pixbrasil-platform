import { Module } from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { MerchantWebhooksController } from "./merchant-webhooks.controller";
import { MerchantWebhooksService } from "./merchant-webhooks.service";

@Module({
  imports: [MerchantAuthModule],
  controllers: [MerchantWebhooksController],
  providers: [MerchantWebhooksService],
  exports: [MerchantWebhooksService],
})
export class MerchantWebhooksModule {}
