import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialCoreModule } from "../financial-core/financial-core.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuthModule, ProvidersModule, FinancialCoreModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
