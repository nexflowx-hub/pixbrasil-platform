import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClientAuthGuard } from "../client-auth/client-auth.guard";
import type { ClientRequest } from "../client-auth/client-auth.types";
import { ClientService } from "./client.service";

@Controller("v1/me")
@UseGuards(ClientAuthGuard)
export class ClientController {
  constructor(private readonly client: ClientService) {}

  @Get("session")
  session(@Req() request: ClientRequest) {
    return this.client.session(request.clientContext!);
  }

  @Post("accounts/:accountId/payouts")
  payout(
    @Param("accountId") accountId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() request: ClientRequest,
  ) {
    return this.client.requestPayout(
      request.clientContext!,
      accountId,
      idempotencyKey,
      body,
    );
  }


  @Get("accounts/:accountId/developer")
  developer(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.developerOverview(
      request.clientContext!,
      accountId,
    );
  }

  @Post("accounts/:accountId/api-keys")
  createApiKey(
    @Param("accountId") accountId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: ClientRequest,
  ) {
    return this.client.createDeveloperApiKey(
      request.clientContext!,
      accountId,
      body,
    );
  }

  @Post("accounts/:accountId/api-keys/:apiKeyId/revoke")
  revokeApiKey(
    @Param("accountId") accountId: string,
    @Param("apiKeyId") apiKeyId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.revokeDeveloperApiKey(
      request.clientContext!,
      accountId,
      apiKeyId,
    );
  }

  @Post("accounts/:accountId/webhooks")
  createWebhook(
    @Param("accountId") accountId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: ClientRequest,
  ) {
    return this.client.createDeveloperWebhook(
      request.clientContext!,
      accountId,
      body,
    );
  }

  @Post("accounts/:accountId/webhooks/:endpointId/test")
  testWebhook(
    @Param("accountId") accountId: string,
    @Param("endpointId") endpointId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.testDeveloperWebhook(
      request.clientContext!,
      accountId,
      endpointId,
    );
  }

  @Post("accounts/:accountId/webhooks/:endpointId/revoke")
  revokeWebhook(
    @Param("accountId") accountId: string,
    @Param("endpointId") endpointId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.revokeDeveloperWebhook(
      request.clientContext!,
      accountId,
      endpointId,
    );
  }

  @Post("accounts/:accountId/terminal/charge")
  terminalCharge(
    @Param("accountId") accountId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() request: ClientRequest,
  ) {
    return this.client.createTerminalCharge(
      request.clientContext!,
      accountId,
      idempotencyKey,
      body,
    );
  }

  @Get("accounts/:accountId/terminal/payments/:paymentIntentId")
  terminalPayment(
    @Param("accountId") accountId: string,
    @Param("paymentIntentId") paymentIntentId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.terminalPayment(
      request.clientContext!,
      accountId,
      paymentIntentId,
    );
  }

  @Get("accounts/:accountId/overview")
  overview(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.accountOverview(request.clientContext!, accountId);
  }
}
