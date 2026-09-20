"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  CircleHelp,
  Code2,
  CreditCard,
  GitBranch,
  KeyRound,
  Landmark,
  Layers3,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrandLogo } from "@/components/brand/logo";

type AccountAccess = {
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

type SessionPayload = {
  success: true;
  data: {
    email?: string;
    userStatus: string;
    aal: string;
    accounts: AccountAccess[];
  };
};

type StoreRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  currency: string;
  gateway_alias: string | null;
  provider_code: string | null;
  provider_health: string | null;
  latency_ms: number | null;
  release_profile: string | null;
  release_class: string | null;
  route_cost_profile: string | null;
  routing_mode: string | null;
  available_brl: string;
  pending_brl: string;
  total_net_brl: string;
  next_available_at: string | null;
};

type PaymentRow = {
  id: string;
  external_reference: string | null;
  amount: string;
  currency: string;
  status: string;
  payment_method: string;
  store_code: string | null;
  provider_code: string | null;
  provider_payment_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type PayoutRow = {
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

type SettlementRow = {
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

type ProviderHealth = {
  provider_code: string;
  gateway_alias: string;
  health: string;
  latency_ms: number | null;
  tested_at: string | null;
  attempts_30d: number;
  successes_30d: number;
  success_rate_30d: string | null;
};

type CashflowRow = {
  day: string;
  incoming_brl: string;
  outgoing_brl: string;
};

type BusinessData = {
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
  providerHealth: ProviderHealth[];
  cashflow: CashflowRow[];
};

type OverviewData = {
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
    provider_reference: string | null;
    created_at: string;
  }>;
  business: BusinessData | null;
  capabilities: {
    financialWritesEnabled: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    exchangeEnabled: boolean;
    payoutMode?: string;
    payoutChannel?: string | null;
    note: string;
  };
};

type OverviewPayload = {
  success: true;
  data: OverviewData;
};

function brl(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function compactId(value: string) {
  return value.length > 18 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

function statusTone(value: string) {
  const normalized = value.toUpperCase();
  if (["ACTIVE", "HEALTHY", "SUCCEEDED", "AVAILABLE", "CONFIRMED", "PAID"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["PENDING", "PENDING_PAYMENT", "APPROVAL_REQUIRED", "PROCESSING"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload["data"] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [payoutOpen, setPayoutOpen] = useState(false);

  const loadOverview = useCallback(
    async (id: string) => {
      if (!id) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          "/api/client/accounts/" + encodeURIComponent(id) + "/overview",
          { cache: "no-store" },
        );
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = (await response.json()) as OverviewPayload;
        if (!response.ok) throw new Error("Não foi possível carregar a conta.");
        setOverview(payload.data);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Falha ao carregar conta.",
        );
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/client/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        const payload = (await response.json()) as SessionPayload;
        if (!response.ok) throw new Error("Não foi possível carregar a sessão.");
        return payload.data;
      })
      .then((data) => {
        if (!active || !data) return;
        setSession(data);
        setAccountId(data.accounts[0]?.accountId || "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Falha de sessão.",
          );
          setBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!accountId) return;
    void Promise.resolve().then(() => loadOverview(accountId));
  }, [accountId, loadOverview]);

  const activeAccess = useMemo(
    () => session?.accounts.find((account) => account.accountId === accountId),
    [session, accountId],
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (activeAccess?.accountType === "BUSINESS") {
    return (
      <BusinessDashboard
        session={session}
        activeAccess={activeAccess}
        overview={overview}
        busy={busy}
        error={error}
        accountId={accountId}
        setAccountId={setAccountId}
        refresh={() => loadOverview(accountId)}
        signOut={signOut}
        payoutOpen={payoutOpen}
        setPayoutOpen={setPayoutOpen}
      />
    );
  }

  return (
    <PersonalDashboard
      session={session}
      activeAccess={activeAccess}
      overview={overview}
      busy={busy}
      error={error}
      accountId={accountId}
      setAccountId={setAccountId}
      refresh={() => loadOverview(accountId)}
      signOut={signOut}
    />
  );
}

function BusinessDashboard(props: {
  session: SessionPayload["data"] | null;
  activeAccess: AccountAccess;
  overview: OverviewData | null;
  busy: boolean;
  error: string;
  accountId: string;
  setAccountId: (value: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  payoutOpen: boolean;
  setPayoutOpen: (value: boolean) => void;
}) {
  const business = props.overview?.business;
  const summary = business?.summary ?? {
    availableBrl: 0,
    pendingBrl: 0,
    reservedBrl: 0,
    blockedBrl: 0,
  };
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredStores = (business?.stores ?? []).filter((store) => {
    if (!normalizedSearch) return true;
    return [
      store.code,
      store.name,
      store.provider_code ?? "",
      store.gateway_alias ?? "",
      store.release_class ?? "",
      store.status,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const filteredPayments = (business?.payments ?? []).filter((payment) => {
    if (!normalizedSearch) return true;
    return [
      payment.external_reference ?? "",
      payment.store_code ?? "",
      payment.provider_code ?? "",
      payment.provider_payment_id ?? "",
      payment.status,
      payment.amount,
    ].some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
  const activeAlerts =
    (business?.payouts ?? []).filter((row) =>
      ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING"].includes(row.status),
    ).length +
    (business?.settlements ?? []).filter((row) => row.status === "PENDING").length;

  const today = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#F4F7F6] text-[#0A1614]">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <BusinessSidebar
          session={props.session}
          accountId={props.accountId}
          setAccountId={props.setAccountId}
          activeAccess={props.activeAccess}
        />

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[68px] items-center gap-4 border-b border-[#DCE6E2] bg-white/95 px-5 backdrop-blur lg:px-7">
            <div className="relative hidden max-w-[680px] flex-1 md:block">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E79]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar transações, Stores, referências..."
                className="h-10 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] pl-11 pr-4 text-[12px] outline-none focus:border-[#20D99A]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2 text-[#50625D]">
              <a
                href="/docs"
                className="hidden h-9 items-center gap-2 rounded-lg px-3 text-[11px] hover:bg-[#F1F6F4] sm:flex"
              >
                <CircleHelp className="h-4 w-4" />
                Ajuda
              </a>
              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#F1F6F4]"
                aria-label={activeAlerts ? activeAlerts + " alertas operacionais" : "Sem alertas operacionais"}
                title={activeAlerts ? activeAlerts + " alertas operacionais" : "Sem alertas operacionais"}
              >
                <Bell className="h-4 w-4" />
                {activeAlerts ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[7px] font-bold text-white">
                    {activeAlerts > 9 ? "9+" : activeAlerts}
                  </span>
                ) : null}
              </button>
              <div className="h-7 w-px bg-[#E1E8E5]" />
              <button className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[#F1F6F4]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D3A32] text-[10px] font-bold text-white">
                  {initials(business?.merchant.trade_name || "PiXBrasil")}
                </div>
                <div className="hidden text-left sm:block">
                  <strong className="block text-[11px] text-[#12211E]">
                    {business?.merchant.trade_name || "Minha conta"}
                  </strong>
                  <span className="text-[9px] text-[#70817C]">PiXBrasil Business</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => void props.signOut()}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#F1F6F4]"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-7">
            <div className="mx-auto max-w-[1500px] space-y-4">
              <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#13956B]">
                    BUSINESS CONTROL
                  </span>
                  <h1 className="mt-1 text-3xl font-bold tracking-[-.045em] text-[#0A1714]">
                    Visão geral financeira
                  </h1>
                  <p className="mt-1 text-[12px] text-[#6C7E79]">
                    Recursos disponíveis, recebíveis por Store e operação PIX.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#70817C]">
                  <CalendarDays className="h-4 w-4" />
                  {today}
                  <button
                    onClick={() => void props.refresh()}
                    disabled={props.busy}
                    className="ml-2 flex h-9 items-center gap-2 rounded-lg border border-[#DCE6E2] bg-white px-3 font-semibold hover:bg-[#F7FAF9]"
                  >
                    <RefreshCw className={props.busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                    Atualizar
                  </button>
                </div>
              </section>

              {props.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                  {props.error}
                </div>
              ) : null}

              <section id="wallet" className="grid gap-3 xl:grid-cols-[1.6fr_.65fr_.65fr]">
                <article className="overflow-hidden rounded-2xl bg-[linear-gradient(125deg,#0A3A30,#06221D)] p-5 text-white shadow-[0_16px_45px_rgba(9,52,43,.15)]">
                  <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#A2C9BE]">
                        <WalletCards className="h-4 w-4 text-[#20F2A0]" />
                        Wallet BRL empresarial
                      </div>
                      <span className="mt-1 block text-[9px] text-[#7FA79C]">
                        Disponível para payout
                      </span>
                      <strong className="mt-4 block text-4xl font-bold tracking-[-.045em]">
                        {brl(summary.availableBrl)}
                      </strong>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={() => props.setPayoutOpen(true)}
                          className="flex h-10 items-center gap-2 rounded-lg bg-[#20E79C] px-4 text-[10px] font-extrabold text-[#042019] hover:bg-[#43F2AF]"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Solicitar payout
                        </button>
                        <button
                          onClick={() => scrollToSection("payments")}
                          className="flex h-10 items-center gap-2 rounded-lg border border-white/25 px-4 text-[10px] font-semibold hover:bg-white/5"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Pagamentos PIX
                        </button>
                        <a
                          href="/docs/api"
                          className="flex h-10 items-center gap-2 rounded-lg border border-white/25 px-4 text-[10px] font-semibold hover:bg-white/5"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          API
                        </a>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-4 text-[9px] text-[#9EC1B8] md:w-[220px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-[#C7E0D9]" />
                        <strong>Payouts por ticket</strong>
                      </div>
                      <p className="mt-2 leading-5">
                        Nesta fase operacional, os pedidos de payout são encaminhados para validação manual via Telegram.
                      </p>
                    </div>
                  </div>
                </article>

                <MetricCard
                  icon={ArrowDownToLine}
                  label="A liberar"
                  value={brl(summary.pendingBrl)}
                  description="Recebíveis em processo de liberação."
                  tone="amber"
                />
                <MetricCard
                  icon={ShieldCheck}
                  label="Reservado"
                  value={brl(summary.reservedBrl)}
                  description="Valores associados a payouts e retenções."
                  tone="blue"
                />
              </section>

              <div className="grid gap-4 2xl:grid-cols-[1.28fr_.92fr]">
                <StoreReleasePanel stores={filteredStores} />
                <GatewayPanel providers={business?.providerHealth ?? []} />
              </div>

              <div id="payments" className="grid gap-4 2xl:grid-cols-[1.18fr_1fr]">
                <PaymentsPanel payments={filteredPayments} />
                <CashflowPanel rows={business?.cashflow ?? []} summary={summary} />
              </div>

              <div className="grid gap-4 2xl:grid-cols-[1.18fr_1fr]">
                <SettlementsPanel settlements={business?.settlements ?? []} />
                <PayoutsPanel payouts={business?.payouts ?? []} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {props.payoutOpen ? (
        <PayoutModal
          accountId={props.accountId}
          available={summary.availableBrl}
          onClose={() => props.setPayoutOpen(false)}
          onCreated={async () => {
            props.setPayoutOpen(false);
            await props.refresh();
          }}
        />
      ) : null}
    </main>
  );
}

function BusinessSidebar(props: {
  session: SessionPayload["data"] | null;
  accountId: string;
  setAccountId: (value: string) => void;
  activeAccess: AccountAccess;
}) {
  const nav = [
    ["Visão geral", BarChart3, "top"],
    ["Wallet BRL", WalletCards, "wallet"],
    ["Stores", Store, "stores"],
    ["Pagamentos PIX", CreditCard, "payments"],
    ["Transações", Activity, "payments"],
    ["Liberações", CalendarDays, "stores"],
    ["Payouts", Send, "payouts"],
    ["Routing", GitBranch, "gateway"],
  ] as const;

  return (
    <aside className="hidden min-h-screen bg-[linear-gradient(180deg,#061C18,#03110F)] px-3 py-5 text-white lg:block">
      <div className="px-2">
        <BrandLogo className="text-[18px]" />
      </div>

      <div className="mt-7 rounded-xl border border-white/10 bg-white/[.035] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#123B33]">
            <Building2 className="h-4 w-4 text-[#35E5A9]" />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[10px]">
              {props.activeAccess.merchant?.trade_name || "Business"}
            </strong>
            <span className="mt-1 block text-[8px] text-[#71958B]">
              {props.activeAccess.role} · {compactId(props.accountId)}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-[#71958B]" />
        </div>

        {(props.session?.accounts.length ?? 0) > 1 ? (
          <select
            className="mt-3 h-8 w-full rounded-lg border border-white/10 bg-[#071B17] px-2 text-[8px] text-[#A9C1BA]"
            value={props.accountId}
            onChange={(event) => props.setAccountId(event.target.value)}
          >
            {props.session?.accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountType === "BUSINESS"
                  ? account.merchant?.trade_name || "Business"
                  : "Personal"}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <nav className="mt-6 space-y-1">
        {nav.map(([label, Icon, target], index) => (
          <button
            key={label}
            onClick={() =>
              target === "top"
                ? window.scrollTo({ top: 0, behavior: "smooth" })
                : scrollToSection(target)
            }
            className={[
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[10px] font-medium transition",
              index === 0
                ? "bg-[#124C40] text-white"
                : "text-[#B4C7C2] hover:bg-white/[.05] hover:text-white",
            ].join(" ")}
          >
            <Icon className={index === 0 ? "h-4 w-4 text-[#24E6A5]" : "h-4 w-4"} />
            {label}
          </button>
        ))}
      </nav>

      <div className="my-4 h-px bg-white/8" />

      <nav className="space-y-1">
        <a
          href="/docs"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-[10px] font-medium text-[#B4C7C2] hover:bg-white/[.05] hover:text-white"
        >
          <Code2 className="h-4 w-4" />
          Desenvolvedores
        </a>
        <button className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[10px] font-medium text-[#B4C7C2] hover:bg-white/[.05] hover:text-white">
          <Settings2 className="h-4 w-4" />
          Definições
        </button>
      </nav>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[.025] p-4">
        <strong className="text-[10px]">PIX que impulsiona o negócio.</strong>
        <p className="mt-2 text-[8px] leading-4 text-[#6F9188]">
          Stores, routing, recebíveis e payouts numa única operação.
        </p>
        <div className="mt-4 h-1 w-8 rounded-full bg-[#20E79C]" />
      </div>
    </aside>
  );
}

function MetricCard(props: {
  icon: typeof ArrowDownToLine;
  label: string;
  value: string;
  description: string;
  tone: "amber" | "blue";
}) {
  const Icon = props.icon;
  const tone =
    props.tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-sky-100 text-sky-700";

  return (
    <article className="rounded-2xl border border-[#DBE5E1] bg-white p-5 shadow-[0_8px_24px_rgba(30,68,58,.04)]">
      <div className="flex items-center justify-between">
        <span className={"flex h-9 w-9 items-center justify-center rounded-xl " + tone}>
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-[#78908A]" />
      </div>
      <strong className="mt-5 block text-[11px]">{props.label}</strong>
      <strong className="mt-2 block text-2xl tracking-[-.04em]">{props.value}</strong>
      <p className="mt-3 text-[9px] leading-5 text-[#768A84]">{props.description}</p>
    </article>
  );
}

function StoreReleasePanel({ stores }: { stores: StoreRow[] }) {
  return (
    <Panel id="stores" title="Liberações por Store" icon={Store} action="Ver todas as Stores">
      {stores.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[9px]">
            <thead>
              <tr className="border-b border-[#E3EBE8] text-[#748780]">
                <th className="px-3 py-3 font-semibold">Store</th>
                <th className="px-3 py-3 font-semibold">Provider</th>
                <th className="px-3 py-3 font-semibold">Liberação</th>
                <th className="px-3 py-3 font-semibold">Release</th>
                <th className="px-3 py-3 font-semibold">A liberar</th>
                <th className="px-3 py-3 font-semibold">Disponível</th>
                <th className="px-3 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-b border-[#EEF3F1] last:border-0">
                  <td className="px-3 py-3">
                    <strong className="block text-[#162722]">{store.name}</strong>
                    <span className="mt-1 block text-[8px] text-[#85958F]">{store.code}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold">{store.provider_code || "—"}</span>
                    <span className="mt-1 block text-[8px] text-[#85958F]">{store.gateway_alias || "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    {(() => {
                      const available = Number(store.available_brl || 0);
                      const pending = Number(store.pending_brl || 0);
                      const total = available + pending;
                      const progress = total > 0 ? Math.round((available / total) * 100) : 100;
                      return (
                        <div className="min-w-[120px]">
                          <div className="flex items-center justify-between text-[8px] text-[#71847D]">
                            <span>{progress}% disponível</span>
                            <span>{store.release_class || "—"}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E6EFEC]">
                            <div
                              className="h-full rounded-full bg-[#20D99A]"
                              style={{ width: progress + "%" }}
                            />
                          </div>
                          <span className="mt-1.5 block text-[7px] text-[#8A9A95]">
                            {store.next_available_at
                              ? "Próxima liberação " + new Date(store.next_available_at).toLocaleString("pt-BR")
                              : "Sem valores pendentes"}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold">{store.release_class || "—"}</span>
                    <span className="mt-1 block text-[8px] text-[#85958F]">{store.release_profile || "—"}</span>
                  </td>
                  <td className="px-3 py-3 font-semibold">{brl(store.pending_brl)}</td>
                  <td className="px-3 py-3 font-semibold">{brl(store.available_brl)}</td>
                  <td className="px-3 py-3">
                    <Status value={store.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty label="Nenhuma Store configurada." />
      )}
    </Panel>
  );
}

function GatewayPanel({ providers }: { providers: ProviderHealth[] }) {
  return (
    <Panel id="gateway" title="Gateway PIX" icon={GitBranch} action="Routing em tempo real">
      <p className="-mt-1 mb-4 text-[9px] text-[#758881]">
        Providers e estado operacional das rotas.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => (
          <div key={provider.gateway_alias} className="rounded-xl border border-[#E0E9E6] bg-[#FBFCFC] p-3">
            <div className="flex items-center justify-between">
              <strong className="text-[10px]">{provider.provider_code}</strong>
              <span className="flex items-center gap-1 text-[8px] text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {provider.health}
              </span>
            </div>
            <span className="mt-1 block text-[8px] text-[#84968F]">{provider.gateway_alias}</span>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[8px] text-[#62766F]">
              <span>Latência <strong>{provider.latency_ms ?? "—"} ms</strong></span>
              <span className="text-right">
                Sucesso 30d{" "}
                <strong>
                  {provider.success_rate_30d == null
                    ? "—"
                    : Number(provider.success_rate_30d).toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      }) + "%"}
                </strong>
              </span>
              <span className="col-span-2 text-[#87968F]">
                {provider.attempts_30d || 0} tentativas · {provider.successes_30d || 0} concluídas
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-[#DDE7E3] bg-[#F7FAF9] p-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#13956B]" />
          <div>
            <strong className="block text-[9px]">Routing por Store</strong>
            <span className="text-[8px] text-[#748780]">Seleção do provider conforme política, release e saúde da rota.</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PaymentsPanel({ payments }: { payments: PaymentRow[] }) {
  return (
    <Panel title="Movimentações recentes" icon={Activity} action="Últimos pagamentos PIX">
      {payments.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[9px]">
            <thead>
              <tr className="border-b border-[#E3EBE8] text-[#748780]">
                <th className="px-3 py-3 font-semibold">Referência</th>
                <th className="px-3 py-3 font-semibold">Store</th>
                <th className="px-3 py-3 font-semibold">Provider</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="border-b border-[#EEF3F1] last:border-0">
                  <td className="px-3 py-3">
                    <strong className="block text-[#173029]">{payment.external_reference || compactId(payment.id)}</strong>
                    <span className="mt-1 block text-[8px] text-[#84968F]">{new Date(payment.created_at).toLocaleString("pt-BR")}</span>
                  </td>
                  <td className="px-3 py-3">{payment.store_code || "—"}</td>
                  <td className="px-3 py-3">{payment.provider_code || "—"}</td>
                  <td className="px-3 py-3"><Status value={payment.status} /></td>
                  <td className="px-3 py-3 text-right font-bold">{brl(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty label="Ainda não existem pagamentos PIX." />}
    </Panel>
  );
}

function CashflowPanel(props: {
  rows: CashflowRow[];
  summary: BusinessData["summary"];
}) {
  const max = Math.max(
    1,
    ...props.rows.flatMap((row) => [
      Number(row.incoming_brl || 0),
      Number(row.outgoing_brl || 0),
    ]),
  );

  return (
    <Panel title="Fluxo de caixa (30 dias)" icon={BarChart3} action="Entradas e payouts">
      <div className="mb-4 flex flex-wrap gap-4 text-[8px] text-[#667A73]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#20D99A]" /> Entradas PIX</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#64A7F7]" /> Saídas</span>
        <span className="ml-auto font-semibold text-[#173029]">Saldo {brl(props.summary.availableBrl)}</span>
      </div>
      <div className="flex h-[190px] items-end gap-[3px] rounded-xl border border-[#E5ECEA] bg-[#FBFCFC] px-3 pb-3 pt-5">
        {props.rows.map((row) => {
          const incoming = Number(row.incoming_brl || 0);
          const outgoing = Number(row.outgoing_brl || 0);
          return (
            <div key={row.day} className="flex h-full min-w-0 flex-1 items-end gap-[1px]" title={row.day}>
              <div
                className="w-1/2 rounded-t-sm bg-[#20D99A]"
                style={{ height: Math.max(2, (incoming / max) * 100) + "%" }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-[#64A7F7]"
                style={{ height: Math.max(2, (outgoing / max) * 100) + "%" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[7px] text-[#8A9B95]">
        <span>30 dias</span><span>Hoje</span>
      </div>
    </Panel>
  );
}

function SettlementsPanel({ settlements }: { settlements: SettlementRow[] }) {
  return (
    <Panel title="Liberações" icon={CalendarDays} action="Settlement book">
      {settlements.length ? (
        <div className="space-y-2">
          {settlements.slice(0, 8).map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-[#E3EBE8] px-3 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9F7F1] text-[#13956B]">
                <Banknote className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[9px]">{row.store_code || "Store"} · {row.external_reference || compactId(row.id)}</strong>
                <span className="mt-1 block text-[8px] text-[#81928C]">
                  {row.available_at ? "Disponível " + new Date(row.available_at).toLocaleString("pt-BR") : "Aguardando"}
                </span>
              </div>
              <div className="text-right">
                <strong className="block text-[10px]">{brl(row.net_brl)}</strong>
                <Status value={row.status} />
              </div>
            </div>
          ))}
        </div>
      ) : <Empty label="Nenhuma liberação registrada." />}
    </Panel>
  );
}

function PayoutsPanel({ payouts }: { payouts: PayoutRow[] }) {
  return (
    <Panel id="payouts" title="Payouts" icon={Send} action="Processamento manual por ticket">
      {payouts.length ? (
        <div className="space-y-2">
          {payouts.slice(0, 8).map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-[#E3EBE8] px-3 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF5FF] text-[#3E7DD9]">
                <Send className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-[9px]">Ticket {compactId(row.id)}</strong>
                <span className="mt-1 block text-[8px] text-[#81928C]">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="text-right">
                <strong className="block text-[10px]">{brl(row.amount)}</strong>
                <Status value={row.status} />
              </div>
            </div>
          ))}
        </div>
      ) : <Empty label="Nenhum payout solicitado." />}
    </Panel>
  );
}

function PayoutModal(props: {
  accountId: string;
  available: number;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/client/accounts/" + encodeURIComponent(props.accountId) + "/payouts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            amount: Number(amount),
            currency: "BRL",
            destination: {
              type: "PIX",
              pixKey,
              pixKeyType: "AUTO",
              beneficiaryName,
            },
            note,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(body.message || "Não foi possível criar o payout.");
      }
      await props.onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar payout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03110F]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[470px] rounded-2xl border border-[#DCE6E2] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#13956B]">PAYOUT MANUAL</span>
            <h2 className="mt-1 text-xl font-bold tracking-[-.035em]">Solicitar payout PIX</h2>
            <p className="mt-1 text-[10px] text-[#748780]">Disponível: {brl(props.available)}</p>
          </div>
          <button onClick={props.onClose} className="rounded-lg px-2 py-1 text-[#71847D] hover:bg-[#F3F7F5]">×</button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Valor (BRL)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={props.available}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[11px] outline-none focus:border-[#20D99A]"
              placeholder="0,00"
            />
          </Field>
          <Field label="Chave PIX">
            <input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[11px] outline-none focus:border-[#20D99A]"
              placeholder="CPF, CNPJ, email, telefone ou aleatória"
            />
          </Field>
          <Field label="Beneficiário">
            <input
              value={beneficiaryName}
              onChange={(event) => setBeneficiaryName(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[11px] outline-none focus:border-[#20D99A]"
              placeholder="Nome do titular"
            />
          </Field>
          <Field label="Observação">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[82px] w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 py-3 text-[11px] outline-none focus:border-[#20D99A]"
              placeholder="Informação opcional para Operações"
            />
          </Field>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[10px] text-red-700">{error}</div> : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] leading-5 text-amber-800">
            O pedido será reservado na Wallet BRL e encaminhado como ticket operacional para processamento manual.
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={props.onClose} className="h-10 rounded-lg border border-[#DCE6E2] px-4 text-[10px] font-semibold">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#0A3A30] px-4 text-[10px] font-bold text-white disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Criar ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonalDashboard(props: {
  session: SessionPayload["data"] | null;
  activeAccess: AccountAccess | undefined;
  overview: OverviewData | null;
  busy: boolean;
  error: string;
  accountId: string;
  setAccountId: (value: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}) {
  return (
    <main className="min-h-screen bg-[#020B0D] text-[#F4F1E8]">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#020B0D]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5">
          <BrandLogo className="text-[18px]" />
          <button onClick={() => void props.signOut()} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[10px] text-[#92A9A3]">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#62BDA1]">PERSONAL</span>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Sua conta PiXBrasil</h1>
            <p className="mt-2 text-[10px] text-[#718A83]">{props.activeAccess ? compactId(props.activeAccess.accountId) : "—"}</p>
          </div>
          <button onClick={() => void props.refresh()} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[10px]">
            <RefreshCw className={props.busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Atualizar
          </button>
        </div>
        {props.error ? <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-[10px] text-red-200">{props.error}</div> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Estado", props.overview?.account.status || "—", ShieldCheck],
            ["KYC", props.overview?.account.kyc_status || "—", KeyRound],
            ["Moeda base", props.overview?.account.base_currency || "—", CircleDollarSign],
            ["Perfil", props.overview?.account.identity_level || "—", Layers3],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-white/8 bg-[#061214] p-4">
              <div className="flex items-center justify-between text-[#647E76]">
                <span className="text-[8px] font-bold uppercase tracking-[.14em]">{String(label)}</span>
                <Icon className="h-4 w-4" />
              </div>
              <strong className="mt-4 block text-[15px]">{String(value)}</strong>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.overview?.wallets.map((wallet) => (
            <div key={wallet.wallet_id} className="rounded-2xl border border-white/8 bg-[#061214] p-5">
              <span className="text-[9px] uppercase tracking-[.13em] text-[#6E8880]">{wallet.asset_name}</span>
              <strong className="mt-4 block text-2xl">{wallet.symbol === "BRL" ? brl(wallet.available) : wallet.available + " " + wallet.symbol}</strong>
              <div className="mt-4 flex gap-4 text-[8px] text-[#607871]">
                <span>Pending {wallet.pending}</span>
                <span>Reserved {wallet.reserved}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Panel(props: {
  id?: string;
  title: string;
  icon: typeof Store;
  action?: string;
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <section id={props.id} className="overflow-hidden rounded-2xl border border-[#DCE6E2] bg-white shadow-[0_7px_24px_rgba(28,63,54,.035)]">
      <div className="flex items-center justify-between border-b border-[#E7EEEB] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#1C5C4C]" />
          <strong className="text-[11px] text-[#13231F]">{props.title}</strong>
        </div>
        {props.action ? <span className="text-[8px] font-semibold text-[#1765D1]">{props.action}</span> : null}
      </div>
      <div className="p-3 sm:p-4">{props.children}</div>
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className={"inline-flex rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(value)}>
      {value}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-[#DCE6E2] px-4 py-8 text-center text-[9px] text-[#81928C]">{label}</div>;
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#667A73]">{props.label}</span>
      {props.children}
    </label>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
