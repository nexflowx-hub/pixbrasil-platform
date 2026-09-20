import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

@Injectable()
export class ProviderWebhookReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;

  constructor(private readonly webhooks: WebhooksService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.webhooks.reconcilePendingVerifiedEvents().catch(() => undefined);
    }, 30_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
