export type RoutingStrategy =
  | "PRIORITY_FAILOVER"
  | "WEIGHTED"
  | "VOLUME_SPLIT"
  | "HEALTH_AWARE"
  | "COST_AWARE"
  | "RULES";

export type RoutingAccountType = "INDIVIDUAL" | "BUSINESS" | "INTERNAL";

export interface RoutingContext {
  paymentIntentId: string;
  accountId: string;
  accountType?: RoutingAccountType;
  merchantId?: string;
  storeId?: string;
  accountTier: string;
  amount: number;
  currency: "BRL";
  paymentMethod: "PIX";
  riskLevel?: string;
  policyId?: string;
  policyVersion?: number;
}

export interface RouteCandidate {
  connectionId: string;
  providerCode: string;
  priority: number;
  weight: number;
  minAmount?: number;
  maxAmount?: number;
  allowedTiers?: string[];
  allowedAccountTypes?: RoutingAccountType[];
  dailyVolumeCap?: number;
  dailyVolumeAssigned?: number;
  monthlyVolumeCap?: number;
  monthlyVolumeAssigned?: number;
  health: "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";
  successRate?: number;
  p95LatencyMs?: number;
  costBps?: number;
  fixedCost?: number;
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

const healthRank: Record<RouteCandidate["health"], number> = {
  HEALTHY: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  DOWN: 3,
};

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function routingKey(context: RoutingContext): string {
  return [
    context.paymentIntentId,
    context.policyId ?? "no-policy",
    String(context.policyVersion ?? 1),
  ].join(":");
}

function selectWeighted(
  key: string,
  candidates: RouteCandidate[],
): RouteCandidate | undefined {
  if (!candidates.length) return undefined;

  const totalWeight = candidates.reduce(
    (sum, candidate) => sum + Math.max(0, candidate.weight),
    0,
  );

  if (totalWeight <= 0) {
    return [...candidates].sort((a, b) => a.priority - b.priority)[0];
  }

  const unit = stableHash(key) / 0x1_0000_0000;
  const target = unit * totalWeight;
  let cursor = 0;

  for (const candidate of candidates) {
    cursor += Math.max(0, candidate.weight);
    if (target < cursor) return candidate;
  }

  return candidates[candidates.length - 1];
}

/**
 * Volume split is not random weighted routing.
 *
 * It chooses the connection with the lowest assigned-volume pressure relative
 * to its configured weight. For example, with weights 70/30, assignments of
 * 700/300 are balanced because both yield the same pressure.
 *
 * Daily/monthly hard caps are filtered before this stage.
 */
function selectVolumeSplit(
  candidates: RouteCandidate[],
): RouteCandidate | undefined {
  if (!candidates.length) return undefined;

  return [...candidates].sort((a, b) => {
    const weightA = Math.max(a.weight, 0.0001);
    const weightB = Math.max(b.weight, 0.0001);

    const dailyPressureA = (a.dailyVolumeAssigned ?? 0) / weightA;
    const dailyPressureB = (b.dailyVolumeAssigned ?? 0) / weightB;

    if (dailyPressureA !== dailyPressureB) {
      return dailyPressureA - dailyPressureB;
    }

    const monthlyPressureA = (a.monthlyVolumeAssigned ?? 0) / weightA;
    const monthlyPressureB = (b.monthlyVolumeAssigned ?? 0) / weightB;

    if (monthlyPressureA !== monthlyPressureB) {
      return monthlyPressureA - monthlyPressureB;
    }

    return a.priority - b.priority;
  })[0];
}

function estimatedCost(
  context: RoutingContext,
  candidate: RouteCandidate,
): number {
  const fixed = Math.max(0, candidate.fixedCost ?? 0);
  const variable = Math.max(0, candidate.costBps ?? 0);
  return fixed + context.amount * (variable / 10_000);
}

function selectCandidate(
  strategy: RoutingStrategy,
  context: RoutingContext,
  eligible: RouteCandidate[],
): RouteCandidate | undefined {
  if (!eligible.length) return undefined;

  switch (strategy) {
    case "WEIGHTED":
      return selectWeighted(routingKey(context), eligible);

    case "VOLUME_SPLIT":
      return selectVolumeSplit(eligible);

    case "HEALTH_AWARE":
      return [...eligible].sort((a, b) => {
        const health = healthRank[a.health] - healthRank[b.health];
        if (health !== 0) return health;

        const success = (b.successRate ?? -1) - (a.successRate ?? -1);
        if (success !== 0) return success;

        const latency =
          (a.p95LatencyMs ?? Number.MAX_SAFE_INTEGER) -
          (b.p95LatencyMs ?? Number.MAX_SAFE_INTEGER);
        if (latency !== 0) return latency;

        return a.priority - b.priority;
      })[0];

    case "COST_AWARE":
      return [...eligible].sort((a, b) => {
        const health = healthRank[a.health] - healthRank[b.health];
        if (health !== 0) return health;

        const cost = estimatedCost(context, a) - estimatedCost(context, b);
        if (cost !== 0) return cost;

        return a.priority - b.priority;
      })[0];

    case "PRIORITY_FAILOVER":
    case "RULES":
    default:
      return [...eligible].sort((a, b) => a.priority - b.priority)[0];
  }
}

export function evaluateRouting(
  context: RoutingContext,
  candidates: RouteCandidate[],
  strategy: RoutingStrategy,
): RoutingDecisionDraft {
  const eligible: RouteCandidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    let reason: string | undefined;

    if (!candidate.enabled) {
      reason = "CONNECTION_DISABLED";
    } else if (candidate.health === "DOWN") {
      reason = "PROVIDER_DOWN";
    } else if (
      candidate.minAmount != null &&
      context.amount < candidate.minAmount
    ) {
      reason = "BELOW_MIN_AMOUNT";
    } else if (
      candidate.maxAmount != null &&
      context.amount > candidate.maxAmount
    ) {
      reason = "ABOVE_MAX_AMOUNT";
    } else if (
      candidate.allowedTiers?.length &&
      !candidate.allowedTiers.includes(context.accountTier)
    ) {
      reason = "TIER_NOT_ALLOWED";
    } else if (
      context.accountType &&
      candidate.allowedAccountTypes?.length &&
      !candidate.allowedAccountTypes.includes(context.accountType)
    ) {
      reason = "ACCOUNT_TYPE_NOT_ALLOWED";
    } else if (
      candidate.dailyVolumeCap != null &&
      (candidate.dailyVolumeAssigned ?? 0) + context.amount >
        candidate.dailyVolumeCap
    ) {
      reason = "DAILY_VOLUME_CAP";
    } else if (
      candidate.monthlyVolumeCap != null &&
      (candidate.monthlyVolumeAssigned ?? 0) + context.amount >
        candidate.monthlyVolumeCap
    ) {
      reason = "MONTHLY_VOLUME_CAP";
    }

    if (reason) {
      rejected.push({ connectionId: candidate.connectionId, reason });
    } else {
      eligible.push(candidate);
    }
  }

  return {
    selected: selectCandidate(strategy, context, eligible),
    eligible,
    rejected,
  };
}

export function filterCandidates(
  context: RoutingContext,
  candidates: RouteCandidate[],
): RoutingDecisionDraft {
  return evaluateRouting(context, candidates, "PRIORITY_FAILOVER");
}
