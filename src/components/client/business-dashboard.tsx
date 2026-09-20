"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Code2,
  ExternalLink,
  GitBranch,
  HelpCircle,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import type {
  AccountAccess,
  ClientOverview,
  ClientSessionData,
} from "./client-types";

type Section =
  | "overview"
  | "wallet"
  | "stores"
  | "payments"
  | "transactions"
  | "releases"
  | "payouts"
  | "routing"
  | "developers"
  | "settings";

const navItems: Array<{
  section: Section;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { section: "overview", label: "Visão geral", icon: LayoutDashboard },
  { section: "wallet", label: "Wallet BRL", icon: WalletCards },
  { section: "stores", label: "Stores", icon: Store },
  { section: "payments", label: "Pagamentos PIX", icon: QrCode },
  { section: "transactions", label: "Transações", icon: ArrowLeftRight },
  { section: "releases", label: "Liberações", icon: CalendarClock },
  { section: "payouts", label: "Payouts", icon: Send },
  { section: "routing", label: "Routing", icon: GitBranch },
  { section: "developers", label: "Desenvolvedores", icon: Code2 },
  { section: "settings", label: "Definições", icon: Settings2 },
];

function brl(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function shortId(value: string) {
  return value.length > 18 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
}

function statusTone(value: string | null | undefined) {
  const status = String(value ?? "").toUpperCase();
  if (
    [
      "ACTIVE",
      "AVAILABLE",
      "HEALTHY",
      "SUCCEEDED",
      "COMPLETED",
      "CONFIRMED",
      "PAID",
      "ENFORCED",
    ].includes(status)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (
    [
      "PENDING",
      "PENDING_PAYMENT",
      "PROVIDER_PENDING",
      "APPROVAL_REQUIRED",
      "PROCESSING",
      "NOT_STARTED",
    ].includes(status)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["FAILED", "REJECTED", "CANCELED", "DOWN"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold " +
        statusTone(value)
      }
    >
      {value || "—"}
    </span>
  );
}

export function BusinessDashboard({
  session,
  account,
  overview,
  busy,
  onRefresh,
  onAccountChange,
  onSignOut,
}: {
  session: ClientSessionData;
  account: AccountAccess;
  overview: ClientOverview;
  busy: boolean;
  onRefresh: () => void;
  onAccountChange: (accountId: string) => void;
  onSignOut: () => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutRail, setPayoutRail] = useState<"PIX" | "CRYPTO">("PIX");
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutResult, setPayoutResult] = useState<{
    payoutId: string;
    telegramUrl: string | null;
    amount: number;
  } | null>(null);

  const business = overview.business;
  const wallet = overview.wallets.find((row) => row.asset_code === "BRL");
  const available = Number(wallet?.available ?? 0);
  const pending = Number(wallet?.pending ?? 0);
  const reserved = Number(wallet?.reserved ?? 0);

  const selectedTitle =
    navItems.find((item) => item.section === section)?.label ?? "Visão geral";

  const today = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date());

  async function createPayout() {
    const amount = Number(payoutAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutError("Informe um valor válido.");
      return;
    }
    if (amount > available) {
      setPayoutError("O valor ultrapassa o saldo disponível.");
      return;
    }

    setPayoutBusy(true);
    setPayoutError("");
    setPayoutResult(null);

    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(account.accountId) +
          "/payout-tickets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "portal-" + crypto.randomUUID(),
          },
          body: JSON.stringify({ amount, rail: payoutRail }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: {
          payoutId: string;
          telegramUrl: string | null;
          amount: number;
        };
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.message || "Não foi possível criar o ticket.");
      }

      setPayoutResult(payload.data);
      setPayoutAmount("");
      onRefresh();
    } catch (cause) {
      setPayoutError(
        cause instanceof Error ? cause.message : "Falha ao criar payout.",
      );
    } finally {
      setPayoutBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#0d1b1a]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-white/8 bg-[linear-gradient(180deg,#031d19_0%,#021713_100%)] text-white lg:flex">
        <div className="flex h-[74px] items-center border-b border-white/8 px-5">
          <BrandLogo className="text-[20px]" />
        </div>

        <div className="p-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#20F29A]/12 text-[#20F29A]">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[12px]">
                  {business?.merchant.trade_name || "Business"}
                </strong>
                <span className="mt-1 block truncate text-[9px] text-white/45">
                  {business?.merchant.tier_code || "BUSINESS"} · {account.role}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-white/40" />
            </div>

            {session.accounts.length > 1 ? (
              <div className="mt-3 space-y-1 border-t border-white/8 pt-3">
                {session.accounts.map((item) => (
                  <button
                    key={item.accountId}
                    onClick={() => onAccountChange(item.accountId)}
                    className={[
                      "w-full rounded-lg px-2 py-2 text-left text-[9px] transition",
                      item.accountId === account.accountId
                        ? "bg-[#20F29A]/10 text-[#8ff4cb]"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80",
                    ].join(" ")}
                  >
                    {item.accountType === "BUSINESS"
                      ? item.merchant?.trade_name || "Business"
                      : "Conta Personal"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-1 flex-1 overflow-y-auto px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.section;
            return (
              <button
                key={item.section}
                onClick={() => setSection(item.section)}
                className={[
                  "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium transition",
                  active
                    ? "bg-[#20F29A]/13 text-[#8ff4cb] shadow-[inset_2px_0_0_#20F29A]"
                    : "text-white/62 hover:bg-white/[.045] hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3">
          <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#20F29A]">
              PiXBrasil Business
            </span>
            <p className="mt-2 text-[10px] leading-5 text-white/48">
              PIX, Stores, routing, liberações e payouts numa única operação.
            </p>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#20F29A]" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-[#dce4e1] bg-white/94 backdrop-blur-xl">
          <div className="flex h-[74px] items-center gap-4 px-4 sm:px-6 lg:px-7">
            <button
              onClick={() => setSection("overview")}
              className="lg:hidden"
              aria-label="Visão geral"
            >
              <BrandLogo className="text-[17px]" />
            </button>

            <div className="hidden h-10 max-w-[720px] flex-1 items-center gap-3 rounded-xl border border-[#d8e0de] bg-[#fbfcfc] px-4 text-[#7a8985] md:flex">
              <Search className="h-4 w-4" />
              <span className="text-[11px]">
                Buscar transações, Stores, referências…
              </span>
              <span className="ml-auto rounded-md border border-[#dce4e1] bg-white px-2 py-1 text-[8px]">
                Ctrl K
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Link
                href="/docs"
                className="hidden items-center gap-2 text-[10px] font-medium text-[#5d6b68] sm:flex"
              >
                <HelpCircle className="h-4 w-4" />
                Ajuda
              </Link>
              <button className="relative rounded-lg p-2 text-[#52625e]">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
              </button>
              <div className="hidden h-8 w-px bg-[#e4e9e7] sm:block" />
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a3d34] text-[10px] font-bold text-white">
                  {String(session.email ?? "PB")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden xl:block">
                  <strong className="block max-w-[150px] truncate text-[10px]">
                    {business?.merchant.trade_name || "Minha conta"}
                  </strong>
                  <span className="mt-0.5 block text-[8px] text-[#86938f]">
                    PiXBrasil Business
                  </span>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="rounded-lg p-2 text-[#65736f] hover:bg-[#f3f6f5]"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-[#edf1ef] px-4 py-2 lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.section}
                onClick={() => setSection(item.section)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold",
                  section === item.section
                    ? "bg-[#0b5e4f] text-white"
                    : "bg-[#eef3f1] text-[#5f706b]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-7 lg:py-7">
          {section === "overview" ? (
            <OverviewSection
              overview={overview}
              walletAvailable={available}
              walletPending={pending}
              walletReserved={reserved}
              today={today}
              busy={busy}
              onRefresh={onRefresh}
              onOpenPayout={() => setPayoutOpen(true)}
              onSection={setSection}
            />
          ) : (
            <SectionView
              section={section}
              title={selectedTitle}
              overview={overview}
              available={available}
              onOpenPayout={() => setPayoutOpen(true)}
              onRefresh={onRefresh}
            />
          )}
        </main>
      </div>

      {payoutOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[470px] rounded-[24px] border border-black/5 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[.14em] text-[#0b8b70]">
                  Payout manual
                </span>
                <h2 className="mt-1 text-xl font-semibold tracking-[-.035em]">
                  Abrir ticket de payout
                </h2>
                <p className="mt-2 text-[10px] leading-5 text-[#74837f]">
                  O valor é reservado imediatamente na Wallet BRL. O
                  processamento é concluído pelo desk operacional via Telegram.
                </p>
              </div>
              <button
                onClick={() => {
                  setPayoutOpen(false);
                  setPayoutResult(null);
                  setPayoutError("");
                }}
                className="rounded-lg p-2 text-[#7b8985] hover:bg-[#f2f5f4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f4f8f6] p-4">
              <span className="text-[9px] text-[#71827d]">Disponível</span>
              <strong className="mt-1 block text-2xl tracking-[-.04em]">
                {brl(available)}
              </strong>
            </div>

            {!payoutResult ? (
              <>
                <label className="mt-5 block">
                  <span className="mb-2 block text-[9px] font-semibold text-[#576963]">
                    Valor do payout
                  </span>
                  <input
                    inputMode="decimal"
                    value={payoutAmount}
                    onChange={(event) => setPayoutAmount(event.target.value)}
                    placeholder="0,00"
                    className="h-12 w-full rounded-xl border border-[#dce4e1] px-4 text-[13px] outline-none focus:border-[#1bcf9d] focus:ring-4 focus:ring-[#20F29A]/10"
                  />
                </label>

                <div className="mt-4">
                  <span className="mb-2 block text-[9px] font-semibold text-[#576963]">
                    Rail solicitado
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["PIX", "CRYPTO"] as const).map((rail) => (
                      <button
                        key={rail}
                        onClick={() => setPayoutRail(rail)}
                        className={[
                          "rounded-xl border px-4 py-3 text-[10px] font-semibold",
                          payoutRail === rail
                            ? "border-[#16b98c] bg-[#effbf6] text-[#08785f]"
                            : "border-[#dce4e1] text-[#667771]",
                        ].join(" ")}
                      >
                        {rail === "PIX" ? "PIX / Banco" : "Crypto"}
                      </button>
                    ))}
                  </div>
                </div>

                {payoutError ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] text-red-700">
                    {payoutError}
                  </div>
                ) : null}

                <button
                  onClick={() => void createPayout()}
                  disabled={payoutBusy || available <= 0}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0a7d65] text-[11px] font-bold text-white transition hover:bg-[#086b57] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {payoutBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Criar ticket e reservar saldo
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <strong className="text-[11px] text-emerald-800">
                      Ticket criado e saldo reservado
                    </strong>
                    <p className="mt-1 text-[9px] leading-5 text-emerald-700">
                      {shortId(payoutResult.payoutId)} · {brl(payoutResult.amount)}
                    </p>
                  </div>
                </div>
                {payoutResult.telegramUrl ? (
                  <a
                    href={payoutResult.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#229ED9] text-[10px] font-bold text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Continuar no Telegram
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OverviewSection({
  overview,
  walletAvailable,
  walletPending,
  walletReserved,
  today,
  busy,
  onRefresh,
  onOpenPayout,
  onSection,
}: {
  overview: ClientOverview;
  walletAvailable: number;
  walletPending: number;
  walletReserved: number;
  today: string;
  busy: boolean;
  onRefresh: () => void;
  onOpenPayout: () => void;
  onSection: (section: Section) => void;
}) {
  const business = overview.business;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#17836d]">
            PiXBrasil Business
          </span>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-.045em] sm:text-[32px]">
            Visão geral financeira
          </h1>
          <p className="mt-1 text-[11px] text-[#6e7f7a]">
            Recursos, recebíveis por Store, gateways e operação PIX.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-[#7a8985]">
          <span>{today}</span>
          <button
            onClick={onRefresh}
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-xl border border-[#d9e2df] bg-white px-3 font-semibold text-[#536660]"
          >
            <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Atualizar
          </button>
        </div>
      </div>

      <section className="grid gap-3 xl:grid-cols-[1.55fr_.62fr_.62fr]">
        <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#063f36_0%,#052e29_55%,#03241f_100%)] p-5 text-white shadow-[0_16px_50px_rgba(3,42,36,.18)] sm:p-6">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#20F29A]/8 blur-2xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_260px]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20F29A]/12 text-[#20F29A]">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[.13em] text-white/70">
                    Wallet BRL Empresarial
                  </span>
                  <p className="mt-0.5 text-[9px] text-white/45">
                    Disponível para payout
                  </p>
                </div>
              </div>

              <strong className="mt-5 block text-[38px] font-semibold tracking-[-.05em] sm:text-[46px]">
                {brl(walletAvailable)}
              </strong>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => onSection("payments")}
                  className="flex h-9 items-center gap-2 rounded-lg bg-[#20F29A] px-4 text-[10px] font-bold text-[#03251e]"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Pagamentos PIX
                </button>
                <button
                  onClick={onOpenPayout}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/22 bg-white/[.035] px-4 text-[10px] font-semibold text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                  Solicitar payout
                </button>
                <button
                  onClick={() => onSection("developers")}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/22 bg-white/[.035] px-4 text-[10px] font-semibold text-white"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  API & Webhooks
                </button>
              </div>
            </div>

            <div className="flex items-center border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <ShieldCheck className="h-6 w-6 text-[#82e8c7]" />
                <strong className="mt-3 block text-[11px]">
                  Operação por Store
                </strong>
                <p className="mt-1 text-[9px] leading-5 text-white/50">
                  Routing, provider e política de liberação são aplicados
                  individualmente a cada Store.
                </p>
              </div>
            </div>
          </div>
        </div>

        <MetricCard
          icon={CalendarClock}
          label="A liberar"
          value={brl(walletPending)}
          hint="Recebíveis aguardando disponibilidade."
          tone="amber"
          onClick={() => onSection("releases")}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Reservado"
          value={brl(walletReserved)}
          hint="Payouts em processamento ou reservas."
          tone="blue"
          onClick={() => onSection("payouts")}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card
          title="Liberações por Store"
          subtitle="Disponibilidade financeira por operação"
          action="Ver Stores"
          onAction={() => onSection("stores")}
          icon={Store}
        >
          <StoreReleaseTable
            rows={business?.storeFinancials ?? []}
            stores={business?.stores ?? []}
          />
        </Card>

        <Card
          title="Gateway PIX"
          subtitle="Providers e routing"
          action="Routing"
          onAction={() => onSection("routing")}
          icon={GitBranch}
        >
          <GatewayGrid rows={business?.gateways ?? []} />
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card
          title="Movimentações recentes"
          subtitle="Entradas e saídas contabilizadas"
          action="Ver todas"
          onAction={() => onSection("transactions")}
          icon={Activity}
        >
          <RecentTransactions rows={overview.transactions.slice(0, 8)} />
        </Card>

        <Card
          title="Fluxo de caixa · 30 dias"
          subtitle="Entradas líquidas e payouts"
          action="Detalhes"
          onAction={() => onSection("wallet")}
          icon={CircleDollarSign}
        >
          <CashflowChart rows={business?.cashflow30d ?? []} />
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
  hint: string;
  tone: "amber" | "blue";
  onClick: () => void;
}) {
  const styles =
    tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : "bg-sky-50 text-sky-600";
  return (
    <button
      onClick={onClick}
      className="rounded-[20px] border border-[#dce4e1] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className={"flex h-10 w-10 items-center justify-center rounded-xl " + styles}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="mt-5 block text-[11px] font-semibold text-[#293a36]">
        {label}
      </span>
      <strong className="mt-2 block text-[27px] tracking-[-.045em]">
        {value}
      </strong>
      <p className="mt-2 text-[9px] leading-5 text-[#788883]">{hint}</p>
    </button>
  );
}

function Card({
  title,
  subtitle,
  action,
  onAction,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  icon: typeof Store;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#dce4e1] bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-[#edf1ef] px-5 py-4">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-[#315e54]" />
          <div>
            <strong className="block text-[11px]">{title}</strong>
            <span className="mt-0.5 block text-[8px] text-[#84928e]">
              {subtitle}
            </span>
          </div>
        </div>
        {action && onAction ? (
          <button
            onClick={onAction}
            className="text-[9px] font-semibold text-[#1763d4]"
          >
            {action} →
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StoreReleaseTable({
  rows,
  stores,
}: {
  rows: NonNullable<ClientOverview["business"]>["storeFinancials"];
  stores: NonNullable<ClientOverview["business"]>["stores"];
}) {
  if (!rows.length) {
    return <EmptyState text="Nenhuma Store financeira encontrada." />;
  }

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="text-[8px] uppercase tracking-[.08em] text-[#8a9894]">
            <th className="px-2 py-3">Store</th>
            <th className="px-2 py-3">Rota</th>
            <th className="px-2 py-3">A liberar</th>
            <th className="px-2 py-3">Disponível</th>
            <th className="px-2 py-3">Próxima liberação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const store = stores.find((item) => item.id === row.store_id);
            return (
              <tr key={row.store_id} className="border-t border-[#edf1ef]">
                <td className="px-2 py-3">
                  <strong className="block text-[10px]">{row.store_name}</strong>
                  <span className="mt-0.5 block text-[8px] text-[#84928e]">
                    {row.store_code}
                  </span>
                </td>
                <td className="px-2 py-3 text-[9px] text-[#52645f]">
                  {store?.provider_code || "—"} · {store?.release_class || "—"}
                </td>
                <td className="px-2 py-3 text-[9px] font-semibold text-amber-700">
                  {brl(row.pending_brl)}
                </td>
                <td className="px-2 py-3 text-[9px] font-semibold text-emerald-700">
                  {brl(row.available_brl)}
                </td>
                <td className="px-2 py-3 text-[9px] text-[#62736e]">
                  {row.next_release_at ? dateTime(row.next_release_at) : "Livre"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GatewayGrid({
  rows,
}: {
  rows: NonNullable<ClientOverview["business"]>["gateways"];
}) {
  if (!rows.length) {
    return <EmptyState text="Nenhum gateway associado." />;
  }

  return (
    <div className="grid gap-2 p-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.gateway_alias}
          className="rounded-xl border border-[#e2e8e6] bg-[#fbfcfc] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="text-[10px]">{row.provider_code}</strong>
              <span className="mt-0.5 block text-[8px] text-[#83918d]">
                {row.gateway_alias}
              </span>
            </div>
            <StatusPill value={row.health} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[8px] text-[#61726d]">
            <span>{row.latency_ms || 0} ms</span>
            <span>{row.routing_eligible ? "Routing ready" : "Observação"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentTransactions({
  rows,
}: {
  rows: ClientOverview["transactions"];
}) {
  if (!rows.length) return <EmptyState text="Ainda não há movimentações." />;
  return (
    <div className="divide-y divide-[#edf1ef] px-4 pb-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[1fr_auto] gap-3 py-3 sm:grid-cols-[1fr_120px_120px]"
        >
          <div>
            <strong className="block text-[9px]">
              {row.type === "FIAT_DEPOSIT" ? "Recebimento PIX" : "Payout / saída"}
            </strong>
            <span className="mt-1 block text-[8px] text-[#899692]">
              {shortId(row.id)} · {dateTime(row.created_at)}
            </span>
          </div>
          <span className="hidden self-center text-[9px] text-[#5f706b] sm:block">
            {row.status}
          </span>
          <strong
            className={
              "self-center text-right text-[10px] " +
              (row.type === "FIAT_WITHDRAWAL"
                ? "text-red-600"
                : "text-emerald-700")
            }
          >
            {row.type === "FIAT_WITHDRAWAL" ? "− " : "+ "}
            {brl(row.amount)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function CashflowChart({
  rows,
}: {
  rows: NonNullable<ClientOverview["business"]>["cashflow30d"];
}) {
  const values = rows.map((row) => ({
    incoming: Number(row.incoming_brl),
    outgoing: Number(row.outgoing_brl),
  }));
  const max = Math.max(1, ...values.flatMap((row) => [row.incoming, row.outgoing]));
  const cumulativePoints = values.reduce<number[]>((points, row) => {
    const previous = points.at(-1) ?? 0;
    return [...points, previous + row.incoming - row.outgoing];
  }, []);
  const maxCum = Math.max(1, ...cumulativePoints.map((value) => Math.abs(value)));

  if (!rows.length) return <EmptyState text="Sem dados de fluxo ainda." />;

  const width = 600;
  const height = 190;
  const pad = 22;
  const usable = width - pad * 2;
  const step = usable / Math.max(1, rows.length);
  const line = cumulativePoints
    .map((value, index) => {
      const x = pad + index * step + step / 2;
      const y = 115 - (value / maxCum) * 42;
      return (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
    })
    .join(" ");

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap gap-3 text-[8px] text-[#657671]">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#6b5cff]" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#55bde8]" /> Saídas
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#0a6d5b]" /> Fluxo líquido
        </span>
      </div>
      <svg viewBox={"0 0 " + width + " " + height} className="h-[190px] w-full">
        {[50, 90, 130, 170].map((y) => (
          <line
            key={y}
            x1="18"
            y1={y}
            x2="590"
            y2={y}
            stroke="#e9eeec"
            strokeWidth="1"
          />
        ))}
        {values.map((row, index) => {
          const x = pad + index * step;
          const incomingHeight = (row.incoming / max) * 70;
          const outgoingHeight = (row.outgoing / max) * 70;
          return (
            <g key={rows[index].day}>
              <rect
                x={x}
                y={170 - incomingHeight}
                width={Math.max(2, step * 0.28)}
                height={incomingHeight}
                rx="2"
                fill="#6b5cff"
                opacity=".82"
              />
              <rect
                x={x + step * 0.32}
                y={170 - outgoingHeight}
                width={Math.max(2, step * 0.28)}
                height={outgoingHeight}
                rx="2"
                fill="#55bde8"
                opacity=".82"
              />
            </g>
          );
        })}
        <path
          d={line}
          fill="none"
          stroke="#0a6d5b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function SectionView({
  section,
  title,
  overview,
  available,
  onOpenPayout,
  onRefresh,
}: {
  section: Section;
  title: string;
  overview: ClientOverview;
  available: number;
  onOpenPayout: () => void;
  onRefresh: () => void;
}) {
  const business = overview.business;
  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#17836d]">
            PiXBrasil Business
          </span>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-.045em]">
            {title}
          </h1>
        </div>
        <button
          onClick={onRefresh}
          className="flex h-9 items-center gap-2 rounded-xl border border-[#d9e2df] bg-white px-3 text-[9px] font-semibold text-[#536660]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {section === "wallet" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {overview.wallets.map((wallet) => (
            <div
              key={wallet.wallet_id}
              className="rounded-[18px] border border-[#dce4e1] bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-[12px]">{wallet.asset_code}</strong>
                  <span className="mt-1 block text-[8px] text-[#83918d]">
                    {wallet.network}
                  </span>
                </div>
                <StatusPill value={wallet.wallet_status} />
              </div>
              <strong className="mt-6 block text-[28px] tracking-[-.045em]">
                {wallet.asset_code === "BRL"
                  ? brl(wallet.available)
                  : wallet.available + " " + wallet.symbol}
              </strong>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[8px]">
                <MiniFact label="A liberar" value={wallet.pending} />
                <MiniFact label="Reservado" value={wallet.reserved} />
                <MiniFact label="Bloqueado" value={wallet.blocked} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {section === "stores" ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {business?.stores.map((store) => (
            <div
              key={store.id}
              className="rounded-[18px] border border-[#dce4e1] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-[12px]">{store.name}</strong>
                  <span className="mt-1 block text-[8px] text-[#82918d]">
                    {store.code}
                  </span>
                </div>
                <StatusPill value={store.status} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <MiniFact label="Provider" value={store.provider_code || "—"} />
                <MiniFact label="Gateway" value={store.gateway_alias || "—"} />
                <MiniFact label="Release" value={store.release_class || "—"} />
                <MiniFact label="Routing" value={store.routing_mode || "—"} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {section === "payments" ? (
        <DataTable
          columns={["Referência", "Store", "Valor", "Provider", "Estado", "Criado"]}
          rows={(business?.payments ?? []).map((row) => [
            row.external_reference || shortId(row.id),
            row.store_code || "—",
            brl(row.amount),
            row.provider_code || "—",
            <StatusPill key="status" value={row.status} />,
            dateTime(row.created_at),
          ])}
        />
      ) : null}

      {section === "transactions" ? (
        <DataTable
          columns={["Referência", "Tipo", "Estado", "Valor", "Taxas", "Criado"]}
          rows={overview.transactions.map((row) => [
            shortId(row.id),
            row.type,
            <StatusPill key="status" value={row.status} />,
            brl(row.amount),
            brl(row.fee_amount),
            dateTime(row.created_at),
          ])}
        />
      ) : null}

      {section === "releases" ? (
        <Card
          title="Liberações por Store"
          subtitle="Disponibilidade e próxima janela"
          icon={CalendarClock}
        >
          <StoreReleaseTable
            rows={business?.storeFinancials ?? []}
            stores={business?.stores ?? []}
          />
        </Card>
      ) : null}

      {section === "payouts" ? (
        <div className="space-y-4">
          <div className="rounded-[18px] border border-[#dce4e1] bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[9px] text-[#7c8b87]">
                  Disponível na Wallet BRL
                </span>
                <strong className="mt-1 block text-[30px] tracking-[-.045em]">
                  {brl(available)}
                </strong>
                <p className="mt-2 text-[9px] text-[#7a8a85]">
                  Payouts são processados pelo desk manual via Telegram nesta fase.
                </p>
              </div>
              <button
                onClick={onOpenPayout}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0a7d65] px-4 text-[10px] font-bold text-white"
              >
                <Send className="h-4 w-4" />
                Solicitar payout
              </button>
            </div>
          </div>
          <DataTable
            columns={["Ticket", "Valor", "Rail", "Estado", "Criado", "Pago"]}
            rows={(business?.payouts ?? []).map((row) => [
              shortId(row.id),
              brl(row.amount),
              String(row.destination_snapshot?.rail ?? "PIX"),
              <StatusPill key="status" value={row.status} />,
              dateTime(row.created_at),
              dateTime(row.paid_at || row.confirmed_at),
            ])}
          />
        </div>
      ) : null}

      {section === "routing" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(business?.stores ?? []).map((store) => (
            <div
              key={store.id}
              className="rounded-[18px] border border-[#dce4e1] bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <strong className="text-[12px]">{store.code}</strong>
                  <span className="mt-1 block text-[8px] text-[#7d8d88]">
                    {store.route_cost_profile}
                  </span>
                </div>
                <StatusPill value={store.routing_mode} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <MiniFact label="Provider" value={store.provider_code || "—"} />
                <MiniFact label="Health" value={store.provider_health || "—"} />
                <MiniFact label="Release" value={store.release_profile || "—"} />
                <MiniFact label="Classe" value={store.release_class || "—"} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {section === "developers" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["Documentação API", "/docs/api", "Quickstart, autenticação e cobranças PIX."],
            ["Webhooks", "/docs/webhooks", "Assinatura, eventos e handlers."],
            ["AI Setup Kit", "/docs/ai-setup", "Prompts prontos para GPT, Claude e agentes."],
            ["Tracking & UTM", "/docs/tracking", "UTMify, CAPI, Google e attribution bridge."],
          ].map(([label, href, copy]) => (
            <Link
              key={href}
              href={href}
              className="rounded-[18px] border border-[#dce4e1] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <Code2 className="h-5 w-5 text-[#0b8068]" />
                <ExternalLink className="h-4 w-4 text-[#9aa7a3]" />
              </div>
              <strong className="mt-5 block text-[13px]">{label}</strong>
              <p className="mt-2 text-[9px] leading-5 text-[#778782]">{copy}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {section === "settings" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[18px] border border-[#dce4e1] bg-white p-5">
            <strong className="text-[12px]">Conta Business</strong>
            <div className="mt-4 space-y-2">
              <SettingRow label="Account ID" value={overview.account.id} />
              <SettingRow label="Estado" value={overview.account.status} />
              <SettingRow label="KYC" value={overview.account.kyc_status} />
              <SettingRow label="Perfil" value={overview.account.policy_profile_code || "—"} />
              <SettingRow label="Plano" value={overview.account.pricing_plan_code || "—"} />
            </div>
          </div>
          <div className="rounded-[18px] border border-[#dce4e1] bg-white p-5">
            <strong className="text-[12px]">Operação</strong>
            <div className="mt-4 space-y-2">
              <SettingRow
                label="PIX S2S"
                value={overview.capabilities.depositsEnabled ? "PRODUCTION" : "DISABLED"}
              />
              <SettingRow
                label="Payout"
                value={overview.capabilities.payoutMode}
              />
              <SettingRow
                label="Câmbio"
                value={overview.capabilities.exchangeEnabled ? "ENABLED" : "DISABLED"}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#dce4e1] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-[#e8eeec] bg-[#fbfcfc]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[8px] font-bold uppercase tracking-[.08em] text-[#84938e]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={index} className="border-b border-[#edf1ef]">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-3 text-[9px] text-[#52635e]"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState text="Nenhum registo disponível." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f5f8f7] p-3">
      <span className="block text-[7px] font-bold uppercase tracking-[.08em] text-[#84938e]">
        {label}
      </span>
      <strong className="mt-1 block truncate text-[9px] text-[#40534d]">
        {value}
      </strong>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f9f8] px-3 py-3">
      <span className="text-[9px] text-[#7b8985]">{label}</span>
      <strong className="max-w-[65%] truncate text-[9px]">{value}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center px-4 text-center text-[9px] text-[#84938e]">
      {text}
    </div>
  );
}
