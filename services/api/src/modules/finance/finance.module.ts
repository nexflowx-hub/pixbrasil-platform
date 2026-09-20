import { Module } from "@nestjs/common";
import { FinancialCoreService } from "./financial-core.service";

@Module({
  providers: [FinancialCoreService],
  exports: [FinancialCoreService],
})
export class FinanceModule {}
