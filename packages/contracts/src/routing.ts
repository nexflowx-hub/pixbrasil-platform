export type PaymentMethod = "pix";
export type RoutingEnvironment = "sandbox" | "production";
export type RoutingStrategy =
  | "priority_failover"
  | "weighted"
  | "volume_split"
  | "least_cost"
  | "manual";

export type RoutingActivationMode = "shadow" | "enforce";

export type CustomerTierCode =
  | "PERSONAL_STANDARD"
  | "PERSONAL_PLUS"
  | "BUSINESS_START"
  | "BUSINESS_GROWTH"
  | "BUSINESS_ENTERPRISE"
  | string;

export type ProviderHealthState = "healthy" | "degraded" | "down" | "unknown";

export interface RoutingContext {
  requestId: string;
  idempotencyKey: string;
  accountId: string;
  accountType: "INDIVIDUAL" | "BUSINESS" | "INTERNAL";
  merchantId?: string;
  storeId?: string;
  customerTier?: CustomerTierCode;
  method: PaymentMethod;
  currency: "BRL";
  amountMinor: number;
  environment: RoutingEnvironment;
  rollingVolumeMinor?: {
    account24h?: number;
    account30d?: number;
    store24h?: number;
    store30d?: number;
  };
}

export interface RoutingCandidate {
  connectionId: string;
  alias: string;
  providerCode: string;
  providerAccountId: string;
  priority: number;
  weight: number;
  estimatedCostMinor?: number;
  health: ProviderHealthState;
  successRate5m?: number;
  p95LatencyMs?: number;
  dailyVolumeMinor?: number;
  monthlyVolumeMinor?: number;
  eligible: boolean;
  exclusionReasons: string[];
}

export interface RoutingDecision {
  decisionId: string;
  mode: RoutingActivationMode;
  strategy: RoutingStrategy;
  selectedConnectionId: string | null;
  selectedProviderCode: string | null;
  reason: string;
  candidates: RoutingCandidate[];
  decidedAt: string;
}
