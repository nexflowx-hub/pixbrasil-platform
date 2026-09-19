import { Module } from "@nestjs/common";
import { MerchantApiKeyGuard } from "./merchant-api-key.guard";
import { MerchantAuthService } from "./merchant-auth.service";

@Module({
  providers: [MerchantAuthService, MerchantApiKeyGuard],
  exports: [MerchantAuthService, MerchantApiKeyGuard],
})
export class MerchantAuthModule {}
