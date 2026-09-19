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
