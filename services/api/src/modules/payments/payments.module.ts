import { Module } from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { ProvidersModule } from "../providers/providers.module";
import { RoutingModule } from "../routing/routing.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [MerchantAuthModule, ProvidersModule, RoutingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
