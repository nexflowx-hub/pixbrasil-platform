import { Injectable } from "@nestjs/common";
import type { PixProviderAdapter, ProviderCode } from "./provider-adapter";
import { MisticPayAdapter } from "./misticpay.adapter";
import { PixGoAdapter } from "./pixgo.adapter";

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, PixProviderAdapter>([
    ["PIXGO", new PixGoAdapter()],
    ["MISTICPAY", new MisticPayAdapter()],
  ]);

  get(code: ProviderCode): PixProviderAdapter {
    const adapter = this.adapters.get(String(code).toUpperCase());
    if (!adapter) {
      throw new Error(`Provider adapter not registered: ${code}`);
    }
    return adapter;
  }

  list(): PixProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
