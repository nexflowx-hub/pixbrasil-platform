import { Module } from "@nestjs/common";
import { FinancialCoreService } from "./financial-core.service";
import { SettlementReleaseWorker } from "./settlement-release.worker";

@Module({
  providers: [FinancialCoreService, SettlementReleaseWorker],
  exports: [FinancialCoreService],
})
export class FinancialCoreModule {}
