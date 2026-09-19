import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

@Controller("v1/webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post("misticpay")
  @HttpCode(200)
  misticPay(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.webhooks.handleMisticPay(body, headers);
  }
}
