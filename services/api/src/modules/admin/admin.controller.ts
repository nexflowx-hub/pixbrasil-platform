import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AdminRequest } from "../auth/admin-auth.types";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AdminService } from "./admin.service";

@Controller("v1/admin")
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("session")
  session(@Req() request: AdminRequest) {
    return {
      success: true,
      data: request.adminContext,
    };
  }

  @Get("providers")
  @RequirePermissions("providers.read")
  providers() {
    return this.admin.listProviders();
  }

  @Get("provider-control-plane")
  @RequirePermissions("providers.read")
  providerControlPlane() {
    return this.admin.providerControlPlane();
  }

  @Put("gateway-connections/:connectionId/credentials")
  @RequirePermissions("providers.credentials.rotate")
  saveProviderCredentials(
    @Param("connectionId") connectionId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AdminRequest,
  ) {
    return this.admin.saveProviderCredentials(
      connectionId,
      body,
      request.adminContext!,
    );
  }

  @Post("gateway-connections/:connectionId/test")
  @RequirePermissions("providers.manage")
  testGatewayConnection(
    @Param("connectionId") connectionId: string,
  ) {
    return this.admin.testGatewayConnection(connectionId);
  }

  @Post("gateway-connections/:connectionId/promote-shadow")
  @RequirePermissions("providers.manage")
  promoteGatewayToShadow(
    @Param("connectionId") connectionId: string,
  ) {
    return this.admin.promoteGatewayToShadow(connectionId);
  }

  @Get("merchants")
  @RequirePermissions("merchants.read")
  merchants() {
    return this.admin.listMerchants();
  }

  @Get("merchants/:merchantId/api-keys")
  @RequirePermissions("merchants.read")
  merchantApiKeys(@Param("merchantId") merchantId: string) {
    return this.admin.listMerchantApiKeys(merchantId);
  }

  @Post("merchants/:merchantId/api-keys")
  @RequirePermissions("merchants.manage")
  createMerchantApiKey(
    @Param("merchantId") merchantId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AdminRequest,
  ) {
    return this.admin.createMerchantApiKey(
      merchantId,
      body,
      request.adminContext!,
    );
  }

  @Post("merchants/:merchantId/api-keys/:apiKeyId/revoke")
  @RequirePermissions("merchants.manage")
  revokeMerchantApiKey(
    @Param("merchantId") merchantId: string,
    @Param("apiKeyId") apiKeyId: string,
    @Req() request: AdminRequest,
  ) {
    return this.admin.revokeMerchantApiKey(
      merchantId,
      apiKeyId,
      request.adminContext!,
    );
  }

  @Get("onboarding")
  @RequirePermissions("onboarding.read")
  onboarding() {
    return this.admin.onboardingOverview();
  }

  @Get("stores")
  @RequirePermissions("merchants.read")
  stores() {
    return this.admin.storesOverview();
  }

  @Get("transactions")
  @RequirePermissions("transactions.read")
  transactions() {
    return this.admin.transactionsOverview();
  }

  @Get("ledger")
  @RequirePermissions("ledger.read")
  ledger() {
    return this.admin.ledgerOverview();
  }

  @Get("settlements")
  @RequirePermissions("settlements.read")
  settlements() {
    return this.admin.settlementsOverview();
  }

  @Get("payouts")
  @RequirePermissions("payouts.read")
  payouts() {
    return this.admin.payoutsOverview();
  }

  @Get("users")
  @RequirePermissions("users.read")
  users() {
    return this.admin.usersOverview();
  }

  @Get("audit")
  @RequirePermissions("audit.read")
  audit() {
    return this.admin.auditOverview();
  }

  @Get("system")
  @RequirePermissions("system.read")
  system() {
    return this.admin.systemOverview();
  }

  @Get("risk")
  @RequirePermissions("risk.read")
  risk() {
    return this.admin.riskOverview();
  }

  @Get("routing/overview")
  @RequirePermissions("routing.read")
  routingOverview() {
    return this.admin.routingOverview();
  }

  @Get("approvals")
  @RequirePermissions("audit.read")
  approvals() {
    return this.admin.approvalQueue();
  }
}
