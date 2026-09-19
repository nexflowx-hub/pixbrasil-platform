import {
  Body,
  Controller,
  Headers,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { MerchantApiKeyGuard } from "../merchant-auth/merchant-api-key.guard";
import type { MerchantApiRequest } from "../merchant-auth/merchant-auth.types";
import { PaymentsService } from "./payments.service";

@Controller("v1/payments")
@UseGuards(MerchantApiKeyGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(":paymentIntentId")
  getPayment(
    @Req() request: MerchantApiRequest,
    @Param("paymentIntentId") paymentIntentId: string,
  ) {
    return this.payments.getPayment(
      request.merchantContext!,
      paymentIntentId,
    );
  }

  @Post("charge")
  @HttpCode(200)
  charge(
    @Req() request: MerchantApiRequest,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.payments.createShadowCharge(
      request.merchantContext!,
      idempotencyKey,
      body,
    );
  }
}
