import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class SettlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementsService.name);
  private releaseTimer?: NodeJS.Timeout;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit() {
    this.releaseTimer = setInterval(() => {
      void this.releaseDue(100).catch((error: unknown) => {
        this.logger.error(
          "Settlement release sweep failed",
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 30_000);
    this.releaseTimer.unref();
  }

  onModuleDestroy() {
    if (this.releaseTimer) clearInterval(this.releaseTimer);
  }

  async postVerifiedPayment(paymentIntentId: string) {
    const result = await this.database.query<{
      out_settlement_id: string;
      out_settlement_status: string;
      out_net_brl: string;
      out_available_at: string | null;
      out_wallet_id: string;
    }>(
      `
      select *
      from pixbrasil.post_verified_pix_settlement($1::uuid)
      `,
      [paymentIntentId],
    );

    const row = result.rows[0];
    return row
      ? {
          settlementId: row.out_settlement_id,
          status: row.out_settlement_status,
          netBrl: Number(row.out_net_brl),
          availableAt: row.out_available_at,
          walletId: row.out_wallet_id,
        }
      : null;
  }

  async releaseDue(limit = 100) {
    const result = await this.database.query<{ released: number }>(
      `
      select pixbrasil.release_due_settlements($1::integer) as released
      `,
      [limit],
    );
    return Number(result.rows[0]?.released ?? 0);
  }
}
