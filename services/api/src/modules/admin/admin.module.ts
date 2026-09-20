import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinanceModule } from "../finance/finance.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuthModule, ProvidersModule, FinanceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
