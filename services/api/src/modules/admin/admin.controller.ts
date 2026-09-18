import {
  Controller,
  Get,
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
