import {
  Body,
  Controller,
  Get,
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

  @Get("accounts/:accountId/payouts")
  payouts(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
  ) {
    return this.client.listPayouts(request.clientContext!, accountId);
  }

  @Post("accounts/:accountId/payouts")
  requestPayout(
    @Param("accountId") accountId: string,
    @Req() request: ClientRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.client.requestPayout(
      request.clientContext!,
      accountId,
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
