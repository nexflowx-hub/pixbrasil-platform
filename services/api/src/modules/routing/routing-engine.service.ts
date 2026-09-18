import { Injectable } from "@nestjs/common";
import {
  evaluateRouting,
  type RouteCandidate,
  type RoutingContext,
  type RoutingDecisionDraft,
  type RoutingStrategy,
} from "./routing-engine";

@Injectable()
export class RoutingEngineService {
  evaluate(
    context: RoutingContext,
    candidates: RouteCandidate[],
    strategy: RoutingStrategy = "PRIORITY_FAILOVER",
  ): RoutingDecisionDraft {
    return evaluateRouting(context, candidates, strategy);
  }
}
