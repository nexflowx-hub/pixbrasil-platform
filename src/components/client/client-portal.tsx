"use client";

import {
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { BusinessDashboard } from "./business-dashboard";
import type {
  ClientOverview,
  ClientSessionData,
} from "./client-types";

type SessionPayload = {
  success: true;
  data: ClientSessionData;
};

type OverviewPayload = {
  success: true;
  data: ClientOverview;
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
  return (
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 8,
    }).format(number) +
    " " +
    symbol
  );
}

export function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState<ClientSessionData | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(
    async (id: string) => {
      if (!id) return;
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
        if (!response.ok) {
          throw new Error("Não foi possível carregar a conta.");
        }
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
        if (!response.ok) {
          throw new Error("Não foi possível carregar a sessão.");
        }
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
    void loadOverview(accountId);
  }, [accountId, loadOverview]);

  const activeAccount = useMemo(
    () => session?.accounts.find((account) => account.accountId === accountId),
    [session, accountId],
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (!session || !activeAccount || !overview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-5">
        <div className="w-full max-w-md rounded-[24px] border border-[#dce4e1] bg-white p-7 text-center shadow-xl">
          <BrandLogo className="mx-auto text-[20px]" />
          {error ? (
            <>
              <p className="mt-6 text-[11px] leading-6 text-red-600">{error}</p>
              <button
                onClick={() => {
                  setBusy(true);
                  if (accountId) void loadOverview(accountId);
                }}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#0a7d65] px-4 text-[10px] font-bold text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
            </>
          ) : (
            <div className="mt-7 flex items-center justify-center gap-2 text-[10px] text-[#6f817b]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              A carregar o Financial Core…
            </div>
          )}
        </div>
      </main>
    );
  }

  if (activeAccount.accountType === "BUSINESS") {
    return (
      <BusinessDashboard
        session={session}
        account={activeAccount}
        overview={overview}
        busy={busy}
        onRefresh={() => {
          setBusy(true);
          void loadOverview(accountId);
        }}
        onAccountChange={(id) => {
          setBusy(true);
          setOverview(null);
          setAccountId(id);
        }}
        onSignOut={() => void signOut()}
      />
    );
  }

  return (
    <PersonalDashboard
      session={session}
      overview={overview}
      busy={busy}
      onRefresh={() => {
        setBusy(true);
        void loadOverview(accountId);
      }}
      onSignOut={() => void signOut()}
      onAccountChange={(id) => {
        setBusy(true);
        setOverview(null);
        setAccountId(id);
      }}
    />
  );
}

function PersonalDashboard({
  session,
  overview,
  busy,
  onRefresh,
  onSignOut,
  onAccountChange,
}: {
  session: ClientSessionData;
  overview: ClientOverview;
  busy: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  onAccountChange: (id: string) => void;
}) {
  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#10201c]">
      <header className="border-b border-[#dce4e1] bg-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-7">
          <BrandLogo className="text-[18px]" />
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="rounded-lg p-2 text-[#60736d] hover:bg-[#f2f5f4]"
              aria-label="Atualizar"
            >
              <RefreshCw
                className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            </button>
            <button
              onClick={onSignOut}
              className="rounded-lg p-2 text-[#60736d] hover:bg-[#f2f5f4]"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#17836d]">
              PiXBrasil Personal
            </span>
            <h1 className="mt-1 text-[30px] font-semibold tracking-[-.045em]">
              Minha conta
            </h1>
            <p className="mt-1 text-[10px] text-[#74857f]">
              Wallets, atividade e estado da sua conta.
            </p>
          </div>
          {session.accounts.length > 1 ? (
            <select
              value={overview.account.id}
              onChange={(event) => onAccountChange(event.target.value)}
              className="h-10 rounded-xl border border-[#dce4e1] bg-white px-3 text-[10px]"
            >
              {session.accounts.map((account) => (
                <option key={account.accountId} value={account.accountId}>
                  {account.accountType === "BUSINESS"
                    ? account.merchant?.trade_name || "Business"
                    : "Personal"}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Estado", overview.account.status],
            ["KYC", overview.account.kyc_status],
            ["Moeda base", overview.account.base_currency],
            ["Perfil", overview.account.identity_level],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[18px] border border-[#dce4e1] bg-white p-5"
            >
              <span className="text-[8px] font-bold uppercase tracking-[.1em] text-[#82928d]">
                {label}
              </span>
              <strong className="mt-3 block text-[15px]">{value}</strong>
            </div>
          ))}
        </section>

        <section className="mt-4 overflow-hidden rounded-[18px] border border-[#dce4e1] bg-white">
          <div className="flex items-center gap-3 border-b border-[#edf1ef] px-5 py-4">
            <WalletCards className="h-4 w-4 text-[#0a7d65]" />
            <div>
              <strong className="block text-[11px]">Wallets</strong>
              <span className="text-[8px] text-[#82918d]">
                Saldos por ativo e rede
              </span>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {overview.wallets.length ? (
              overview.wallets.map((wallet) => (
                <div
                  key={wallet.wallet_id}
                  className="rounded-2xl border border-[#e2e8e6] bg-[#fbfcfc] p-4"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-[11px]">{wallet.asset_code}</strong>
                    <span className="text-[8px] text-[#82918d]">
                      {wallet.network}
                    </span>
                  </div>
                  <strong className="mt-5 block text-[20px] tracking-[-.04em]">
                    {moneyLike(wallet.available, wallet.symbol)}
                  </strong>
                  <div className="mt-3 flex gap-3 text-[8px] text-[#7c8c87]">
                    <span>Pending {wallet.pending}</span>
                    <span>Reserved {wallet.reserved}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-10 text-center text-[9px] text-[#82918d]">
                Nenhuma wallet disponível.
              </div>
            )}
          </div>
        </section>

        {overview.account.kyc_status !== "VERIFIED" ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <strong className="text-[10px] text-amber-800">
                Verificação de identidade pendente
              </strong>
              <p className="mt-1 text-[9px] leading-5 text-amber-700">
                Algumas capacidades dependem da conclusão do processo de KYC.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
