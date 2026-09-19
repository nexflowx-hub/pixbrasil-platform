import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

type RawWebhookRequest = {
  rawBody?: Buffer;
};

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

  @Post("pixgo")
  @HttpCode(200)
  pixGo(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RawWebhookRequest,
  ) {
    return this.webhooks.handlePixGo(body, headers, request.rawBody);
  }
}
