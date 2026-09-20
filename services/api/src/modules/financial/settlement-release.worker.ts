import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { FinancialCoreService } from "./financial-core.service";

@Injectable()
export class SettlementReleaseWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementReleaseWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly financial: FinancialCoreService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const released = await this.financial.releaseDueSettlements(50);
      if (released > 0) {
        this.logger.log(`Released ${released} due settlement(s).`);
      }
    } catch (error) {
      this.logger.error(
        "Settlement release worker failed.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
