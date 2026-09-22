"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import type { DashboardProps } from "@/components/client/client-types";
import {
  brl,
  compactId,
  statusTone
} from "@/components/client/client-types";

export function PersonalDashboard(props: DashboardProps) {
  const brlWallet = props.overview?.wallets.find(
    (wallet) => wallet.symbol === "BRL"
  );
  const available = Number(brlWallet?.available ?? 0);

  return (
    <main className="min-h-screen bg-[#F4F7F6] text-[#0A1614]">
      <header className="sticky top-0 z-30 border-b border-[#DCE6E2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5">
          <BrandLogo className="text-[18px]" />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#DCE6E2] bg-[#F7FAF9] px-3 py-1.5 text-[8px] font-semibold text-[#577068] sm:inline-flex">
              PiXBrasil Particular
            </span>
            <button
              onClick={() => void props.signOut()}
              className="flex h-9 items-center gap-2 rounded-xl border border-[#DCE6E2] bg-white px-3 text-[9px] text-[#50625D] hover:bg-[#F7FAF9]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#13956B]">
              Conta Particular
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-[-.045em]">
              Seu dinheiro, numa visão simples.
            </h1>
            <p className="mt-2 text-[10px] text-[#71847D]">
              {props.activeAccess
                ? "Conta " + compactId(props.activeAccess.accountId)
                : "A carregar conta…"}
            </p>
          </div>

          <button
            onClick={() => void props.refresh()}
            disabled={props.busy}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6E2] bg-white px-3 text-[9px] font-semibold text-[#50625D] hover:bg-[#F7FAF9] disabled:opacity-50"
          >
            <RefreshCw
              className={
                props.busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
              }
            />
            Atualizar
          </button>
        </section>

        {props.error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-[9px] text-red-700">
            {props.error}
          </div>
        ) : null}

        <section className="mt-5 grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
          <article className="overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_90%_100%,rgba(20,230,161,.18),transparent_35%),linear-gradient(125deg,#073A30,#04251F)] p-5 text-white shadow-[0_14px_36px_rgba(5,52,42,.13)] sm:p-6">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#B7D5CD]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0C5748] text-[#17E7A4]">
                <WalletCards className="h-5 w-5" />
              </span>
              Saldo disponível
            </div>

            <strong className="mt-5 block text-[40px] font-bold tracking-[-.055em] sm:text-[48px]">
              {brl(available)}
            </strong>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="/docs/api"
                className="flex h-10 items-center gap-2 rounded-lg bg-[#14E6A1] px-4 text-[9px] font-extrabold text-[#032018] hover:bg-[#34F0B1]"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Receber PIX
              </a>
              <button
                disabled={!props.overview?.capabilities.withdrawalsEnabled}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/25 px-4 text-[9px] font-semibold hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  props.overview?.capabilities.withdrawalsEnabled
                    ? "Enviar"
                    : "Operação ainda não disponível nesta conta"
                }
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Enviar
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-[#DCE6E2] bg-white p-5 shadow-[0_8px_24px_rgba(28,63,54,.035)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.12em] text-[#71847D]">
                  Segurança
                </span>
                <strong className="mt-2 block text-[15px]">
                  Conta protegida
                </strong>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FBF4] text-[#0D9B68]">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-5 space-y-2 text-[9px] text-[#667A73]">
              <div className="flex items-center justify-between rounded-lg bg-[#F8FBFA] px-3 py-2.5">
                <span>Estado</span>
                <strong>{props.overview?.account.status || "—"}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#F8FBFA] px-3 py-2.5">
                <span>KYC</span>
                <strong>{props.overview?.account.kyc_status || "—"}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#F8FBFA] px-3 py-2.5">
                <span>Nível</span>
                <strong>{props.overview?.account.identity_level || "—"}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-[.12em] text-[#71847D]">
                Ativos
              </span>
              <h2 className="mt-1 text-lg font-bold">Suas wallets</h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {props.overview?.wallets.length ? (
              props.overview.wallets.map((wallet) => (
                <article
                  key={wallet.wallet_id}
                  className="rounded-2xl border border-[#DCE6E2] bg-white p-4 shadow-[0_8px_24px_rgba(28,63,54,.035)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF7F3] text-[#176B53]">
                      <CircleDollarSign className="h-4 w-4" />
                    </span>
                    <span className="rounded-full border border-[#DCE6E2] bg-[#F9FBFA] px-2 py-1 text-[7px] font-bold text-[#597068]">
                      {wallet.wallet_status}
                    </span>
                  </div>
                  <span className="mt-4 block text-[8px] uppercase tracking-[.1em] text-[#71847D]">
                    {wallet.asset_name}
                  </span>
                  <strong className="mt-2 block text-2xl tracking-[-.035em]">
                    {wallet.symbol === "BRL"
                      ? brl(wallet.available)
                      : wallet.available + " " + wallet.symbol}
                  </strong>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[8px] text-[#667A73]">
                    <span>
                      Pendente
                      <strong className="mt-1 block text-[#263B35]">
                        {wallet.pending}
                      </strong>
                    </span>
                    <span>
                      Reservado
                      <strong className="mt-1 block text-[#263B35]">
                        {wallet.reserved}
                      </strong>
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-[#DCE6E2] bg-white px-4 py-10 text-center text-[9px] text-[#81928C]">
                Nenhuma wallet disponível.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
          <article className="rounded-2xl border border-[#DCE6E2] bg-white shadow-[0_8px_24px_rgba(28,63,54,.035)]">
            <div className="flex items-center gap-2 border-b border-[#E7EEEB] px-4 py-3.5">
              <Activity className="h-4 w-4 text-[#184E42]" />
              <strong className="text-[10px]">Atividade recente</strong>
            </div>
            <div className="p-3">
              {props.overview?.transactions.length ? (
                <div className="space-y-2">
                  {props.overview.transactions.slice(0, 8).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 rounded-xl border border-[#E7EEEB] px-3 py-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F3] text-[#13956B]">
                        <Activity className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block text-[9px]">{row.type}</strong>
                        <span className="mt-1 block text-[7px] text-[#81928C]">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="block text-[10px]">
                          {row.symbol === "BRL"
                            ? brl(row.amount)
                            : row.amount + " " + row.symbol}
                        </strong>
                        <span
                          className={
                            "mt-1 inline-flex rounded-full border px-2 py-1 text-[7px] font-bold " +
                            statusTone(row.status)
                          }
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#DCE6E2] px-4 py-8 text-center text-[9px] text-[#81928C]">
                  Ainda não existem movimentações.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[#DCE6E2] bg-white p-4 shadow-[0_8px_24px_rgba(28,63,54,.035)]">
            <span className="text-[8px] font-bold uppercase tracking-[.12em] text-[#71847D]">
              Ações rápidas
            </span>
            <div className="mt-3 space-y-2">
              <a
                href="/docs"
                className="flex min-h-14 items-center justify-between rounded-xl border border-[#E1E9E6] px-3 hover:bg-[#F8FBFA]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F3] text-[#13956B]">
                    <KeyRound className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <strong className="block text-[9px]">Ajuda</strong>
                    <span className="text-[7px] text-[#81928C]">
                      Central PiXBrasil
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#71847D]" />
              </a>
              <div className="flex min-h-14 items-center justify-between rounded-xl border border-[#E1E9E6] px-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F3] text-[#13956B]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <strong className="block text-[9px]">Sessão segura</strong>
                    <span className="text-[7px] text-[#81928C]">
                      Proteção ativa
                    </span>
                  </span>
                </span>
                <span className="h-2 w-2 rounded-full bg-[#10C98A]" />
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
