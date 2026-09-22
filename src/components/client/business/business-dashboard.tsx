"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Code2,
  CreditCard,
  FileText,
  KeyRound,
  Landmark,
  ListFilter,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  Send,
  ShieldCheck,
  Store,
  WalletCards,
  X
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import type {
  AccountAccess,
  CashflowRow,
  DashboardProps,
  PaymentRow,
  PayoutRow,
  SettlementRow,
  StoreRow
} from "@/components/client/client-types";
import {
  brl,
  compactId,
  statusTone
} from "@/components/client/client-types";

type BusinessDashboardProps = Omit<DashboardProps, "activeAccess"> & {
  activeAccess: AccountAccess;
  payoutOpen: boolean;
  setPayoutOpen: (value: boolean) => void;
};

type Movement = {
  id: string;
  reference: string;
  origin: string;
  type: string;
  status: string;
  date: string;
  value: number;
  direction: "incoming" | "outgoing";
};

const NAV_ITEMS = [
  ["Visão geral", BarChart3, "overview"],
  ["Wallet BRL", WalletCards, "wallet"],
  ["Stores", Store, "stores"],
  ["Pagamentos PIX", CreditCard, "payments"],
  ["Transações", Activity, "movements"],
  ["Liberações", CalendarDays, "releases"],
  ["Payouts", Send, "payout-action"],
  ["Relatórios", FileText, "cashflow"]
] as const;

export function BusinessDashboard(props: BusinessDashboardProps) {
  const business = props.overview?.business;
  const summary = business?.summary ?? {
    availableBrl: 0,
    pendingBrl: 0,
    reservedBrl: 0,
    blockedBrl: 0
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredStores = useMemo(
    () =>
      (business?.stores ?? []).filter((store) => {
        if (!normalizedSearch) return true;
        return [
          store.code,
          store.name,
          store.release_class ?? "",
          store.status
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      }),
    [business?.stores, normalizedSearch]
  );

  const filteredPayments = useMemo(
    () =>
      (business?.payments ?? []).filter((payment) => {
        if (!normalizedSearch) return true;
        return [
          payment.external_reference ?? "",
          payment.store_code ?? "",
          payment.status,
          payment.amount
        ].some((value) =>
          String(value).toLowerCase().includes(normalizedSearch)
        );
      }),
    [business?.payments, normalizedSearch]
  );

  const activeAlerts =
    (business?.payouts ?? []).filter((row) =>
      ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING"].includes(row.status)
    ).length +
    (business?.settlements ?? []).filter((row) => row.status === "PENDING")
      .length;

  const operations = business?.operations ?? {
    pixStatus: "UNKNOWN" as const,
    payments30d: 0,
    successful30d: 0,
    successRate30d: null
  };
  const systemHealthy = operations.pixStatus === "OPERATIONAL";

  const totalManaged =
    summary.availableBrl + summary.pendingBrl + summary.reservedBrl;

  const today = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());

  const movements = buildMovements(
    filteredPayments,
    business?.settlements ?? [],
    business?.payouts ?? []
  );

  const performance = buildPerformance(
    business?.payments ?? [],
    operations
  );

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F7F9F8_0%,#F3F6F5_100%)] text-[#0A1614]">
      <div className="grid min-h-screen lg:grid-cols-[252px_1fr]">
        <BusinessSidebar
          session={props.session}
          accountId={props.accountId}
          setAccountId={props.setAccountId}
          activeAccess={props.activeAccess}
          onNavigate={() => setMobileNavOpen(false)}
          onPayout={() => props.setPayoutOpen(true)}
          mobile={false}
        />

        <div className="min-w-0">
          <BusinessTopbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeAlerts={activeAlerts}
            notificationsOpen={notificationsOpen}
            setNotificationsOpen={setNotificationsOpen}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            merchantName={business?.merchant.trade_name || "Minha conta"}
            signOut={props.signOut}
            openMobileNav={() => setMobileNavOpen(true)}
            payouts={business?.payouts ?? []}
            settlements={business?.settlements ?? []}
          />

          <div className="px-4 py-6 sm:px-6 lg:px-7 2xl:px-8">
            <div className="mx-auto max-w-[1640px] space-y-4">
              <DashboardHeader
                today={today}
                busy={props.busy}
                refresh={props.refresh}
                systemHealthy={systemHealthy}
                pixStatus={operations.pixStatus}
              />

              {props.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {props.error}
                </div>
              ) : null}

              <section
                id="wallet"
                className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-[2.4fr_1fr_1fr_1fr]"
              >
                <BusinessWalletHero
                  available={summary.availableBrl}
                  onPayout={() => props.setPayoutOpen(true)}
                />
                <MetricCard
                  icon={CalendarDays}
                  label="A liberar"
                  value={brl(summary.pendingBrl)}
                  description="Recebíveis das Stores em processo de liberação."
                  tone="amber"
                  onClick={() => scrollToSection("releases")}
                />
                <MetricCard
                  icon={ShieldCheck}
                  label="Reservado"
                  value={brl(summary.reservedBrl)}
                  description="Valores comprometidos com payouts, retenções ou ajustes."
                  tone="blue"
                  onClick={() => scrollToSection("payouts")}
                />
                <TotalManagedCard value={totalManaged} />
              </section>

              <section
                id="stores"
                className="grid gap-3 2xl:grid-cols-[1.42fr_1fr]"
              >
                <StoreReleasePanel stores={filteredStores} />
                <PixOperationsPanel
                  operations={operations}
                  settlements={business?.settlements ?? []}
                  stores={business?.stores ?? []}
                />
              </section>

              <section className="grid gap-3 2xl:grid-cols-[1.18fr_1fr]">
                <PerformancePanel {...performance} />
                <QuickActions
                  onPayout={() => props.setPayoutOpen(true)}
                  financialWritesEnabled={
                    props.overview?.capabilities.financialWritesEnabled ?? false
                  }
                />
              </section>

              <section className="grid gap-3 2xl:grid-cols-[1.2fr_1fr]">
                <MovementsPanel movements={movements} />
                <CashflowPanel
                  rows={business?.cashflow ?? []}
                  available={summary.availableBrl}
                />
              </section>
            </div>
          </div>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-[#02110E]/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative h-full w-[286px] max-w-[86vw] shadow-2xl">
            <BusinessSidebar
              session={props.session}
              accountId={props.accountId}
              setAccountId={props.setAccountId}
              activeAccess={props.activeAccess}
              onNavigate={() => setMobileNavOpen(false)}
              onPayout={() => props.setPayoutOpen(true)}
              mobile
            />
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

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

function BusinessTopbar(props: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeAlerts: number;
  notificationsOpen: boolean;
  setNotificationsOpen: (value: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (value: boolean) => void;
  merchantName: string;
  signOut: () => Promise<void>;
  openMobileNav: () => void;
  payouts: PayoutRow[];
  settlements: SettlementRow[];
}) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-[#E0E7E4] bg-white/96 px-4 shadow-[0_1px_0_rgba(18,51,42,.02)] backdrop-blur-xl sm:px-5 lg:px-7">
      <button
        onClick={props.openMobileNav}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE6E2] text-[#27463E] lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative hidden max-w-[735px] flex-1 md:block">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E79]" />
        <input
          value={props.searchQuery}
          onChange={(event) => props.setSearchQuery(event.target.value)}
          placeholder="Buscar transações, stores, referências, tickets..."
          className="h-11 w-full rounded-[10px] border border-[#DCE6E2] bg-[#FAFCFB] pl-11 pr-16 text-[13px] text-[#172821] outline-none transition focus:border-[#14C98C] focus:ring-4 focus:ring-[#14C98C]/8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#DEE6E3] bg-white px-2 py-1 text-[10px] font-semibold text-[#7A8B86]">
          Ctrl K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-[#50625D] sm:gap-2">
        <a
          href="/docs"
          className="hidden h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-medium hover:bg-[#F1F6F4] sm:flex"
        >
          <CircleHelp className="h-4 w-4" />
          Ajuda
        </a>

        <div className="relative">
          <button
            onClick={() => {
              props.setNotificationsOpen(!props.notificationsOpen);
              props.setProfileOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#F1F6F4]"
            aria-label={
              props.activeAlerts
                ? props.activeAlerts + " alertas operacionais"
                : "Sem alertas operacionais"
            }
          >
            <Bell className="h-4 w-4" />
            {props.activeAlerts ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F25D68] px-1 text-[9px] font-bold text-white">
                {props.activeAlerts > 9 ? "9+" : props.activeAlerts}
              </span>
            ) : null}
          </button>

          {props.notificationsOpen ? (
            <NotificationPanel
              payouts={props.payouts}
              settlements={props.settlements}
            />
          ) : null}
        </div>

        <div className="hidden h-7 w-px bg-[#E1E8E5] sm:block" />

        <div className="relative">
          <button
            onClick={() => {
              props.setProfileOpen(!props.profileOpen);
              props.setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-[#F1F6F4] sm:px-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#083A30] text-[11px] font-bold text-white">
              {initials(props.merchantName)}
            </div>
            <div className="hidden text-left xl:block">
              <strong className="block max-w-[150px] truncate text-[12px] text-[#12211E]">
                {props.merchantName}
              </strong>
              <span className="text-[10px] text-[#70817C]">PiXBrasil Business</span>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
          </button>

          {props.profileOpen ? (
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-[#DCE6E2] bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,.12)]">
              <div className="border-b border-[#E8EFEC] px-3 py-2.5">
                <strong className="block truncate text-[12px]">
                  {props.merchantName}
                </strong>
                <span className="text-[10px] text-[#82938D]">Conta Business</span>
              </div>
              {["Minha conta", "Equipe", "Segurança", "Preferências"].map(
                (label) => (
                  <button
                    key={label}
                    onClick={() => {
                      props.setProfileOpen(false);
                      scrollToSection("account");
                    }}
                    className="flex h-9 w-full items-center rounded-lg px-3 text-left text-[11px] hover:bg-[#F4F8F6]"
                  >
                    {label}
                  </button>
                )
              )}
              <button
                onClick={() => void props.signOut()}
                className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NotificationPanel(props: {
  payouts: PayoutRow[];
  settlements: SettlementRow[];
}) {
  const payouts = props.payouts.filter((row) =>
    ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING"].includes(row.status)
  );
  const releases = props.settlements.filter((row) => row.status === "PENDING");

  return (
    <div className="absolute right-0 top-12 w-[330px] max-w-[88vw] rounded-xl border border-[#DCE6E2] bg-white p-3 shadow-[0_18px_50px_rgba(0,0,0,.12)]">
      <div className="flex items-center justify-between px-1 pb-2">
        <strong className="text-[13px]">Alertas operacionais</strong>
        <span className="rounded-full bg-[#EDF6F2] px-2 py-1 text-[10px] font-bold text-[#126B50]">
          {payouts.length + releases.length}
        </span>
      </div>
      <div className="max-h-[310px] space-y-2 overflow-auto">
        {payouts.slice(0, 4).map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-[#E6ECEA] bg-[#FBFCFC] p-3"
          >
            <span className="text-[10px] font-bold uppercase tracking-[.09em] text-[#80641E]">
              Payout
            </span>
            <strong className="mt-1 block text-[11px]">
              {brl(row.amount)} · {row.status}
            </strong>
          </div>
        ))}
        {releases.slice(0, 4).map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-[#E6ECEA] bg-[#FBFCFC] p-3"
          >
            <span className="text-[10px] font-bold uppercase tracking-[.09em] text-[#1765D1]">
              Liberação
            </span>
            <strong className="mt-1 block text-[11px]">
              {row.store_code || "Store"} · {brl(row.net_brl)}
            </strong>
          </div>
        ))}
        {!payouts.length && !releases.length ? (
          <div className="rounded-lg border border-dashed border-[#DCE6E2] p-5 text-center text-[11px] text-[#7B8D87]">
            Nenhum alerta operacional.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardHeader(props: {
  today: string;
  busy: boolean;
  refresh: () => Promise<void>;
  systemHealthy: boolean;
  pixStatus: "OPERATIONAL" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
}) {
  return (
    <section
      id="overview"
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <h1 className="text-[32px] font-bold tracking-[-.045em] text-[#081512] sm:text-[36px]">
          Visão geral financeira
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[#6C7E79]">
          Acompanhe seus recebíveis, operações PIX e o desempenho das suas Stores em tempo real.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[#DCE6E2] bg-white px-3 text-[11px] text-[#62756E]">
          <CalendarDays className="h-4 w-4 text-[#1C5C4C]" />
          <span>{props.today}</span>
        </div>

        <div
          className={[
            "flex min-h-12 items-center gap-2 rounded-xl border px-3",
            props.systemHealthy
              ? "border-emerald-100 bg-[#E8FBF4] text-[#096846]"
              : "border-slate-200 bg-white text-[#65756F]"
          ].join(" ")}
        >
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              props.systemHealthy ? "bg-[#10C98A]" : "bg-slate-300"
            ].join(" ")}
          />
          <div>
            <strong className="block text-[11px]">
              {props.systemHealthy ? "Sistema operacional" : "Estado operacional"}
            </strong>
            <span className="text-[10px]">
              {props.pixStatus === "OPERATIONAL"
                ? "Operação PIX normal"
                : props.pixStatus === "DEGRADED"
                  ? "Operação com atenção"
                  : props.pixStatus === "UNAVAILABLE"
                    ? "Operação indisponível"
                    : "Aguardando atividade"}
            </span>
          </div>
        </div>

        <button
          onClick={() => void props.refresh()}
          disabled={props.busy}
          className="flex h-12 items-center gap-2 rounded-xl border border-[#DCE6E2] bg-white px-3 text-[11px] font-semibold text-[#50625D] hover:bg-[#F7FAF9] disabled:opacity-50"
        >
          <Activity
            className={
              props.busy ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"
            }
          />
          Atualizar
        </button>
      </div>
    </section>
  );
}

function BusinessWalletHero(props: {
  available: number;
  onPayout: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_96%_100%,rgba(20,230,161,.18),transparent_32%),linear-gradient(125deg,#073A30,#04251F)] p-6 text-white shadow-[0_18px_44px_rgba(5,52,42,.16)] xl:col-span-2 2xl:col-span-1">
      <div className="grid h-full gap-5 md:grid-cols-[1fr_190px] md:items-center">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.11em] text-[#B7D5CD]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0C5748] text-[#17E7A4]">
              <WalletCards className="h-4 w-4" />
            </span>
            <span>
              Wallet BRL empresarial
              <span className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-[#8FB7AC]">
                Disponível para payout
              </span>
            </span>
          </div>

          <strong className="mt-5 block text-[42px] font-bold tracking-[-.055em] sm:text-[48px]">
            {brl(props.available)}
          </strong>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/docs/api"
              className="flex h-10 items-center gap-2 rounded-lg bg-[#14E6A1] px-4 text-[11px] font-extrabold text-[#032018] transition hover:bg-[#34F0B1]"
              title="Abrir integração para receber PIX"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Receber PIX
            </a>
            <button
              onClick={() => scrollToSection("payments")}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-[11px] font-semibold hover:bg-white/5"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Pagamentos PIX
            </button>
            <button
              onClick={props.onPayout}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-[11px] font-semibold hover:bg-white/5"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Solicitar payout
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-6 w-6 text-[#CEE4DE]" />
            <div>
              <strong className="block text-[11px] leading-4">
                Os payouts saem da Wallet BRL.
              </strong>
              <p className="mt-2 text-[10px] leading-4 text-[#9FC2B8]">
                Os valores das Stores entram após a respectiva liberação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricCard(props: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  description: string;
  tone: "amber" | "blue";
  onClick: () => void;
}) {
  const Icon = props.icon;
  const tone =
    props.tone === "amber"
      ? "bg-[#FFF1DA] text-[#DA830F]"
      : "bg-[#E6F4FF] text-[#1688E8]";

  return (
    <button
      onClick={props.onClick}
      className="group min-h-[196px] rounded-[14px] border border-[#DEE7E3] bg-white p-5 text-left shadow-[0_8px_26px_rgba(28,63,54,.045)] transition hover:-translate-y-0.5 hover:border-[#C9D8D2] hover:shadow-[0_12px_30px_rgba(28,63,54,.07)]"
    >
      <div className="flex items-center justify-between">
        <span className={"flex h-10 w-10 items-center justify-center rounded-lg " + tone}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-[#748780] transition group-hover:translate-x-1" />
      </div>
      <strong className="mt-3 block text-[13px]">{props.label}</strong>
      <span className="mt-3 block text-[26px] font-bold tracking-[-.045em]">
        {props.value}
      </span>
      <p className="mt-3 text-[11px] leading-4 text-[#71847D]">
        {props.description}
      </p>
    </button>
  );
}

function TotalManagedCard({ value }: { value: number }) {
  return (
    <article className="min-h-[196px] rounded-[14px] border border-[#DEE7E3] bg-white p-5 shadow-[0_8px_26px_rgba(28,63,54,.045)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E5FAF1] text-[#109B69]">
        <BarChart3 className="h-5 w-5" />
      </div>
      <strong className="mt-3 block text-[13px]">Total sob gestão</strong>
      <span className="mt-3 block text-[26px] font-bold tracking-[-.045em]">
        {brl(value)}
      </span>
      <p className="mt-3 text-[11px] leading-4 text-[#71847D]">
        Wallet disponível + recebíveis a liberar + reservado.
      </p>
    </article>
  );
}

function StoreReleasePanel({ stores }: { stores: StoreRow[] }) {
  return (
    <Panel
      id="releases"
      title="Liberações por Store"
      icon={Store}
      action="Stores e recebíveis"
    >
      {stores.length ? (
        <div className="premium-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[10px]">
            <thead>
              <tr className="border-b border-[#E3EBE8] text-[#748780]">
                <th className="px-3 py-3 font-semibold">Store</th>
                <th className="px-3 py-3 font-semibold">Release</th>
                <th className="px-3 py-3 font-semibold">Progresso</th>
                <th className="px-3 py-3 font-semibold">Próxima liberação</th>
                <th className="px-3 py-3 font-semibold">A liberar</th>
                <th className="px-3 py-3 font-semibold">Disponível</th>
                <th className="px-3 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store, index) => {
                const available = Number(store.available_brl || 0);
                const pending = Number(store.pending_brl || 0);
                const total = available + pending;
                const progress =
                  total > 0
                    ? Math.max(0, Math.min(100, Math.round((available / total) * 100)))
                    : pending > 0
                      ? 0
                      : 100;

                return (
                  <tr
                    key={store.id}
                    className="border-b border-[#EEF3F1] transition last:border-0 hover:bg-[#FAFCFB]"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white",
                            ["bg-[#287FC7]", "bg-[#1B9BDB]", "bg-[#EE8A2B]", "bg-[#B27A39]", "bg-[#28984D]"][index % 5]
                          ].join(" ")}
                        >
                          {store.code.slice(0, 2)}
                        </span>
                        <div>
                          <strong className="block text-[10px] text-[#162722]">
                            {store.name}
                          </strong>
                          <span className="mt-0.5 block text-[9px] text-[#8B9A95]">
                            {store.code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-[#EEF3F1] px-1.5 py-1 font-bold text-[#385149]">
                        {store.release_class || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[120px] items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EFEC]">
                          <div
                            className="h-full rounded-full bg-[#14DFA0]"
                            style={{ width: progress + "%" }}
                          />
                        </div>
                        <span className="w-7 text-right text-[#6D817A]">
                          {progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#687C75]">
                      {store.next_available_at
                        ? new Date(store.next_available_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {brl(store.pending_brl)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {brl(store.available_brl)}
                    </td>
                    <td className="px-3 py-3">
                      <Status value={store.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty label="Nenhuma Store configurada." />
      )}
    </Panel>
  );
}

function PixOperationsPanel(props: {
  operations: {
    pixStatus: "OPERATIONAL" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
    payments30d: number;
    successful30d: number;
    successRate30d: string | null;
  };
  settlements: SettlementRow[];
  stores: StoreRow[];
}) {
  const activeStores = props.stores.filter((store) =>
    ["ACTIVE", "ENABLED"].includes(store.status.toUpperCase())
  ).length;
  const pendingReleases = props.settlements.filter(
    (row) => row.status.toUpperCase() === "PENDING"
  ).length;
  const status = props.operations.pixStatus;
  const statusLabel =
    status === "OPERATIONAL"
      ? "Operação normal"
      : status === "DEGRADED"
        ? "Operação com atenção"
        : status === "UNAVAILABLE"
          ? "Operação indisponível"
          : "Aguardando atividade";
  const healthy = status === "OPERATIONAL";

  return (
    <Panel
      id="operation"
      title="Operação PIX"
      icon={Activity}
      action={statusLabel}
    >
      <div className="grid gap-3 lg:grid-cols-[1.08fr_.92fr]">
        <div className="rounded-[14px] border border-[#DFE8E4] bg-[linear-gradient(145deg,#F9FCFB,#F3F8F6)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71847D]">
                Infraestrutura PiXBrasil
              </span>
              <strong className="mt-2 block text-[15px] tracking-[-.025em] text-[#10231E]">
                Pagamentos e liquidação
              </strong>
            </div>
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold",
                healthy
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : status === "DEGRADED"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600"
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  healthy
                    ? "bg-emerald-500"
                    : status === "DEGRADED"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                ].join(" ")}
              />
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-[#E1EAE6]">
            <OperationMetric
              label="Pagamentos 30d"
              value={String(props.operations.payments30d)}
            />
            <OperationMetric
              label="Concluídos"
              value={String(props.operations.successful30d)}
            />
            <OperationMetric
              label="Taxa de sucesso"
              value={
                props.operations.successRate30d == null
                  ? "—"
                  : Number(props.operations.successRate30d).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2
                    }) + "%"
              }
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[14px] border border-[#E1E9E6] bg-white p-4">
            <span className="text-[10px] font-medium text-[#73867F]">
              Stores ativas
            </span>
            <div className="mt-2 flex items-end justify-between">
              <strong className="text-[24px] tracking-[-.04em]">
                {activeStores}
              </strong>
              <Store className="h-5 w-5 text-[#13956B]" />
            </div>
          </div>
          <div className="rounded-[14px] border border-[#E1E9E6] bg-white p-4">
            <span className="text-[10px] font-medium text-[#73867F]">
              Liberações pendentes
            </span>
            <div className="mt-2 flex items-end justify-between">
              <strong className="text-[24px] tracking-[-.04em]">
                {pendingReleases}
              </strong>
              <CalendarDays className="h-5 w-5 text-[#D89024]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E2EAE7] bg-[#FAFCFB] px-3 py-2.5 text-[10px] text-[#6B7E77]">
        <ShieldCheck className="h-4 w-4 text-[#13956B]" />
        A infraestrutura de processamento é gerida pelo PiXBrasil. Sua conta mostra apenas o estado operacional e financeiro relevante.
      </div>
    </Panel>
  );
}

function OperationMetric(props: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <span className="block text-[9px] text-[#7A8D86]">{props.label}</span>
      <strong className="mt-2 block text-[18px] tracking-[-.035em] text-[#132720]">
        {props.value}
      </strong>
    </div>
  );
}

function PerformancePanel(props: {
  volumeToday: number;
  paymentCount30d: number;
  averageTicket: number;
  successRate: number | null;
  successful30d: number;
}) {
  const metrics = [
    ["Volume PIX hoje", brl(props.volumeToday)],
    ["Pagamentos (30d)", String(props.paymentCount30d)],
    ["Ticket médio", brl(props.averageTicket)],
    [
      "Taxa de sucesso",
      props.successRate == null
        ? "—"
        : props.successRate.toLocaleString("pt-BR", {
            maximumFractionDigits: 2
          }) + "%"
    ],
    ["Concluídos (30d)", String(props.successful30d)]
  ];

  return (
    <Panel
      id="payments"
      title="Performance PIX"
      icon={BarChart3}
      action="Dados reais disponíveis"
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={[
              "min-h-[76px] px-3 py-2.5",
              index ? "xl:border-l xl:border-[#E6EEEB]" : ""
            ].join(" ")}
          >
            <span className="text-[9px] text-[#71847D]">{label}</span>
            <strong className="mt-2 block text-[15px] tracking-[-.025em]">
              {value}
            </strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function QuickActions(props: {
  onPayout: () => void;
  financialWritesEnabled: boolean;
}) {
  return (
    <Panel title="Ações rápidas" icon={KeyRound} action="Operação Business">
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href="/docs/api"
          className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[#D9EEE6] bg-[#EAFAF4] p-3 transition hover:-translate-y-0.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0EBB7D]">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <strong className="block text-[11px]">Receber PIX</strong>
            <span className="mt-1 block text-[9px] text-[#70837C]">
              Integração e cobrança via API
            </span>
          </div>
        </a>

        <button
          onClick={() => scrollToSection("stores")}
          className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[#E1E9E6] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:bg-[#FBFCFC]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F6F4] text-[#1765D1]">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <strong className="block text-[11px]">Stores</strong>
            <span className="mt-1 block text-[9px] text-[#70837C]">
              Acompanhar recebíveis
            </span>
          </div>
        </button>

        <button
          onClick={props.onPayout}
          disabled={!props.financialWritesEnabled}
          className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[#E1E9E6] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:bg-[#FBFCFC] disabled:cursor-not-allowed disabled:opacity-45"
          title={
            props.financialWritesEnabled
              ? "Solicitar payout"
              : "Operação indisponível para esta conta"
          }
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F6F4] text-[#1765D1]">
            <Send className="h-4 w-4" />
          </span>
          <div>
            <strong className="block text-[11px]">Solicitar payout</strong>
            <span className="mt-1 block text-[9px] text-[#70837C]">
              Transferir saldo disponível
            </span>
          </div>
        </button>

        <a
          href="/docs/webhooks"
          className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[#E1E9E6] bg-white p-3 transition hover:-translate-y-0.5 hover:bg-[#FBFCFC]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F6F4] text-[#5B55C8]">
            <Code2 className="h-4 w-4" />
          </span>
          <div>
            <strong className="block text-[11px]">API & Webhooks</strong>
            <span className="mt-1 block text-[9px] text-[#70837C]">
              Integração técnica
            </span>
          </div>
        </a>
      </div>
    </Panel>
  );
}

function MovementsPanel({ movements }: { movements: Movement[] }) {
  return (
    <Panel
      id="movements"
      title="Movimentações recentes"
      icon={ListFilter}
      action="Pagamentos, liberações e payouts"
    >
      {movements.length ? (
        <div className="premium-scrollbar overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[10px]">
            <thead>
              <tr className="border-b border-[#E3EBE8] text-[#748780]">
                <th className="px-3 py-3 font-semibold">Referência</th>
                <th className="px-3 py-3 font-semibold">Origem</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Data</th>
                <th className="px-3 py-3 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 8).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#EEF3F1] last:border-0"
                >
                  <td className="px-3 py-3 font-medium text-[#345F89]">
                    {row.reference}
                  </td>
                  <td className="px-3 py-3">{row.origin}</td>
                  <td className="px-3 py-3">{row.type}</td>
                  <td className="px-3 py-3">
                    <Status value={row.status} />
                  </td>
                  <td className="px-3 py-3 text-[#70837C]">
                    {new Date(row.date).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td
                    className={[
                      "px-3 py-3 text-right font-semibold",
                      row.direction === "outgoing"
                        ? "text-[#B5414B]"
                        : "text-[#14231F]"
                    ].join(" ")}
                  >
                    {row.direction === "outgoing" ? "- " : ""}
                    {brl(Math.abs(row.value))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty label="Ainda não existem movimentações." />
      )}
    </Panel>
  );
}

function CashflowPanel(props: {
  rows: CashflowRow[];
  available: number;
}) {
  const values = props.rows.map((row) => ({
    incoming: Number(row.incoming_brl || 0),
    outgoing: Number(row.outgoing_brl || 0)
  }));

  const max = Math.max(
    1,
    ...values.flatMap((value) => [value.incoming, value.outgoing])
  );

  const chartRows = props.rows.slice(-30);
  const netSeries = chartRows.reduce<number[]>((acc, row, index) => {
    const previous = index ? acc[index - 1] : 0;
    acc.push(
      previous +
        Number(row.incoming_brl || 0) -
        Number(row.outgoing_brl || 0)
    );
    return acc;
  }, []);

  const minNet = Math.min(0, ...netSeries);
  const maxNet = Math.max(1, ...netSeries);
  const range = Math.max(1, maxNet - minNet);
  const points = netSeries
    .map((value, index) => {
      const x =
        netSeries.length <= 1 ? 50 : (index / (netSeries.length - 1)) * 100;
      const y = 88 - ((value - minNet) / range) * 70;
      return x + "," + y;
    })
    .join(" ");

  return (
    <Panel
      id="cashflow"
      title="Fluxo de caixa (últimos 30 dias)"
      icon={BarChart3}
      action={"Saldo " + brl(props.available)}
    >
      <div className="mb-3 flex flex-wrap gap-4 text-[9px] text-[#667A73]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#15DFA0]" />
          Entradas PIX
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#258AF5]" />
          Saídas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-[2px] w-4 bg-[#064C3D]" />
          Fluxo líquido acumulado
        </span>
      </div>

      {chartRows.length ? (
        <div className="relative h-[210px] overflow-hidden rounded-xl border border-[#E5ECEA] bg-[#FBFCFC]">
          <div className="absolute inset-x-3 bottom-3 top-4 flex items-end gap-[3px]">
            {chartRows.map((row) => {
              const incoming = Number(row.incoming_brl || 0);
              const outgoing = Number(row.outgoing_brl || 0);
              return (
                <div
                  key={row.day}
                  className="flex h-full min-w-0 flex-1 items-end gap-[1px]"
                  title={
                    new Date(row.day).toLocaleDateString("pt-BR") +
                    " · Entradas " +
                    brl(incoming) +
                    " · Saídas " +
                    brl(outgoing)
                  }
                >
                  <div
                    className="w-1/2 rounded-t-sm bg-[#15DFA0]"
                    style={{
                      height: Math.max(2, (incoming / max) * 78) + "%"
                    }}
                  />
                  <div
                    className="w-1/2 rounded-t-sm bg-[#258AF5]"
                    style={{
                      height: Math.max(2, (outgoing / max) * 78) + "%"
                    }}
                  />
                </div>
              );
            })}
          </div>

          {points ? (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-3 h-[calc(100%-24px)] w-[calc(100%-24px)]"
              aria-hidden="true"
            >
              <polyline
                points={points}
                fill="none"
                stroke="#064C3D"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
        </div>
      ) : (
        <Empty label="Ainda não há dados para o fluxo de caixa." />
      )}
    </Panel>
  );
}

function BusinessSidebar(props: {
  session: DashboardProps["session"];
  accountId: string;
  setAccountId: (value: string) => void;
  activeAccess: AccountAccess;
  onNavigate: () => void;
  onPayout: () => void;
  mobile: boolean;
}) {
  return (
    <aside
      className={[
        "min-h-screen bg-[linear-gradient(180deg,#031713_0%,#041D18_100%)] px-3.5 py-6 text-white",
        props.mobile ? "block h-full overflow-y-auto" : "hidden lg:block"
      ].join(" ")}
    >
      <div className="px-2">
        <BrandLogo tagline className="text-[21px]" taglineClassName="text-[8px]" />
      </div>

      <div
        id="account"
        className="mt-7 rounded-[12px] border border-white/10 bg-white/[.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1C5E4F] bg-[#0A3029]">
            <Building2 className="h-4 w-4 text-[#35E5A9]" />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[11px]">
              {props.activeAccess.merchant?.trade_name || "Business"}
            </strong>
            <span className="mt-1 block text-[9px] text-[#71958B]">
              {props.activeAccess.role} · {compactId(props.accountId)}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-[#71958B]" />
        </div>

        {(props.session?.accounts.length ?? 0) > 1 ? (
          <select
            className="mt-3 h-8 w-full rounded-lg border border-white/10 bg-[#071B17] px-2 text-[10px] text-[#A9C1BA]"
            value={props.accountId}
            onChange={(event) => props.setAccountId(event.target.value)}
          >
            {props.session?.accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountType === "BUSINESS"
                  ? account.merchant?.trade_name || "Business"
                  : "Particular"}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <nav className="mt-5 space-y-0.5">
        {NAV_ITEMS.map(([label, Icon, target], index) => (
          <button
            key={label}
            onClick={() => {
              if (target === "payout-action") {
                props.onPayout();
              } else {
                scrollToSection(target);
              }
              props.onNavigate();
            }}
            className={[
              "flex h-11 w-full items-center gap-3 rounded-[9px] px-3.5 text-left text-[11px] font-medium transition",
              index === 0
                ? "border-l-2 border-[#14E6A1] bg-[linear-gradient(90deg,#0D4B3E,#0A3E35)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.03)]"
                : "border-l-2 border-transparent text-[#C0D0CB] hover:bg-white/[.05] hover:text-white"
            ].join(" ")}
          >
            <Icon
              className={
                index === 0
                  ? "h-4 w-4 text-[#20E7A6]"
                  : "h-4 w-4 text-[#C6D7D2]"
              }
            />
            {label}
          </button>
        ))}
      </nav>

      <div className="my-5 h-px bg-white/[.07]" />

      <a
        href="/docs"
        className="flex h-10 w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 text-[11px] font-medium text-[#C0D0CB] transition hover:bg-white/[.05] hover:text-white"
      >
        <Code2 className="h-4 w-4 text-[#C6D7D2]" />
        Desenvolvedores
      </a>

      <a
        href="/support"
        className="mt-0.5 flex h-10 w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 text-[11px] font-medium text-[#C0D0CB] transition hover:bg-white/[.05] hover:text-white"
      >
        <CircleHelp className="h-4 w-4 text-[#C6D7D2]" />
        Suporte
      </a>

      <div className="mt-7 rounded-xl border border-[#145546] bg-[linear-gradient(145deg,#06251F,#07342C)] p-4">
        <strong className="block max-w-[140px] text-[12px] leading-5">
          O PIX que impulsiona o seu negócio.
        </strong>
        <p className="mt-4 text-[10px] leading-4 text-[#8EB2A8]">
          Mais vendas.
          <br />
          Mais liberdade.
          <br />
          Mais crescimento.
        </p>
        <div className="mt-5 h-1 w-10 rounded-full bg-[#14E6A1]" />
      </div>

      <div className="mt-5 px-2 text-[9px] leading-4 text-[#69877F]">
        <strong className="text-[#A7BDB7]">PiXBrasil</strong>
        <span className="ml-2">v0.6.2</span>
        <br />
        © 2026 Todos os direitos reservados.
      </div>
    </aside>
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
    <section
      id={props.id}
      className="overflow-hidden rounded-[14px] border border-[#DEE7E3] bg-white shadow-[0_10px_30px_rgba(28,63,54,.045)]"
    >
      <div className="flex min-h-[54px] items-center justify-between border-b border-[#E8EEEC] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#184E42]" />
          <strong className="text-[12px] text-[#13231F]">{props.title}</strong>
        </div>
        {props.action ? (
          <span className="text-[9px] font-semibold text-[#1765D1]">
            {props.action}
          </span>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{props.children}</div>
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-1 text-[9px] font-bold " +
        statusTone(value)
      }
    >
      {statusLabel(value)}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#DCE6E2] px-4 py-8 text-center text-[11px] text-[#81928C]">
      {label}
    </div>
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

  const parsedAmount = Number(amount || 0);
  const remaining = Math.max(0, props.available - parsedAmount);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/payouts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID()
          },
          body: JSON.stringify({
            amount: parsedAmount,
            currency: "BRL",
            destination: {
              type: "PIX",
              pixKey,
              pixKeyType: "AUTO",
              beneficiaryName
            },
            note
          })
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message || "Não foi possível solicitar o payout.");
      }

      await props.onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao solicitar payout."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#03110F]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[500px] rounded-[14px] border border-[#DEE7E3] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#13956B]">
              Wallet BRL
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-[-.035em]">
              Solicitar payout
            </h2>
            <p className="mt-1 text-[11px] text-[#748780]">
              Disponível: {brl(props.available)}
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71847D] hover:bg-[#F3F7F5]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
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
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[13px] outline-none focus:border-[#20D99A]"
              placeholder="0,00"
            />
          </Field>

          <Field label="Chave PIX">
            <input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[13px] outline-none focus:border-[#20D99A]"
              placeholder="CPF, CNPJ, email, telefone ou aleatória"
            />
          </Field>

          <Field label="Beneficiário">
            <input
              value={beneficiaryName}
              onChange={(event) => setBeneficiaryName(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 text-[13px] outline-none focus:border-[#20D99A]"
              placeholder="Nome do titular"
            />
          </Field>

          <Field label="Observação">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[76px] w-full rounded-xl border border-[#DCE6E2] bg-[#F9FBFA] px-3 py-3 text-[13px] outline-none focus:border-[#20D99A]"
              placeholder="Informação opcional"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#E1E9E6] bg-[#F8FBFA] p-3">
            <PayoutSummary label="Disponível" value={brl(props.available)} />
            <PayoutSummary label="Solicitado" value={brl(parsedAmount)} />
            <PayoutSummary label="Após payout" value={brl(remaining)} />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#D9EEE6] bg-[#EFFAF6] p-3 text-[10px] leading-5 text-[#38675A]">
            O pedido será colocado em validação operacional. Acompanhe o estado em Payouts.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="h-10 rounded-lg border border-[#DCE6E2] px-4 text-[11px] font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                busy ||
                parsedAmount <= 0 ||
                parsedAmount > props.available
              }
              className="flex h-10 items-center gap-2 rounded-lg bg-[#073A30] px-4 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {busy ? "A solicitar…" : "Solicitar payout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayoutSummary(props: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] text-[#748780]">{props.label}</span>
      <strong className="mt-1 block text-[11px]">{props.value}</strong>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-[#667A73]">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

function buildPerformance(
  payments: PaymentRow[],
  operations: {
    payments30d: number;
    successful30d: number;
    successRate30d: string | null;
  }
) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const successful = payments.filter((row) =>
    ["SUCCEEDED", "PAID", "CONFIRMED"].includes(row.status.toUpperCase())
  );
  const today = successful.filter(
    (row) => new Date(row.created_at).getTime() >= startToday.getTime()
  );

  const volumeToday = today.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const totalSuccessful = successful.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const averageTicket =
    successful.length > 0 ? totalSuccessful / successful.length : 0;
  const successRate =
    operations.successRate30d == null
      ? null
      : Number(operations.successRate30d);

  return {
    volumeToday,
    paymentCount30d: operations.payments30d,
    averageTicket,
    successRate: Number.isFinite(successRate) ? successRate : null,
    successful30d: operations.successful30d
  };
}

function buildMovements(
  payments: PaymentRow[],
  settlements: SettlementRow[],
  payouts: PayoutRow[]
): Movement[] {
  const paymentRows: Movement[] = payments.map((row) => ({
    id: "payment-" + row.id,
    reference: row.external_reference || compactId(row.id),
    origin: row.store_code || "PIX",
    type: "Recebimento PIX",
    status: row.status,
    date: row.created_at,
    value: Number(row.amount || 0),
    direction: "incoming"
  }));

  const releaseRows: Movement[] = settlements.map((row) => ({
    id: "settlement-" + row.id,
    reference: row.external_reference || compactId(row.id),
    origin: row.store_code || "Store",
    type: "Liberação",
    status: row.status,
    date: row.available_at || row.created_at,
    value: Number(row.net_brl || 0),
    direction: "incoming"
  }));

  const payoutRows: Movement[] = payouts.map((row) => ({
    id: "payout-" + row.id,
    reference: row.external_reference || compactId(row.id),
    origin: "Wallet BRL",
    type: "Payout",
    status: row.status,
    date: row.created_at,
    value: Number(row.amount || 0),
    direction: "outgoing"
  }));

  return [...paymentRows, ...releaseRows, ...payoutRows].sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

function statusLabel(value: string) {
  const normalized = value.toUpperCase();
  const labels: Record<string, string> = {
    ACTIVE: "Ativa",
    HEALTHY: "Online",
    SUCCEEDED: "Concluído",
    AVAILABLE: "Disponível",
    CONFIRMED: "Confirmado",
    PAID: "Pago",
    DELIVERED: "Entregue",
    PENDING: "Pendente",
    PENDING_PAYMENT: "Aguardando",
    APPROVAL_REQUIRED: "Em validação",
    APPROVED: "Aprovado",
    PROCESSING: "Processando",
    FAILED: "Falhou",
    REJECTED: "Rejeitado",
    CANCELED: "Cancelado",
    BLOCKED: "Bloqueado"
  };
  return labels[normalized] || value;
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
    block: "start"
  });
}
