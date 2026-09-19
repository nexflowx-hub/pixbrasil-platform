import { Module } from "@nestjs/common";
import { ClientAuthGuard } from "./client-auth.guard";
import { ClientAuthService } from "./client-auth.service";

@Module({
  providers: [ClientAuthService, ClientAuthGuard],
  exports: [ClientAuthService, ClientAuthGuard],
})
export class ClientAuthModule {}
