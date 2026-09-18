import { Global, Module } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { PermissionsGuard } from "./permissions.guard";

@Global()
@Module({
  providers: [AdminAuthService, AdminAuthGuard, PermissionsGuard],
  exports: [AdminAuthService, AdminAuthGuard, PermissionsGuard],
})
export class AuthModule {}
