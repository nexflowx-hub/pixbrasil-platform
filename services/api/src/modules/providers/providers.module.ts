import { Module } from "@nestjs/common";
import { ProviderAdapterRegistry } from "./provider-adapter.registry";

@Module({
  providers: [ProviderAdapterRegistry],
  exports: [ProviderAdapterRegistry],
})
export class ProvidersModule {}
