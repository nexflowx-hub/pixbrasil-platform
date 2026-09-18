export type RoutingStrategy =
  | "PRIORITY_FAILOVER"
  | "WEIGHTED"
  | "VOLUME_SPLIT"
  | "HEALTH_AWARE"
  | "COST_AWARE"
  | "RULES";

export interface RoutingContext {
  paymentIntentId: string;
  accountId: string;
  merchantId?: string;
  storeId?: string;
  accountTier: string;
  amount: number;
  currency: "BRL";
  paymentMethod: "PIX";
  riskLevel?: string;
}

export interface RouteCandidate {
  connectionId: string;
  providerCode: string;
  priority: number;
  weight: number;
  minAmount?: number;
  maxAmount?: number;
  allowedTiers?: string[];
  dailyVolumeCap?: number;
  dailyVolumeAssigned?: number;
  health: "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";
  successRate?: number;
  p95LatencyMs?: number;
  costBps?: number;
  enabled: boolean;
}

export interface RejectedCandidate {
  connectionId: string;
  reason: string;
}

export interface RoutingDecisionDraft {
  selected?: RouteCandidate;
  eligible: RouteCandidate[];
  rejected: RejectedCandidate[];
}

export function filterCandidates(
  context: RoutingContext,
  candidates: RouteCandidate[],
): RoutingDecisionDraft {
  const eligible: RouteCandidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    let reason: string | undefined;

    if (!candidate.enabled) reason = "CONNECTION_DISABLED";
    else if (candidate.health === "DOWN") reason = "PROVIDER_DOWN";
    else if (candidate.minAmount != null && context.amount < candidate.minAmount) {
      reason = "BELOW_MIN_AMOUNT";
    } else if (candidate.maxAmount != null && context.amount > candidate.maxAmount) {
      reason = "ABOVE_MAX_AMOUNT";
    } else if (
      candidate.allowedTiers?.length &&
      !candidate.allowedTiers.includes(context.accountTier)
    ) {
      reason = "TIER_NOT_ALLOWED";
    } else if (
      candidate.dailyVolumeCap != null &&
      (candidate.dailyVolumeAssigned ?? 0) + context.amount >
        candidate.dailyVolumeCap
    ) {
      reason = "DAILY_VOLUME_CAP";
    }

    if (reason) rejected.push({ connectionId: candidate.connectionId, reason });
    else eligible.push(candidate);
  }

  eligible.sort((a, b) => a.priority - b.priority);

  return {
    selected: eligible[0],
    eligible,
    rejected,
  };
}
