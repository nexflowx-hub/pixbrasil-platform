"use client";

import {
  Activity,
  BanknoteArrowDown,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  Code2,
  CreditCard,
  GitBranch,
  HelpCircle,
  KeyRound,
  Landmark,
  LogOut,
  Menu,
  RefreshCw,
  Route,
  Search,
  Settings2,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

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

type BusinessData = {
  merchant: {
    merchant_id: string;
    trade_name: string | null;
    merchant_status: string;
    tier_code: string;
  };
  stores: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  settlements?: Array<Record<string, unknown>>;
  gateways?: Array<Record<string, unknown>>;
  cashFlow?: Array<Record<string, unknown>>;
  payouts?: Array<Record<string, unknown>>;
};

export type BusinessDashboardOverview = {
  accessRole: string;
  account: {
    id: string;
    type: string;
    status: string;
    kyc_status: string;
    identity_level: string;
    base_currency: string;
  };
  wallets: Wallet[];
  transactions: Array<Record<string, unknown>>;
  business: BusinessData | null;
  capabilities: {
    financialWritesEnabled: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled: boolean;
    exchangeEnabled: boolean;
    payoutMode?: string;
    note?: string;
  };
};

type Section =
  | "overview"
  | "wallet"
  | "stores"
  | "payments"
  | "transactions"
  | "releases"
  | "payouts"
  | "developers"
  | "settings";

const nav: Array<{ id: Section; label: string; icon: typeof WalletCards }> = [
  { id: "overview", label: "Visão geral", icon: BarChart3 },
  { id: "wallet", label: "Wallet BRL", icon: WalletCards },
  { id: "stores", label: "Stores", icon: Store },
  { id: "payments", label: "Pagamentos PIX", icon: CreditCard },
  { id: "transactions", label: "Transações", icon: Activity },
  { id: "releases", label: "Liberações", icon: CalendarDays },
  { id: "payouts", label: "Payouts", icon: BanknoteArrowDown },
  { id: "developers", label: "Desenvolvedores", icon: Code2 },
  { id: "settings", label: "Definições", icon: Settings2 },
];

function money(value: unknown) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function text(value: unknown, fallback = "—") {
  const parsed = String(value ?? "").trim();
  return parsed || fallback;
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(value: unknown) {
  const s = String(value ?? "").toUpperCase();
  if (["ACTIVE", "AVAILABLE", "SUCCEEDED", "COMPLETED", "HEALTHY", "CONFIRMED", "PAID"].includes(s)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["FAILED", "REJECTED", "CANCELED", "REVERSED", "DOWN"].includes(s)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function BusinessDashboard({
  email,
  accountId,
  role,
  merchantName,
  overview,
  busy,
  error,
  onRefresh,
  onSignOut,
}: {
  email: string;
  accountId: string;
  role: string;
  merchantName: string;
  overview: BusinessDashboardOverview | null;
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");

  const business = overview?.business;
  const brlWallet = overview?.wallets.find((wallet) => wallet.asset_code === "BRL");
  const available = Number(brlWallet?.available ?? 0);
  const pending = Number(brlWallet?.pending ?? 0);
  const reserved = Number(brlWallet?.reserved ?? 0);
  const stores = business?.stores ?? [];
  const settlements = business?.settlements ?? [];
  const gateways = business?.gateways ?? [];
  const payments = business?.payments ?? [];
  const payouts = business?.payouts ?? [];
  const cashFlow = business?.cashFlow ?? [];

  const searchTerm = query.trim().toLowerCase();
  const filteredPayments = (
    searchTerm
      ? payments.filter((row) =>
          [
            row.external_reference,
            row.store_code,
            row.status,
            row.amount,
          ].some((value) =>
            String(value ?? "").toLowerCase().includes(searchTerm),
          ),
        )
      : payments
  ).slice(0, searchTerm ? 20 : 8);

  async function submitPayout(event: FormEvent) {
    event.preventDefault();
    setPayoutBusy(true);
    setPayoutError("");
    setPayoutMessage("");
    try {
      const response = await fetch(
        "/api/client/accounts/" + encodeURIComponent(accountId) + "/payouts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(payoutAmount),
            pixKeyType,
            pixKey,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: { payoutId?: string };
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Não foi possível solicitar o payout.");
      }
      setPayoutMessage(
        "Payout criado com sucesso. Ticket " +
          String(payload.data?.payoutId ?? "") +
          " enviado para a fila manual.",
      );
      setPayoutAmount("");
      setPixKey("");
      onRefresh();
    } catch (cause) {
      setPayoutError(
        cause instanceof Error ? cause.message : "Falha ao solicitar payout.",
      );
    } finally {
      setPayoutBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#10211d]">
      <div className="flex min-h-screen">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-[254px] border-r border-white/8 bg-[linear-gradient(180deg,#021914,#03110f)] text-white transition-transform lg:static lg:translate-x-0",
            mobileNav ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between px-2 py-3">
              <BrandLogo className="text-[20px]" />
              <button className="lg:hidden" onClick={() => setMobileNav(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-white/12 bg-white/[.035] p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-[12px]">{merchantName}</strong>
                  <span className="mt-1 block text-[8px] uppercase tracking-[.12em] text-white/45">
                    Business · {role}
                  </span>
                </div>
              </div>
            </div>

            <nav className="mt-5 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSection(item.id);
                      setMobileNav(false);
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold transition",
                      active
                        ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-300/12"
                        : "text-white/68 hover:bg-white/[.045] hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-emerald-300/10 bg-emerald-300/[.045] p-4">
              <span className="text-[9px] font-bold uppercase tracking-[.13em] text-emerald-200">
                PiXBrasil Business
              </span>
              <p className="mt-2 text-[9px] leading-5 text-white/48">
                PIX multi-provider, routing por Store, ledger e payout operacional.
              </p>
              <div className="mt-4 h-0.5 w-8 rounded-full bg-emerald-300" />
            </div>
          </div>
        </aside>

        {mobileNav ? (
          <button
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Fechar menu"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[#dfe8e5] bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe8e5] lg:hidden"
                onClick={() => setMobileNav(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="relative max-w-[720px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d918b]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar pagamentos, Stores, referências…"
                  className="h-10 w-full rounded-xl border border-[#dce6e3] bg-[#f9fbfa] pl-10 pr-4 text-[11px] outline-none transition focus:border-emerald-300"
                />
              </div>
              <div className="ml-auto hidden items-center gap-4 md:flex">
                <Link href="/docs" className="flex items-center gap-2 text-[10px] font-semibold text-[#526861]">
                  <HelpCircle className="h-4 w-4" /> Ajuda
                </Link>
                <Bell className="h-4 w-4 text-[#526861]" />
                <div className="h-8 w-px bg-[#e1e8e6]" />
                <div className="text-right">
                  <strong className="block max-w-[180px] truncate text-[10px]">{email}</strong>
                  <span className="text-[8px] text-[#7d918b]">{merchantName}</span>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex h-9 items-center gap-2 rounded-xl border border-[#dce6e3] px-3 text-[9px] font-semibold text-[#526861]"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sair
                </button>
              </div>
            </div>
          </header>

          <section className="px-4 py-6 sm:px-6 xl:px-8 xl:py-7">
            <div className="mx-auto max-w-[1500px]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[.13em] text-emerald-700">
                    PiXBrasil Business · Produção
                  </span>
                  <h1 className="mt-1.5 text-3xl font-semibold tracking-[-.045em] text-[#0b1714]">
                    {nav.find((item) => item.id === section)?.label ?? "Visão geral"}
                  </h1>
                  <p className="mt-1 text-[11px] text-[#71857f]">
                    {section === "overview"
                      ? "Recursos disponíveis, recebíveis por Store e operação PIX."
                      : "Dados reais do Financial Core PiXBrasil."}
                  </p>
                </div>
                <button
                  onClick={onRefresh}
                  disabled={busy}
                  className="flex h-9 items-center gap-2 self-start rounded-xl border border-[#dce6e3] bg-white px-3 text-[9px] font-semibold text-[#536a63] shadow-sm sm:self-auto"
                >
                  <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  Atualizar
                </button>
              </div>

              {error ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] text-rose-700">
                  {error}
                </div>
              ) : null}

              {section === "overview" ? (
                <Overview
                  available={available}
                  pending={pending}
                  reserved={reserved}
                  stores={stores}
                  settlements={settlements}
                  gateways={gateways}
                  payments={filteredPayments}
                  cashFlow={cashFlow}
                  onPayout={() => {
                    setSection("payouts");
                    setPayoutOpen(true);
                  }}
                />
              ) : null}

              {section === "wallet" ? (
                <WalletView
                  available={available}
                  pending={pending}
                  reserved={reserved}
                  blocked={Number(brlWallet?.blocked ?? 0)}
                  payouts={payouts}
                  onPayout={() => {
                    setSection("payouts");
                    setPayoutOpen(true);
                  }}
                />
              ) : null}

              {section === "stores" ? <StoresView stores={stores} settlements={settlements} /> : null}
              {section === "payments" ? <PaymentsView rows={filteredPayments.length ? filteredPayments : payments} /> : null}
              {section === "transactions" ? <TransactionsView rows={overview?.transactions ?? []} /> : null}
              {section === "releases" ? <ReleasesView rows={settlements} /> : null}
              {section === "developers" ? <DevelopersView /> : null}
              {section === "settings" ? (
                <SettingsView
                  accountId={accountId}
                  accountStatus={overview?.account.status ?? "—"}
                  kyc={overview?.account.kyc_status ?? "—"}
                  role={role}
                />
              ) : null}

              {section === "payouts" ? (
                <PayoutsView
                  available={available}
                  rows={payouts}
                  open={payoutOpen}
                  setOpen={setPayoutOpen}
                  busy={payoutBusy}
                  message={payoutMessage}
                  error={payoutError}
                  amount={payoutAmount}
                  setAmount={setPayoutAmount}
                  pixKeyType={pixKeyType}
                  setPixKeyType={setPixKeyType}
                  pixKey={pixKey}
                  setPixKey={setPixKey}
                  onSubmit={submitPayout}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Overview({
  available,
  pending,
  reserved,
  stores,
  settlements,
  gateways,
  payments,
  cashFlow,
  onPayout,
}: {
  available: number;
  pending: number;
  reserved: number;
  stores: Array<Record<string, unknown>>;
  settlements: Array<Record<string, unknown>>;
  gateways: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  cashFlow: Array<Record<string, unknown>>;
  onPayout: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_.62fr_.62fr]">
        <article className="overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#052c24,#061b17)] p-5 text-white shadow-[0_18px_45px_rgba(7,50,41,.12)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-200">
                <WalletCards className="h-4 w-4" />
                <span className="text-[9px] font-bold uppercase tracking-[.13em]">
                  Wallet BRL Empresarial
                </span>
              </div>
              <span className="mt-2 block text-[9px] text-white/55">Disponível para payout</span>
              <strong className="mt-1 block text-4xl font-semibold tracking-[-.045em]">
                {money(available)}
              </strong>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/docs/api"
                  className="flex h-9 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-[9px] font-bold text-[#052018]"
                >
                  <Code2 className="h-3.5 w-3.5" /> Integrar PIX
                </Link>
                <button
                  onClick={onPayout}
                  className="flex h-9 items-center gap-2 rounded-xl border border-white/20 px-4 text-[9px] font-bold text-white"
                >
                  <BanknoteArrowDown className="h-3.5 w-3.5" /> Solicitar payout
                </button>
              </div>
            </div>
            <div className="max-w-[250px] rounded-2xl border border-white/10 bg-white/[.045] p-4 text-[9px] leading-5 text-white/60">
              <Landmark className="mb-2 h-5 w-5 text-emerald-200" />
              Recebimentos PIX confirmados entram no ledger e seguem a política de liberação da Store.
            </div>
          </div>
        </article>

        <MetricCard label="A liberar" value={money(pending)} icon={Clock3} detail="Recebíveis em processo de liberação." tone="amber" />
        <MetricCard label="Reservado" value={money(reserved)} icon={KeyRound} detail="Payouts pendentes e reservas operacionais." tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <Panel title="Liberações por Store" subtitle="Saldo e calendário de liberação" icon={Store}>
          <ReleaseTable rows={settlements} />
        </Panel>
        <Panel title="Gateway PIX" subtitle="Providers e roteamento em produção" icon={Route}>
          <GatewayGrid rows={gateways} stores={stores} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <Panel title="Movimentações recentes" subtitle="Últimos PaymentIntents" icon={Activity}>
          <PaymentsTable rows={payments.slice(0, 7)} compact />
        </Panel>
        <Panel title="Fluxo de caixa · 30 dias" subtitle="Entradas líquidas e saídas" icon={BarChart3}>
          <CashFlowChart rows={cashFlow} />
        </Panel>
      </div>
    </div>
  );
}

function WalletView({
  available,
  pending,
  reserved,
  blocked,
  payouts,
  onPayout,
}: {
  available: number;
  pending: number;
  reserved: number;
  blocked: number;
  payouts: Array<Record<string, unknown>>;
  onPayout: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Disponível" value={money(available)} icon={WalletCards} detail="Pronto para payout." tone="green" />
        <MetricCard label="A liberar" value={money(pending)} icon={Clock3} detail="Em janela de liberação." tone="amber" />
        <MetricCard label="Reservado" value={money(reserved)} icon={KeyRound} detail="Tickets/payouts abertos." tone="blue" />
        <MetricCard label="Bloqueado" value={money(blocked)} icon={Landmark} detail="Restrições e reversões." tone="rose" />
      </div>
      <div className="flex justify-end">
        <button onClick={onPayout} className="rounded-xl bg-[#073a30] px-4 py-2.5 text-[10px] font-bold text-white">
          Solicitar payout
        </button>
      </div>
      <Panel title="Payouts recentes" subtitle="Fila operacional" icon={BanknoteArrowDown}>
        <PayoutTable rows={payouts} />
      </Panel>
    </div>
  );
}

function StoresView({ stores, settlements }: { stores: Array<Record<string, unknown>>; settlements: Array<Record<string, unknown>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stores.map((store, index) => {
        const release = settlements.find((row) => String(row.store_code) === String(store.code));
        return (
          <article key={String(store.id ?? index)} className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.13em] text-emerald-700">{text(store.code)}</span>
                <h2 className="mt-1 text-[15px] font-semibold">{text(store.name, text(store.code))}</h2>
              </div>
              <span className={"rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(store.status)}>
                {text(store.status)}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Fact label="Provider" value={text(store.provider_code)} />
              <Fact label="Gateway" value={text(store.gateway_alias)} />
              <Fact label="Release" value={text(store.release_profile)} />
              <Fact label="Classe" value={text(store.release_class)} />
              <Fact label="Disponível" value={money(release?.available_brl)} />
              <Fact label="A liberar" value={money(release?.pending_brl)} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PaymentsView({ rows }: { rows: Array<Record<string, unknown>> }) {
  return <Panel title="Pagamentos PIX" subtitle="PaymentIntents do merchant" icon={CreditCard}><PaymentsTable rows={rows} /></Panel>;
}

function TransactionsView({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <Panel title="Transações" subtitle="Movimentos consolidados do Financial Core" icon={Activity}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[9px]">
          <thead><tr className="border-b border-[#e5ecea] text-[#758a84]"><th className="p-3">Data</th><th className="p-3">Tipo</th><th className="p-3">Estado</th><th className="p-3">Valor</th><th className="p-3">Provider ref.</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-b border-[#edf2f0]">
                <td className="p-3">{date(row.created_at)}</td>
                <td className="p-3 font-semibold">{text(row.type)}</td>
                <td className="p-3"><span className={"rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(row.status)}>{text(row.status)}</span></td>
                <td className="p-3 font-semibold">{money(row.amount)}</td>
                <td className="p-3 text-[#6e827c]">{text(row.provider_reference)}</td>
              </tr>
            )) : <EmptyRow colSpan={5} label="Ainda não há transações." />}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ReleasesView({ rows }: { rows: Array<Record<string, unknown>> }) {
  return <Panel title="Liberações" subtitle="Disponibilidade financeira por Store" icon={CalendarDays}><ReleaseTable rows={rows} /></Panel>;
}

function PayoutsView(props: {
  available: number;
  rows: Array<Record<string, unknown>>;
  open: boolean;
  setOpen: (value: boolean) => void;
  busy: boolean;
  message: string;
  error: string;
  amount: string;
  setAmount: (value: string) => void;
  pixKeyType: string;
  setPixKeyType: (value: string) => void;
  pixKey: string;
  setPixKey: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <article className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-sm">
        <span className="text-[8px] font-bold uppercase tracking-[.13em] text-emerald-700">Saldo disponível</span>
        <strong className="mt-2 block text-3xl tracking-[-.045em]">{money(props.available)}</strong>
        <p className="mt-2 text-[9px] leading-5 text-[#71857f]">Nesta fase, payouts são processados por ticket manual da operação e ficam reservados imediatamente.</p>
        <button onClick={() => props.setOpen(true)} className="mt-5 w-full rounded-xl bg-[#073a30] px-4 py-3 text-[10px] font-bold text-white">
          Novo payout
        </button>

        {props.open ? (
          <form onSubmit={props.onSubmit} className="mt-5 space-y-3 border-t border-[#e6ecea] pt-5">
            <label className="block text-[9px] font-semibold text-[#546a63]">
              Valor
              <input value={props.amount} onChange={(e) => props.setAmount(e.target.value)} type="number" min="0.01" step="0.01" required className="mt-1 h-10 w-full rounded-xl border border-[#dce6e3] px-3 outline-none focus:border-emerald-300" />
            </label>
            <label className="block text-[9px] font-semibold text-[#546a63]">
              Tipo da chave
              <select value={props.pixKeyType} onChange={(e) => props.setPixKeyType(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dce6e3] bg-white px-3">
                <option>CPF</option><option>CNPJ</option><option>EMAIL</option><option>TELEFONE</option><option>CHAVE_ALEATORIA</option>
              </select>
            </label>
            <label className="block text-[9px] font-semibold text-[#546a63]">
              Chave PIX
              <input value={props.pixKey} onChange={(e) => props.setPixKey(e.target.value)} required className="mt-1 h-10 w-full rounded-xl border border-[#dce6e3] px-3 outline-none focus:border-emerald-300" />
            </label>
            {props.message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[9px] text-emerald-700">{props.message}</div> : null}
            {props.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">{props.error}</div> : null}
            <button disabled={props.busy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-[10px] font-extrabold text-[#06231b] disabled:opacity-50">
              {props.busy ? "A criar ticket…" : "Criar ticket de payout"}
            </button>
          </form>
        ) : null}
      </article>

      <Panel title="Histórico de payouts" subtitle="Tickets e liquidações" icon={BanknoteArrowDown}>
        <PayoutTable rows={props.rows} />
      </Panel>
    </div>
  );
}

function DevelopersView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/docs/api" className="rounded-[20px] border border-[#dce6e3] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <Code2 className="h-5 w-5 text-emerald-700" />
        <h2 className="mt-4 text-lg font-semibold">API Reference</h2>
        <p className="mt-2 text-[10px] leading-5 text-[#70847e]">Cobranças PIX, idempotência, status, erros e OpenAPI.</p>
      </Link>
      <Link href="/docs/ai-setup" className="rounded-[20px] border border-[#dce6e3] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <BookOpen className="h-5 w-5 text-emerald-700" />
        <h2 className="mt-4 text-lg font-semibold">AI Integration Kit</h2>
        <p className="mt-2 text-[10px] leading-5 text-[#70847e]">Prompts prontos para GPT, Claude, Codex e outras IAs integrarem o seu site.</p>
      </Link>
    </div>
  );
}

function SettingsView({ accountId, accountStatus, kyc, role }: { accountId: string; accountStatus: string; kyc: string; role: string }) {
  return (
    <Panel title="Definições da conta" subtitle="Identidade e acesso" icon={Settings2}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Account ID" value={accountId} />
        <Fact label="Estado" value={accountStatus} />
        <Fact label="KYC" value={kyc} />
        <Fact label="Role" value={role} />
      </div>
    </Panel>
  );
}

function MetricCard({ label, value, icon: Icon, detail, tone }: { label: string; value: string; icon: typeof WalletCards; detail: string; tone: string }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-sky-50 text-sky-700 border-sky-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <article className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-[#20332e]">{label}</span>
        <div className={"flex h-9 w-9 items-center justify-center rounded-xl border " + (tones[tone] ?? tones.green)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <strong className="mt-5 block text-2xl tracking-[-.04em]">{value}</strong>
      <p className="mt-2 text-[9px] leading-4 text-[#728680]">{detail}</p>
    </article>
  );
}

function Panel({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Store; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#dce6e3] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e5ecea] px-5 py-4">
        <div>
          <strong className="block text-[12px]">{title}</strong>
          <span className="mt-1 block text-[8px] text-[#7a8d87]">{subtitle}</span>
        </div>
        <Icon className="h-4 w-4 text-[#526b63]" />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ReleaseTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left text-[9px]">
        <thead><tr className="border-b border-[#e5ecea] text-[#758a84]"><th className="p-3">Store</th><th className="p-3">Classe</th><th className="p-3">Disponível</th><th className="p-3">A liberar</th><th className="p-3">Próxima liberação</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={String(row.store_code ?? index)} className="border-b border-[#edf2f0]">
              <td className="p-3"><strong>{text(row.store_name, text(row.store_code))}</strong><span className="block text-[7px] text-[#879993]">{text(row.store_code)}</span></td>
              <td className="p-3">{text(row.release_class)}</td>
              <td className="p-3 font-semibold text-emerald-700">{money(row.available_brl)}</td>
              <td className="p-3 font-semibold text-amber-700">{money(row.pending_brl)}</td>
              <td className="p-3">{date(row.next_available_at)}</td>
            </tr>
          )) : <EmptyRow colSpan={5} label="Sem recebíveis ainda." />}
        </tbody>
      </table>
    </div>
  );
}

function GatewayGrid({ rows, stores }: { rows: Array<Record<string, unknown>>; stores: Array<Record<string, unknown>> }) {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.length ? rows.map((row, index) => (
          <div key={String(row.gateway_alias ?? index)} className="rounded-2xl border border-[#e2eae8] bg-[#fbfcfc] p-4">
            <div className="flex items-center justify-between">
              <strong className="text-[10px]">{text(row.provider_code)}</strong>
              <span className={"rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(row.health)}>{text(row.health)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Fact label="Gateway" value={text(row.gateway_alias)} />
              <Fact label="Latência" value={row.latency_ms == null ? "—" : text(row.latency_ms) + " ms"} />
            </div>
          </div>
        )) : <div className="text-[9px] text-[#7b8f89]">Nenhum gateway configurado.</div>}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[8px] text-emerald-700">
        <GitBranch className="h-3.5 w-3.5" />
        Routing ativo em {stores.length} Store(s).
      </div>
    </div>
  );
}

function PaymentsTable({ rows, compact = false }: { rows: Array<Record<string, unknown>>; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left text-[9px]">
        <thead><tr className="border-b border-[#e5ecea] text-[#758a84]"><th className="p-3">Referência</th><th className="p-3">Store</th><th className="p-3">Estado</th><th className="p-3">Valor</th>{!compact ? <th className="p-3">Criado</th> : null}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-b border-[#edf2f0]">
              <td className="p-3 font-semibold">{text(row.external_reference)}</td>
              <td className="p-3">{text(row.store_code)}</td>
              <td className="p-3"><span className={"rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(row.status)}>{text(row.status)}</span></td>
              <td className="p-3 font-semibold">{money(row.amount)}</td>
              {!compact ? <td className="p-3">{date(row.created_at)}</td> : null}
            </tr>
          )) : <EmptyRow colSpan={compact ? 4 : 5} label="Nenhum pagamento criado ainda." />}
        </tbody>
      </table>
    </div>
  );
}

function PayoutTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-[9px]">
        <thead><tr className="border-b border-[#e5ecea] text-[#758a84]"><th className="p-3">Criado</th><th className="p-3">Valor</th><th className="p-3">Destino</th><th className="p-3">Estado</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => {
            const destination = row.destination_snapshot && typeof row.destination_snapshot === "object"
              ? row.destination_snapshot as Record<string, unknown>
              : {};
            return (
              <tr key={String(row.id ?? index)} className="border-b border-[#edf2f0]">
                <td className="p-3">{date(row.created_at)}</td>
                <td className="p-3 font-semibold">{money(row.amount)}</td>
                <td className="p-3">{text(destination.pixKeyType)} · {text(destination.pixKeyMasked)}</td>
                <td className="p-3"><span className={"rounded-full border px-2 py-1 text-[7px] font-bold " + statusTone(row.status)}>{text(row.status)}</span></td>
              </tr>
            );
          }) : <EmptyRow colSpan={4} label="Nenhum payout solicitado." />}
        </tbody>
      </table>
    </div>
  );
}

function CashFlowChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const values = rows.map((row) => ({
    incoming: Number(row.incoming_brl ?? 0),
    outgoing: Number(row.outgoing_brl ?? 0),
  }));
  const max = Math.max(1, ...values.flatMap((row) => [row.incoming, row.outgoing]));
  return (
    <div>
      <div className="flex h-[175px] items-end gap-1 overflow-hidden rounded-xl bg-[#fbfcfc] px-3 pt-4">
        {values.length ? values.map((row, index) => (
          <div key={index} className="flex min-w-0 flex-1 items-end justify-center gap-[2px]">
            <div className="w-[42%] rounded-t bg-emerald-500/75" style={{ height: Math.max(2, (row.incoming / max) * 145) }} />
            <div className="w-[42%] rounded-t bg-sky-400/75" style={{ height: Math.max(2, (row.outgoing / max) * 145) }} />
          </div>
        )) : <div className="m-auto text-[9px] text-[#82948f]">Sem fluxo no período.</div>}
      </div>
      <div className="mt-3 flex gap-4 text-[8px] text-[#758a84]">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Entradas</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky-400" /> Saídas</span>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5ecea] bg-[#fbfcfc] p-2.5">
      <span className="block text-[7px] uppercase tracking-[.1em] text-[#83958f]">{label}</span>
      <strong className="mt-1 block truncate text-[9px] text-[#334942]">{value}</strong>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan} className="p-8 text-center text-[9px] text-[#83958f]">{label}</td></tr>;
}
