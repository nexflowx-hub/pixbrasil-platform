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

  @Get("accounts/:accountId/overview")
  overview(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.accountOverview(request.clientContext!, accountId);
  }

  @Post("accounts/:accountId/payout-tickets")
  createPayoutTicket(
    @Param("accountId") accountId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() request: ClientRequest,
  ) {
    return this.client.createPayoutTicket(
      request.clientContext!,
      accountId,
      idempotencyKey,
      body,
    );
  }

  @Post("accounts/:accountId/payout-tickets/:payoutId/cancel")
  cancelPayoutTicket(
    @Param("accountId") accountId: string,
    @Param("payoutId") payoutId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.cancelPayoutTicket(
      request.clientContext!,
      accountId,
      payoutId,
    );
  }
}
