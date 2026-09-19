import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { MerchantWebhookGuard } from "./merchant-webhook.guard";
import type { MerchantApiRequest } from "../merchant-auth/merchant-auth.types";
import { MerchantWebhooksService } from "./merchant-webhooks.service";

@Controller("v1/webhook-endpoints")
@UseGuards(MerchantWebhookGuard)
export class MerchantWebhooksController {
  constructor(private readonly webhooks: MerchantWebhooksService) {}

  @Get()
  list(@Req() request: MerchantApiRequest) {
    return this.webhooks.listEndpoints(request.merchantContext!);
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() request: MerchantApiRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooks.createEndpoint(request.merchantContext!, body);
  }

  @Post(":endpointId/test")
  test(
    @Req() request: MerchantApiRequest,
    @Param("endpointId") endpointId: string,
  ) {
    return this.webhooks.testEndpoint(request.merchantContext!, endpointId);
  }

  @Post(":endpointId/revoke")
  revoke(
    @Req() request: MerchantApiRequest,
    @Param("endpointId") endpointId: string,
  ) {
    return this.webhooks.revokeEndpoint(request.merchantContext!, endpointId);
  }
}
