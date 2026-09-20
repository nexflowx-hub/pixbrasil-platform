"use client";

import {
  Activity,
  ArrowRight,
  BanknoteArrowUp,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  ExternalLink,
  GitBranch,
  HelpCircle,
  KeyRound,
  Landmark,
  Layers3,
  LoaderCircle,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type Wallet = {
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
};

type Transaction = {
  id: string;
  type: string;
  status: string;
  amount: string;
  symbol: string;
  provider_reference: string | null;
  created_at: string;
};

type BusinessStore = {
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
  latency_ms: number | null;
};

type BusinessPayment = {
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

type Settlement = {
  id: string;
  payment_intent_id: string;
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

type Gateway = {
  id: string;
  alias: string;
  provider_code: string;
  status: string;
  health: string;
  latency_ms: number | null;
  routing_eligible: boolean;
};

type Payout = {
  id: string;
  external_reference: string | null;
  amount: string;
  destination_type: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
};

type CashflowPoint = {
  day: string;
  incoming: string;
  outgoing: string;
};

type BusinessData = {
  merchant: {
    merchant_id: string;
    trade_name: string | null;
    merchant_status: string;
    tier_code: string;
  };
  summary: {
    available: string;
    pending: string;
    reserved: string;
    blocked: string;
    gross_30d: string;
    net_30d: string;
    succeeded_30d: number;
  };
  stores: BusinessStore[];
  payments: BusinessPayment[];
  settlements: Settlement[];
  gateways: Gateway[];
  payouts: Payout[];
  cashflow: CashflowPoint[];
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
  wallets: Wallet[];
  transactions: Transaction[];
  business: BusinessData | null;
  capabilities: {
    financialWritesEnabled: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    exchangeEnabled: boolean;
    payoutMode?: string | null;
    note: string;
  };
};

type OverviewPayload = {
  success: true;
  data: OverviewData;
};

function brl(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function moneyLike(value: string, symbol: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (["BRL", "USD", "EUR", "GBP"].includes(symbol)) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: symbol,
      maximumFractionDigits: 2,
    }).format(number);
  }
  return (
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(number) +
    " " +
    symbol
  );
}

function shortId(value: string) {
  return value.length > 18 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

function statusTone(status: string) {
  const value = status.toUpperCase();
  if (["ACTIVE", "AVAILABLE", "HEALTHY", "SUCCEEDED", "COMPLETED", "CONFIRMED", "PAID"].includes(value)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["PENDING", "PENDING_PAYMENT", "DRAFT", "PROCESSING", "PROVIDER_PENDING"].includes(value)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (["FAILED", "REJECTED", "CANCELED", "DOWN"].includes(value)) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload["data"] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

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
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!accountId) return;
    void loadOverview(accountId);
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
      <BusinessPortal
        session={session}
        access={activeAccess}
        overview={overview}
        accountId={accountId}
        busy={busy}
        error={error}
        onRefresh={() => void loadOverview(accountId)}
        onAccountChange={(value) => {
          setOverview(null);
          setAccountId(value);
        }}
        onSignOut={signOut}
      />
    );
  }

  return (
    <PersonalPortal
      session={session}
      access={activeAccess}
      overview={overview}
      accountId={accountId}
      busy={busy}
      error={error}
      onRefresh={() => void loadOverview(accountId)}
      onAccountChange={(value) => {
        setOverview(null);
        setAccountId(value);
      }}
      onSignOut={signOut}
    />
  );
}

function BusinessPortal({
  session,
  access,
  overview,
  accountId,
  busy,
  error,
  onRefresh,
  onAccountChange,
  onSignOut,
}: {
  session: SessionPayload["data"] | null;
  access: AccountAccess;
  overview: OverviewData | null;
  accountId: string;
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onAccountChange: (value: string) => void;
  onSignOut: () => void;
}) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutResult, setPayoutResult] = useState<{
    reference: string;
    telegram?: { shareUrl?: string; message?: string };
  } | null>(null);

  const business = overview?.business;
  const summary = business?.summary;
  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return business?.payments.slice(0, 8) ?? [];
    return (
      business?.payments.filter((payment) =>
        [
          payment.external_reference,
          payment.store_code,
          payment.provider_code,
          payment.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      ) ?? []
    ).slice(0, 20);
  }, [business?.payments, search]);

  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const pixKey = String(form.get("pixKey") ?? "").trim();
    if (!amount || amount <= 0 || !pixKey) {
      setPayoutError("Informe um valor e uma chave PIX.");
      return;
    }

    setPayoutBusy(true);
    setPayoutError("");
    setPayoutResult(null);
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(accountId) +
          "/payout-ticket",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            destinationType: "PIX",
            destination: { pixKey },
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: {
          reference?: string;
          telegram?: { shareUrl?: string; message?: string };
        };
      };
      if (!response.ok || !payload.success || !payload.data?.reference) {
        throw new Error(payload.message || "Não foi possível criar o ticket.");
      }
      setPayoutResult({
        reference: payload.data.reference,
        telegram: payload.data.telegram,
      });
      onRefresh();
    } catch (cause) {
      setPayoutError(
        cause instanceof Error ? cause.message : "Falha ao criar payout.",
      );
    } finally {
      setPayoutBusy(false);
    }
  }

  const navigation = [
    ["#overview", "Visão geral", BarChart3],
    ["#wallet", "Wallet BRL", WalletCards],
    ["#stores", "Stores", Store],
    ["#payments", "Pagamentos PIX", CircleDollarSign],
    ["#releases", "Liberações", CalendarDays],
    ["#payouts", "Payouts", BanknoteArrowUp],
    ["#routing", "Routing", GitBranch],
  ] as const;

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-[#10221f]">
      <div className="flex min-h-screen">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-[250px] border-r border-white/8 bg-[#031714] text-white transition-transform lg:translate-x-0",
            mobileMenu ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between px-1 py-2">
              <BrandLogo className="text-[19px]" />
              <button
                className="rounded-lg p-2 text-white/60 lg:hidden"
                onClick={() => setMobileMenu(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <span className="text-[8px] uppercase tracking-[.14em] text-emerald-300/70">
                BUSINESS ACCOUNT
              </span>
              <strong className="mt-1 block truncate text-[12px]">
                {business?.merchant.trade_name ||
                  access.merchant?.trade_name ||
                  "Conta Business"}
              </strong>
              <select
                value={accountId}
                onChange={(event) => onAccountChange(event.target.value)}
                className="mt-2 w-full border-0 bg-transparent text-[9px] text-white/55 outline-none"
              >
                {session?.accounts.map((item) => (
                  <option
                    className="bg-[#031714]"
                    key={item.accountId}
                    value={item.accountId}
                  >
                    {item.accountType === "BUSINESS"
                      ? item.merchant?.trade_name || "Business"
                      : "Personal"}{" "}
                    · {item.role}
                  </option>
                ))}
              </select>
            </div>

            <nav className="mt-5 space-y-1">
              {navigation.map(([href, label, Icon], index) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenu(false)}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] transition",
                    index === 0
                      ? "bg-emerald-400/12 text-emerald-300"
                      : "text-white/65 hover:bg-white/[.05] hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </nav>

            <div className="mt-5 border-t border-white/8 pt-4">
              <Link
                href="/docs"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] text-white/65 hover:bg-white/[.05] hover:text-white"
              >
                <Code2 className="h-4 w-4" />
                Desenvolvedores
              </Link>
              <a
                href="#settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] text-white/65 hover:bg-white/[.05] hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
                Definições
              </a>
            </div>

            <div className="mt-auto rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] p-4">
              <strong className="text-[11px]">PIX operacional para o seu negócio.</strong>
              <p className="mt-2 text-[9px] leading-5 text-white/45">
                Stores, routing, liberações e payouts numa única camada financeira.
              </p>
              <div className="mt-4 h-1 w-10 rounded-full bg-emerald-400" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 lg:pl-[250px]">
          <header className="sticky top-0 z-30 border-b border-[#dfe7e4] bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
              <button
                onClick={() => setMobileMenu(true)}
                className="rounded-xl border border-[#dfe7e4] p-2 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="relative max-w-2xl flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#778d87]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar transações, stores, referências…"
                  className="h-10 w-full rounded-xl border border-[#dde6e3] bg-[#f9fbfa] pl-10 pr-4 text-[11px] outline-none transition focus:border-emerald-400"
                />
              </div>
              <Link
                href="/docs"
                className="hidden items-center gap-2 text-[10px] text-[#526a64] sm:flex"
              >
                <HelpCircle className="h-4 w-4" />
                Ajuda
              </Link>
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 rounded-xl border border-[#dde6e3] px-3 py-2 text-[9px] text-[#526a64]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 xl:px-8 xl:py-8">
            <section id="overview" className="scroll-mt-24">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[.15em] text-emerald-700">
                    PIXBRASIL BUSINESS
                  </span>
                  <h1 className="mt-1 text-3xl font-bold tracking-[-.045em] sm:text-4xl">
                    Visão geral financeira
                  </h1>
                  <p className="mt-2 text-[11px] text-[#667d77]">
                    Recursos disponíveis, recebíveis por Store e operação PIX.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-2 text-[9px] text-[#728881] sm:flex">
                    <CalendarDays className="h-4 w-4" />
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date())}
                  </span>
                  <button
                    onClick={onRefresh}
                    disabled={busy}
                    className="flex h-9 items-center gap-2 rounded-xl border border-[#dbe5e2] bg-white px-3 text-[9px] font-semibold"
                  >
                    {busy ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Atualizar
                  </button>
                </div>
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-[10px] text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 xl:grid-cols-[1.7fr_.72fr_.72fr]">
                <article
                  id="wallet"
                  className="scroll-mt-24 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#062b24,#073d32)] p-5 text-white shadow-[0_18px_50px_rgba(5,46,38,.14)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-emerald-200/80">
                        <WalletCards className="h-4 w-4" />
                        WALLET BRL EMPRESARIAL
                      </span>
                      <p className="mt-2 text-[9px] text-white/55">
                        Disponível para payout
                      </p>
                      <strong className="mt-2 block text-4xl font-bold tracking-[-.045em] sm:text-5xl">
                        {brl(summary?.available)}
                      </strong>
                    </div>
                    <div className="hidden rounded-2xl border border-white/10 bg-white/[.04] p-3 text-right sm:block">
                      <span className="block text-[8px] uppercase tracking-[.12em] text-white/45">
                        30 dias
                      </span>
                      <strong className="mt-1 block text-[12px]">
                        {brl(summary?.net_30d)}
                      </strong>
                      <span className="mt-1 block text-[8px] text-emerald-200/60">
                        líquido recebido
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                      href="/docs/api"
                      className="flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-[10px] font-extrabold text-[#042219] transition hover:bg-emerald-300"
                    >
                      <Code2 className="h-4 w-4" />
                      Receber via API
                    </Link>
                    <button
                      onClick={() => setPayoutOpen(true)}
                      className="flex h-10 items-center gap-2 rounded-xl border border-white/20 px-4 text-[10px] font-bold text-white transition hover:bg-white/[.06]"
                    >
                      <BanknoteArrowUp className="h-4 w-4" />
                      Solicitar payout
                    </button>
                  </div>
                </article>

                <MetricCard
                  title="A liberar"
                  value={brl(summary?.pending)}
                  detail="Recebíveis em processo de liberação."
                  icon={CalendarDays}
                  tone="amber"
                />
                <MetricCard
                  title="Reservado"
                  value={brl(
                    Number(summary?.reserved ?? 0) + Number(summary?.blocked ?? 0),
                  )}
                  detail="Valores reservados ou bloqueados."
                  icon={ShieldCheck}
                  tone="blue"
                />
              </div>
            </section>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <section
                id="releases"
                className="scroll-mt-24 overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white"
              >
                <SectionHeader
                  title="Liberações por Store"
                  subtitle="Settlements mais recentes e disponibilidade."
                  icon={Store}
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="border-b border-[#edf1f0] bg-[#fbfcfc] text-[8px] uppercase tracking-[.08em] text-[#7a8f89]">
                      <tr>
                        <th className="px-5 py-3">Store</th>
                        <th className="px-4 py-3">Bruto</th>
                        <th className="px-4 py-3">Líquido</th>
                        <th className="px-4 py-3">Disponível em</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1f0]">
                      {(business?.settlements ?? []).slice(0, 7).map((row) => (
                        <tr key={row.id} className="text-[9px]">
                          <td className="px-5 py-3">
                            <strong>{row.store_code || "—"}</strong>
                            <span className="mt-0.5 block text-[8px] text-[#81958f]">
                              {row.external_reference || shortId(row.payment_intent_id)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{brl(row.gross_brl)}</td>
                          <td className="px-4 py-3 font-semibold">{brl(row.net_brl)}</td>
                          <td className="px-4 py-3 text-[#637a73]">
                            {row.available_at
                              ? new Date(row.available_at).toLocaleString("pt-BR")
                              : "Aguardando provider"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!business?.settlements.length ? (
                    <EmptyLight label="As liberações aparecerão após os primeiros PIX confirmados." />
                  ) : null}
                </div>
              </section>

              <section
                id="routing"
                className="scroll-mt-24 overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white"
              >
                <SectionHeader
                  title="Gateway PIX"
                  subtitle="Providers e routing em produção."
                  icon={GitBranch}
                />
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {(business?.gateways ?? []).map((gateway) => (
                    <div
                      key={gateway.id}
                      className="rounded-2xl border border-[#e3eae8] bg-[#fbfdfc] p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-[11px]">{gateway.provider_code}</strong>
                          <span className="mt-1 block text-[8px] text-[#81958f]">
                            {gateway.alias}
                          </span>
                        </div>
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            gateway.health === "HEALTHY"
                              ? "bg-emerald-400"
                              : gateway.health === "DOWN"
                                ? "bg-red-400"
                                : "bg-amber-400",
                          ].join(" ")}
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[8px]">
                        <span className="text-[#788d87]">Health</span>
                        <strong>{gateway.health}</strong>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[8px]">
                        <span className="text-[#788d87]">Latência</span>
                        <strong>
                          {gateway.latency_ms != null
                            ? gateway.latency_ms + " ms"
                            : "—"}
                        </strong>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[8px]">
                        <span className="text-[#788d87]">Routing</span>
                        <strong>
                          {gateway.routing_eligible ? "Elegível" : "Inativo"}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
                {!business?.gateways.length ? (
                  <EmptyLight label="Nenhum gateway ligado a esta conta." />
                ) : null}
              </section>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <section
                id="payments"
                className="scroll-mt-24 overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white"
              >
                <SectionHeader
                  title="Movimentações recentes"
                  subtitle="Cobranças PIX e estado operacional."
                  icon={Activity}
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left">
                    <thead className="border-b border-[#edf1f0] bg-[#fbfcfc] text-[8px] uppercase tracking-[.08em] text-[#7a8f89]">
                      <tr>
                        <th className="px-5 py-3">Referência</th>
                        <th className="px-4 py-3">Store</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1f0]">
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} className="text-[9px]">
                          <td className="px-5 py-3">
                            <strong>{payment.external_reference || shortId(payment.id)}</strong>
                            <span className="mt-0.5 block text-[8px] text-[#81958f]">
                              {new Date(payment.created_at).toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="px-4 py-3">{payment.store_code || "—"}</td>
                          <td className="px-4 py-3">{payment.provider_code || "—"}</td>
                          <td className="px-4 py-3">
                            <StatusPill status={payment.status} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {brl(payment.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredPayments.length ? (
                    <EmptyLight label="Nenhuma movimentação encontrada." />
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white">
                <SectionHeader
                  title="Fluxo de caixa · 30 dias"
                  subtitle="Entradas líquidas e payouts confirmados."
                  icon={BarChart3}
                />
                <CashflowChart rows={business?.cashflow ?? []} />
              </section>
            </div>

            <section
              id="stores"
              className="mt-4 scroll-mt-24 overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white"
            >
              <SectionHeader
                title="Stores"
                subtitle="Configuração operacional e classe de liberação."
                icon={Store}
              />
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {(business?.stores ?? []).map((storeRow) => (
                  <article
                    key={storeRow.id}
                    className="rounded-2xl border border-[#e2e9e7] p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <strong className="text-[11px]">{storeRow.name}</strong>
                        <span className="mt-1 block text-[8px] uppercase tracking-[.1em] text-[#82958f]">
                          {storeRow.code} · {storeRow.currency}
                        </span>
                      </div>
                      <StatusPill status={storeRow.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SmallFact label="Provider" value={storeRow.provider_code || "—"} />
                      <SmallFact label="Gateway" value={storeRow.gateway_alias || "—"} />
                      <SmallFact label="Release" value={storeRow.release_class || "—"} />
                      <SmallFact label="Routing" value={storeRow.routing_mode || "—"} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              id="payouts"
              className="mt-4 scroll-mt-24 overflow-hidden rounded-[20px] border border-[#dde6e3] bg-white"
            >
              <SectionHeader
                title="Payouts"
                subtitle="Nesta fase, cada payout gera um ticket para processamento manual via Telegram."
                icon={BanknoteArrowUp}
                action={
                  <button
                    onClick={() => setPayoutOpen(true)}
                    className="rounded-xl bg-[#083c31] px-3 py-2 text-[9px] font-bold text-white"
                  >
                    Novo payout
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="border-b border-[#edf1f0] bg-[#fbfcfc] text-[8px] uppercase tracking-[.08em] text-[#7a8f89]">
                    <tr>
                      <th className="px-5 py-3">Referência</th>
                      <th className="px-4 py-3">Destino</th>
                      <th className="px-4 py-3">Criado</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f0]">
                    {(business?.payouts ?? []).map((row) => (
                      <tr key={row.id} className="text-[9px]">
                        <td className="px-5 py-3 font-semibold">
                          {row.external_reference || shortId(row.id)}
                        </td>
                        <td className="px-4 py-3">{row.destination_type || "—"}</td>
                        <td className="px-4 py-3 text-[#6f837d]">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {brl(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!business?.payouts.length ? (
                  <EmptyLight label="Ainda não existem pedidos de payout." />
                ) : null}
              </div>
            </section>

            <section
              id="settings"
              className="mt-4 grid scroll-mt-24 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <InfoTile label="Conta" value={overview?.account.status || "—"} icon={Building2} />
              <InfoTile label="KYC" value={overview?.account.kyc_status || "—"} icon={KeyRound} />
              <InfoTile label="Perfil" value={overview?.account.identity_level || "—"} icon={Layers3} />
              <InfoTile label="Acesso" value={access.role} icon={ShieldCheck} />
            </section>
          </div>
        </div>
      </div>

      {payoutOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.14em] text-emerald-700">
                  PAYOUT MANUAL
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-[-.035em]">
                  Solicitar payout
                </h2>
                <p className="mt-2 text-[9px] leading-5 text-[#6e817c]">
                  O pedido gera um ticket operacional. A confirmação e execução são tratadas manualmente nesta fase.
                </p>
              </div>
              <button
                onClick={() => setPayoutOpen(false)}
                className="rounded-xl border border-[#e0e7e5] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {payoutResult ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <strong className="mt-3 block text-[11px] text-emerald-800">
                  Ticket {payoutResult.reference} criado
                </strong>
                <p className="mt-1 text-[9px] leading-5 text-emerald-700/80">
                  Envie o ticket à operação pelo Telegram para processamento.
                </p>
                {payoutResult.telegram?.shareUrl ? (
                  <a
                    href={payoutResult.telegram.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#083c31] px-4 py-2.5 text-[9px] font-bold text-white"
                  >
                    Abrir Telegram
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : (
              <form onSubmit={requestPayout} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold text-[#536a64]">
                    Valor em BRL
                  </span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(summary?.available ?? 0)}
                    className="h-11 w-full rounded-xl border border-[#dce5e2] px-3 text-[11px] outline-none focus:border-emerald-400"
                    placeholder="0,00"
                    required
                  />
                  <span className="mt-1 block text-[8px] text-[#81958f]">
                    Disponível: {brl(summary?.available)}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold text-[#536a64]">
                    Chave PIX de destino
                  </span>
                  <input
                    name="pixKey"
                    className="h-11 w-full rounded-xl border border-[#dce5e2] px-3 text-[11px] outline-none focus:border-emerald-400"
                    placeholder="CPF, CNPJ, email, telefone ou EVP"
                    required
                  />
                </label>

                {payoutError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] text-red-700">
                    {payoutError}
                  </div>
                ) : null}

                <button
                  disabled={payoutBusy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#083c31] text-[10px] font-extrabold text-white disabled:opacity-50"
                >
                  {payoutBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <BanknoteArrowUp className="h-4 w-4" />
                  )}
                  Criar ticket de payout
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PersonalPortal({
  session,
  access,
  overview,
  accountId,
  busy,
  error,
  onRefresh,
  onAccountChange,
  onSignOut,
}: {
  session: SessionPayload["data"] | null;
  access?: AccountAccess;
  overview: OverviewData | null;
  accountId: string;
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onAccountChange: (value: string) => void;
  onSignOut: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#020B0D] text-[#F4F1E8]">
      <header className="border-b border-white/8 bg-[#020B0D]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-7">
          <BrandLogo className="text-[18px]" />
          <div className="flex items-center gap-2">
            <select
              value={accountId}
              onChange={(event) => onAccountChange(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#061214] px-3 py-2 text-[9px]"
            >
              {session?.accounts.map((item) => (
                <option key={item.accountId} value={item.accountId}>
                  {item.accountType === "BUSINESS"
                    ? item.merchant?.trade_name || "Business"
                    : "Personal"}{" "}
                  · {item.role}
                </option>
              ))}
            </select>
            <button
              onClick={onSignOut}
              className="rounded-xl border border-white/10 p-2 text-white/65"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-300">
              PIXBRASIL PERSONAL
            </span>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em]">
              Sua conta
            </h1>
            <p className="mt-2 text-[10px] text-[#718A83]">
              {shortId(accountId)} · {access?.role || "—"}
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[9px]"
          >
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-[10px] text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DarkMetric label="Estado" value={overview?.account.status || "…"} icon={ShieldCheck} />
          <DarkMetric label="KYC" value={overview?.account.kyc_status || "…"} icon={KeyRound} />
          <DarkMetric label="Base" value={overview?.account.base_currency || "…"} icon={CircleDollarSign} />
          <DarkMetric label="Perfil" value={overview?.account.identity_level || "…"} icon={Layers3} />
        </div>

        <section className="mt-5 overflow-hidden rounded-[22px] border border-white/8 bg-[#061214]">
          <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
            <div>
              <strong className="block text-[12px]">Wallets</strong>
              <span className="mt-1 block text-[8px] text-[#607871]">
                Saldos por ativo e rede
              </span>
            </div>
            <WalletCards className="h-4 w-4 text-[#6A867E]" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {overview?.wallets.map((wallet) => (
              <div
                key={wallet.wallet_id}
                className="rounded-2xl border border-white/7 bg-[#030D0F] p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <strong className="text-[12px]">{wallet.symbol}</strong>
                    <span className="mt-1 block text-[8px] text-[#607871]">
                      {wallet.network}
                    </span>
                  </div>
                  <span className="text-[8px] text-emerald-300">
                    {wallet.wallet_status}
                  </span>
                </div>
                <strong className="mt-5 block text-[18px]">
                  {moneyLike(wallet.available, wallet.symbol)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof CalendarDays;
  tone: "amber" | "blue";
}) {
  return (
    <article className="rounded-[20px] border border-[#dce5e2] bg-white p-5">
      <div
        className={[
          "flex h-10 w-10 items-center justify-center rounded-xl",
          tone === "amber"
            ? "bg-amber-100 text-amber-700"
            : "bg-sky-100 text-sky-700",
        ].join(" ")}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <span className="mt-4 block text-[10px] font-bold">{title}</span>
      <strong className="mt-2 block text-2xl font-bold tracking-[-.035em]">
        {value}
      </strong>
      <p className="mt-3 text-[9px] leading-5 text-[#718680]">{detail}</p>
    </article>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle: string;
  icon: typeof Store;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#e7eeec] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5f2] text-[#0c6753]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <strong className="block text-[11px]">{title}</strong>
          <span className="mt-0.5 block text-[8px] text-[#7b8f89]">
            {subtitle}
          </span>
        </div>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-1 text-[7px] font-bold",
        statusTone(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f9f8] p-3">
      <span className="block text-[7px] uppercase tracking-[.1em] text-[#81958f]">
        {label}
      </span>
      <strong className="mt-1 block truncate text-[9px]">{value}</strong>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-2xl border border-[#dde6e3] bg-white p-4">
      <div className="flex items-center justify-between text-[#748a84]">
        <span className="text-[8px] font-bold uppercase tracking-[.1em]">
          {label}
        </span>
        <Icon className="h-4 w-4" />
      </div>
      <strong className="mt-3 block text-[12px]">{value}</strong>
    </div>
  );
}

function DarkMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#061214] p-4">
      <div className="flex items-center justify-between text-[#647E76]">
        <span className="text-[8px] font-bold uppercase tracking-[.14em]">
          {label}
        </span>
        <Icon className="h-4 w-4" />
      </div>
      <strong className="mt-4 block text-[15px]">{value}</strong>
    </div>
  );
}

function CashflowChart({ rows }: { rows: CashflowPoint[] }) {
  const recent = rows.slice(-14);
  const max = Math.max(
    1,
    ...recent.flatMap((row) => [Number(row.incoming), Number(row.outgoing)]),
  );
  const totalIn = recent.reduce((sum, row) => sum + Number(row.incoming), 0);
  const totalOut = recent.reduce((sum, row) => sum + Number(row.outgoing), 0);

  return (
    <div className="p-5">
      <div className="flex gap-5 text-[8px]">
        <span className="flex items-center gap-1.5 text-[#607770]">
          <i className="h-2 w-2 rounded-full bg-emerald-500" />
          Entradas {brl(totalIn)}
        </span>
        <span className="flex items-center gap-1.5 text-[#607770]">
          <i className="h-2 w-2 rounded-full bg-sky-400" />
          Saídas {brl(totalOut)}
        </span>
      </div>
      <div className="mt-5 flex h-36 items-end gap-1.5">
        {recent.map((row) => (
          <div key={row.day} className="flex h-full flex-1 items-end gap-[2px]">
            <div
              title={row.day + " · entradas " + brl(row.incoming)}
              className="w-1/2 rounded-t bg-emerald-500/80"
              style={{
                height:
                  Math.max(3, (Number(row.incoming) / max) * 100) + "%",
              }}
            />
            <div
              title={row.day + " · saídas " + brl(row.outgoing)}
              className="w-1/2 rounded-t bg-sky-400/75"
              style={{
                height:
                  Math.max(3, (Number(row.outgoing) / max) * 100) + "%",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[7px] text-[#8da09a]">
        <span>{recent[0]?.day ?? "—"}</span>
        <span>{recent.at(-1)?.day ?? "—"}</span>
      </div>
    </div>
  );
}

function EmptyLight({ label }: { label: string }) {
  return (
    <div className="px-5 py-8 text-center text-[9px] text-[#81958f]">
      {label}
    </div>
  );
}
