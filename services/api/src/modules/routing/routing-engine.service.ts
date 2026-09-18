import { Injectable } from "@nestjs/common";
import {
  filterCandidates,
  type RouteCandidate,
  type RoutingContext,
  type RoutingDecisionDraft,
} from "./routing-engine";

@Injectable()
export class RoutingEngineService {
  evaluate(
    context: RoutingContext,
    candidates: RouteCandidate[],
  ): RoutingDecisionDraft {
    return filterCandidates(context, candidates);
  }
}
