import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { FinancialCoreService } from "./financial-core.service";

@Injectable()
export class SettlementReleaseWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly financial: FinancialCoreService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.financial.releaseDueSettlements().catch(() => undefined);
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
