import { Module } from "@nestjs/common";
import { MerchantAuthModule } from "../merchant-auth/merchant-auth.module";
import { RoutingModule } from "../routing/routing.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [MerchantAuthModule, RoutingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
