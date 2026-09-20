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

export type ClientSessionData = {
  email?: string;
  userStatus: string;
  aal: string;
  accounts: AccountAccess[];
};

export type ClientOverview = {
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
    asset_code: string;
    symbol: string;
    fee_amount: string | null;
    provider_reference: string | null;
    created_at: string;
    completed_at: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  business: null | {
    merchant: {
      merchant_id: string;
      trade_name: string | null;
      merchant_status: string;
      tier_code: string;
    };
    stores: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
      currency: string;
      gateway_alias: string | null;
      provider_code: string | null;
      release_profile: string | null;
      release_class: string | null;
      route_cost_profile: string | null;
      routing_mode: string | null;
      provider_health: string | null;
      routing_eligible: boolean;
    }>;
    payments: Array<{
      id: string;
      external_reference: string | null;
      amount: string;
      currency: string;
      status: string;
      payment_method: string;
      store_code: string | null;
      provider_code: string | null;
      net_brl: string | null;
      settlement_status: string | null;
      available_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
    storeFinancials: Array<{
      store_id: string;
      store_code: string;
      store_name: string;
      available_brl: string;
      pending_brl: string;
      next_release_at: string | null;
      available_count: number;
      pending_count: number;
    }>;
    gateways: Array<{
      provider_code: string;
      gateway_alias: string;
      gateway_status: string;
      health: string;
      latency_ms: number;
      routing_eligible: boolean;
    }>;
    cashflow30d: Array<{
      day: string;
      incoming_brl: string;
      outgoing_brl: string;
    }>;
    payouts: Array<{
      id: string;
      amount: string;
      asset_code: string;
      destination_type: string | null;
      destination_snapshot: Record<string, unknown>;
      status: string;
      external_reference: string | null;
      created_at: string;
      updated_at: string;
      paid_at: string | null;
      confirmed_at: string | null;
    }>;
    payoutDesk: {
      mode: "MANUAL_TELEGRAM";
      telegramUsername: string | null;
      automaticPayouts: boolean;
    };
  };
  capabilities: {
    financialWritesEnabled: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    payoutMode: string;
    exchangeEnabled: boolean;
    note: string;
  };
};
