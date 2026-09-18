import { Module } from "@nestjs/common";
import { RoutingEngineService } from "./routing-engine.service";

@Module({
  providers: [RoutingEngineService],
  exports: [RoutingEngineService],
})
export class RoutingModule {}
