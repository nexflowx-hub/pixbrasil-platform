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

  @Get("accounts/:accountId/overview")
  overview(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.accountOverview(request.clientContext!, accountId);
  }
}
