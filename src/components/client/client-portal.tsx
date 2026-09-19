"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Building2,
  CircleDollarSign,
  GitBranch,
  KeyRound,
  Layers3,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type OverviewPayload = {
  success: true;
  data: {
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
    business: null | {
      merchant: {
        merchant_id: string;
        trade_name: string | null;
        merchant_status: string;
        tier_code: string;
      };
      stores: Array<Record<string, unknown>>;
      payments: Array<Record<string, unknown>>;
    };
    capabilities: {
      financialWritesEnabled: boolean;
      note: string;
    };
  };
};

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
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 8,
  }).format(number) + " " + symbol;
}

function shortId(value: string) {
  return value.length > 18 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

export function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload["data"] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<OverviewPayload["data"] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async (id: string) => {
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
      setError(cause instanceof Error ? cause.message : "Falha ao carregar conta.");
    } finally {
      setBusy(false);
    }
  }, [router]);

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
        if (active) setError(cause instanceof Error ? cause.message : "Falha de sessão.");
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    fetch("/api/client/accounts/" + encodeURIComponent(accountId) + "/overview", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        const payload = (await response.json()) as OverviewPayload;
        if (!response.ok) throw new Error("Não foi possível carregar a conta.");
        return payload.data;
      })
      .then((data) => {
        if (active && data) {
          setOverview(data);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar conta.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [accountId, router]);

  const activeAccess = useMemo(
    () => session?.accounts.find((account) => account.accountId === accountId),
    [session, accountId],
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#020B0D] text-[#F4F1E8]">
      <div className="sticky top-0 z-40 border-b border-white/8 bg-[#020B0D]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7">
          <BrandLogo className="text-[18px]" />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#20F29A]/18 bg-[#20F29A]/5 px-3 py-1.5 text-[9px] font-bold tracking-[.12em] text-[#72D5B5] sm:inline-flex">
              MVP CONTROLADO
            </span>
            <button onClick={signOut} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[10px] text-[#92A9A3] hover:border-white/20 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:py-9">
        <div className="grid gap-5 lg:grid-cols-[270px_1fr]">
          <aside className="h-fit rounded-[22px] border border-white/8 bg-[#061214] p-3 lg:sticky lg:top-24">
            <div className="px-3 pb-3 pt-2">
              <span className="text-[9px] uppercase tracking-[.15em] text-[#5E7770]">Conta conectada</span>
              <strong className="mt-1 block truncate text-[12px]">{session?.email || "—"}</strong>
            </div>

            <div className="space-y-2">
              {session?.accounts.map((account) => {
                const selected = account.accountId === accountId;
                const label =
                  account.accountType === "BUSINESS"
                    ? account.merchant?.trade_name || "Conta Business"
                    : "Conta Personal";
                return (
                  <button
                    key={account.accountId}
                    onClick={() => {
                      setBusy(true);
                      setAccountId(account.accountId);
                    }}
                    className={[
                      "w-full rounded-2xl border p-3 text-left transition",
                      selected
                        ? "border-[#20F29A]/25 bg-[#20F29A]/7"
                        : "border-white/7 bg-white/[.015] hover:border-white/14",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={selected ? "text-[#20F29A]" : "text-[#667F78]"}>
                        {account.accountType === "BUSINESS" ? <Building2 className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-[11px]">{label}</strong>
                        <span className="mt-1 block text-[8px] uppercase tracking-[.12em] text-[#607871]">
                          {account.accountType} · {account.role}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-t border-white/7 px-3 pt-4 text-[9px] leading-5 text-[#607871]">
              Operações de entrada, saída e câmbio permanecem bloqueadas no MVP enquanto os rails financeiros são validados.
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/8 bg-[linear-gradient(145deg,#071719,#041011)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#62BDA1]">
                  {activeAccess?.accountType === "BUSINESS" ? "BUSINESS CONTROL" : "PERSONAL OVERVIEW"}
                </span>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em]">
                  {activeAccess?.accountType === "BUSINESS"
                    ? activeAccess.merchant?.trade_name || "Conta Business"
                    : "Sua conta PiXBrasil"}
                </h1>
                <p className="mt-2 text-[11px] text-[#718A83]">
                  {shortId(accountId)} · acesso {activeAccess?.role || "—"}
                </p>
              </div>
              <button
                onClick={() => void loadOverview(accountId)}
                disabled={busy}
                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-[10px] text-[#91AAA3] hover:border-white/20"
              >
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-400/18 bg-red-400/5 p-4 text-[11px] text-red-200">{error}</div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Estado", overview?.account.status || "…", ShieldCheck],
                ["KYC", overview?.account.kyc_status || "…", KeyRound],
                ["Base", overview?.account.base_currency || "…", CircleDollarSign],
                ["Perfil", overview?.account.identity_level || "…", Layers3],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-2xl border border-white/8 bg-[#061214] p-4">
                  <div className="flex items-center justify-between text-[#647E76]">
                    <span className="text-[8px] font-bold uppercase tracking-[.14em]">{String(label)}</span>
                    <Icon className="h-4 w-4" />
                  </div>
                  <strong className="mt-4 block text-[15px] tracking-[-.02em]">{String(value)}</strong>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#D2A34E]/18 bg-[#D2A34E]/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D2A34E]" />
                <div>
                  <strong className="text-[11px] text-[#E2C47D]">Modo financeiro protegido</strong>
                  <p className="mt-1 text-[9px] leading-5 text-[#8D826A]">
                    {overview?.capabilities.note || "Leituras operacionais disponíveis; writes financeiros bloqueados."}
                  </p>
                </div>
              </div>
            </div>

            <section className="grid gap-3 lg:grid-cols-3">
              {[
                ["Receber", ArrowDownToLine],
                ["Enviar", ArrowUpFromLine],
                ["Converter", ArrowRight],
              ].map(([label, Icon]) => (
                <button key={String(label)} disabled className="flex min-h-20 cursor-not-allowed items-center gap-3 rounded-2xl border border-white/7 bg-white/[.018] px-4 text-left opacity-55">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.035] text-[#607871]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <strong className="block text-[10px]">{String(label)}</strong>
                    <span className="mt-1 block text-[8px] text-[#607871]">Disponível após ativação</span>
                  </div>
                </button>
              ))}
            </section>

            {activeAccess?.accountType === "INDIVIDUAL" ? (
              <PersonalView overview={overview} busy={busy} />
            ) : (
              <BusinessView overview={overview} busy={busy} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PersonalView({ overview, busy }: { overview: OverviewPayload["data"] | null; busy: boolean }) {
  return (
    <>
      <Panel title="Wallets" subtitle="Saldos por ativo e rede" icon={WalletCards}>
        {busy && !overview ? <Loading /> : overview?.wallets.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {overview.wallets.map((wallet) => (
              <div key={wallet.wallet_id} className="rounded-2xl border border-white/7 bg-[#030D0F] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-[12px]">{wallet.symbol}</strong>
                    <span className="mt-1 block text-[8px] uppercase tracking-[.1em] text-[#607871]">{wallet.network}</span>
                  </div>
                  <span className="rounded-full border border-white/8 px-2 py-1 text-[7px] text-[#78918A]">{wallet.wallet_status}</span>
                </div>
                <strong className="mt-5 block text-[18px] tracking-[-.03em]">{moneyLike(wallet.available, wallet.symbol)}</strong>
                <div className="mt-3 flex gap-3 text-[8px] text-[#607871]">
                  <span>Pending {moneyLike(wallet.pending, wallet.symbol)}</span>
                  <span>Reserved {moneyLike(wallet.reserved, wallet.symbol)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty label="Nenhuma wallet disponível nesta conta." />}
      </Panel>

      <Panel title="Atividade" subtitle="Últimas transações do Financial Core" icon={Activity}>
        <TransactionList transactions={overview?.transactions || []} />
      </Panel>
    </>
  );
}

function BusinessView({ overview, busy }: { overview: OverviewPayload["data"] | null; busy: boolean }) {
  const business = overview?.business;
  return (
    <>
      <Panel title="Stores" subtitle="Routing e liberação por operação" icon={Store}>
        {busy && !overview ? <Loading /> : business?.stores?.length ? (
          <div className="grid gap-2 xl:grid-cols-2">
            {business.stores.map((store, index) => (
              <div key={String(store.id ?? index)} className="rounded-2xl border border-white/7 bg-[#030D0F] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-[12px]">{String(store.name ?? store.code ?? "Store")}</strong>
                    <span className="mt-1 block text-[8px] uppercase tracking-[.1em] text-[#607871]">{String(store.code ?? "—")}</span>
                  </div>
                  <span className="rounded-full border border-[#20F29A]/18 bg-[#20F29A]/5 px-2 py-1 text-[7px] text-[#78D5B8]">{String(store.routing_mode ?? "—")}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[8px]">
                  <Fact label="Provider" value={String(store.provider_code ?? "—")} />
                  <Fact label="Gateway" value={String(store.gateway_alias ?? "—")} />
                  <Fact label="Release" value={String(store.release_profile ?? "—")} />
                  <Fact label="Class" value={String(store.release_class ?? "—")} />
                </div>
              </div>
            ))}
          </div>
        ) : <Empty label="Nenhuma Store vinculada a esta conta." />}
      </Panel>

      <Panel title="PIX Activity" subtitle="PaymentIntents recentes do merchant" icon={GitBranch}>
        {business?.payments?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[9px]">
              <thead className="text-[#607871]">
                <tr className="border-b border-white/8">
                  <th className="px-3 py-3 font-semibold">Reference</th>
                  <th className="px-3 py-3 font-semibold">Store</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {business.payments.map((payment, index) => (
                  <tr key={String(payment.id ?? index)} className="border-b border-white/5 text-[#9CB0AA]">
                    <td className="px-3 py-3">{String(payment.external_reference ?? "—")}</td>
                    <td className="px-3 py-3">{String(payment.store_code ?? "—")}</td>
                    <td className="px-3 py-3">{String(payment.amount ?? "—")} {String(payment.currency ?? "")}</td>
                    <td className="px-3 py-3">{String(payment.status ?? "—")}</td>
                    <td className="px-3 py-3">{payment.created_at ? new Date(String(payment.created_at)).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty label="Nenhum PaymentIntent criado ainda." />}
      </Panel>
    </>
  );
}

function Panel({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Store; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/8 bg-[#061214]">
      <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
        <div>
          <strong className="block text-[12px]">{title}</strong>
          <span className="mt-1 block text-[8px] text-[#607871]">{subtitle}</span>
        </div>
        <Icon className="h-4 w-4 text-[#6A867E]" />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function TransactionList({ transactions }: { transactions: OverviewPayload["data"]["transactions"] }) {
  if (!transactions.length) return <Empty label="Ainda não há transações nesta conta." />;
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-[#030D0F] px-4 py-3">
          <div>
            <strong className="text-[10px]">{tx.type}</strong>
            <span className="mt-1 block text-[8px] text-[#607871]">{new Date(tx.created_at).toLocaleString("pt-BR")} · {shortId(tx.id)}</span>
          </div>
          <div className="text-right">
            <strong className="text-[10px]">{moneyLike(tx.amount, tx.symbol)}</strong>
            <span className="mt-1 block text-[8px] text-[#759088]">{tx.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[.015] p-3">
      <span className="block uppercase tracking-[.1em] text-[#58716A]">{label}</span>
      <strong className="mt-1 block truncate text-[#9FB4AE]">{value}</strong>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[9px] text-[#607871]">{label}</div>;
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 py-10 text-[9px] text-[#607871]"><LoaderCircle className="h-4 w-4 animate-spin" /> A carregar dados do Core…</div>;
}
