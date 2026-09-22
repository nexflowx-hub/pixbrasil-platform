"use client";

export type AccountAccess = {
  accountId: string;
  accountType: "INDIVIDUAL" | "BUSINESS" | "INTERNAL";
  accountStatus: string;
  kycStatus: string;
  role: string;
  baseCurrency: string;
  merchant?: {
    merchant_id: string;
    trade_name: string | null;
    tier_code: string;
    merchant_status: string;
  } | null;
};

export type SessionData = {
  email?: string;
  userStatus: string;
  aal: string;
  accounts: AccountAccess[];
};

export type SessionPayload = {
  success: true;
  data: SessionData;
};

export type StoreRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  currency: string;
  release_profile: string | null;
  release_class: string | null;
  available_brl: string;
  pending_brl: string;
  total_net_brl: string;
  next_available_at: string | null;
};

export type PaymentRow = {
  id: string;
  external_reference: string | null;
  amount: string;
  currency: string;
  status: string;
  payment_method: string;
  store_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type PayoutRow = {
  id: string;
  amount: string;
  asset_code: string;
  destination_type: string | null;
  status: string;
  external_reference: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  proof_metadata: Record<string, unknown>;
};

export type SettlementRow = {
  id: string;
  external_reference: string | null;
  store_code: string | null;
  gross_brl: string;
  provider_fee_brl: string;
  platform_fee_brl: string;
  net_brl: string;
  status: string;
  available_at: string | null;
  created_at: string;
};

export type CashflowRow = {
  day: string;
  incoming_brl: string;
  outgoing_brl: string;
};

export type BusinessData = {
  merchant: {
    merchant_id: string;
    trade_name: string | null;
    merchant_status: string;
    tier_code: string;
  };
  summary: {
    availableBrl: number;
    pendingBrl: number;
    reservedBrl: number;
    blockedBrl: number;
  };
  stores: StoreRow[];
  payments: PaymentRow[];
  payouts: PayoutRow[];
  settlements: SettlementRow[];
  operations: {
    pixStatus: "OPERATIONAL" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
    payments30d: number;
    successful30d: number;
    successRate30d: string | null;
  };
  cashflow: CashflowRow[];
};

export type OverviewData = {
  accessRole: string;
  account: {
    id: string;
    type: string;
    status: string;
    kyc_status: string;
    identity_level: string;
    base_currency: string;
    pricing_plan_code: string | null;
    policy_profile_code: string | null;
  };
  wallets: Array<{
    wallet_id: string;
    wallet_status: string;
    asset_code: string;
    symbol: string;
    asset_name: string;
    asset_type: string;
    network: string;
    decimals: number;
    available: string;
    pending: string;
    reserved: string;
    blocked: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amount: string;
    symbol: string;
    created_at: string;
  }>;
  business: BusinessData | null;
  capabilities: {
    financialWritesEnabled: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    exchangeEnabled: boolean;
    payoutsEnabled: boolean;
  };
};

export type OverviewPayload = {
  success: true;
  data: OverviewData;
};

export type DashboardProps = {
  session: SessionData | null;
  activeAccess: AccountAccess | undefined;
  overview: OverviewData | null;
  busy: boolean;
  error: string;
  accountId: string;
  setAccountId: (value: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function brl(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function compactId(value: string) {
  return value.length > 18
    ? value.slice(0, 8) + "…" + value.slice(-6)
    : value;
}

export function statusTone(value: string) {
  const normalized = value.toUpperCase();
  if (
    [
      "ACTIVE",
      "HEALTHY",
      "SUCCEEDED",
      "AVAILABLE",
      "CONFIRMED",
      "PAID",
      "DELIVERED"
    ].includes(normalized)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (
    [
      "PENDING",
      "PENDING_PAYMENT",
      "APPROVAL_REQUIRED",
      "APPROVED",
      "PROCESSING"
    ].includes(normalized)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["FAILED", "REJECTED", "CANCELED", "BLOCKED"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}
