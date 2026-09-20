import { Global, Module } from "@nestjs/common";
import { FinancialCoreService } from "./financial-core.service";
import { SettlementReleaseWorker } from "./settlement-release.worker";

@Global()
@Module({
  providers: [FinancialCoreService, SettlementReleaseWorker],
  exports: [FinancialCoreService],
})
export class FinancialModule {}
