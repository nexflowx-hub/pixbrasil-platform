"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BanknoteArrowUp,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Code2,
  Copy,
  GitBranch,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type StoreRow = {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
  currency?: string;
  gateway_alias?: string | null;
  provider_code?: string | null;
  provider_health?: string | null;
  provider_latency_ms?: number | null;
  release_profile?: string | null;
  release_class?: string | null;
  route_cost_profile?: string | null;
  routing_mode?: string | null;
  available_brl?: string;
  pending_brl?: string;
  reserved_brl?: string;
  next_available_at?: string | null;
  payment_count?: number;
  succeeded_count?: number;
};

type PaymentRow = {
  id?: string;
  external_reference?: string | null;
  amount?: string;
  currency?: string;
  status?: string;
  store_code?: string | null;
  provider_code?: string | null;
  gateway_alias?: string | null;
  provider_payment_id?: string | null;
  net_brl?: string | null;
  settlement_status?: string | null;
  available_at?: string | null;
  created_at?: string;
};

type PayoutRow = {
  id?: string;
  external_reference?: string | null;
  amount?: string;
  asset_code?: string;
  destination_type?: string | null;
  status?: string;
  created_at?: string;
  confirmed_at?: string | null;
};

type FlowRow = {
  day?: string;
  incoming_brl?: string;
  outgoing_brl?: string;
};

export type BusinessPortalOverview = {
  business: null | {
    merchant: {
      merchant_id: string;
      trade_name: string | null;
      merchant_status: string;
      tier_code: string;
    };
    wallet?: {
      wallet_id?: string;
      available?: string;
      pending?: string;
      reserved?: string;
      blocked?: string;
    } | null;
    finance?: {
      availableBrl?: number;
      pendingBrl?: number;
      reservedBrl?: number;
      blockedBrl?: number;
      paymentCount?: number;
      succeededCount?: number;
      successRate?: number;
    };
    stores?: StoreRow[];
    payments?: PaymentRow[];
    payouts?: PayoutRow[];
    flow30d?: FlowRow[];
  };
  capabilities: {
    financialWritesEnabled: boolean;
    pixCollectionEnabled?: boolean;
    payoutTicketsEnabled?: boolean;
    exchangeEnabled?: boolean;
    note: string;
  };
};

function brl(value: unknown) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function dateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusClass(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  if (
    ["ACTIVE", "HEALTHY", "AVAILABLE", "SUCCEEDED", "CONFIRMED", "PAID", "ENFORCED"].includes(
      normalized,
    )
  ) {
    return "border-[#20F29A]/20 bg-[#20F29A]/7 text-[#73D9B5]";
  }
  if (
    ["FAILED", "REJECTED", "CANCELED", "DOWN", "RECONCILIATION_REQUIRED"].includes(
      normalized,
    )
  ) {
    return "border-red-400/20 bg-red-400/6 text-red-200";
  }
  return "border-[#D8A447]/20 bg-[#D8A447]/7 text-[#D9BC72]";
}

export function BusinessDashboard({
  overview,
  accountId,
  busy,
  onRefresh,
}: {
  overview: BusinessPortalOverview | null;
  accountId: string;
  busy: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const business = overview?.business;
  const finance = business?.finance ?? {};
  const stores = business?.stores ?? [];
  const payments = business?.payments ?? [];
  const payouts = business?.payouts ?? [];
  const flow = business?.flow30d ?? [];

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState("");
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("EVP");

  const gatewayRows = useMemo(() => {
    const unique = new Map<string, StoreRow>();
    for (const store of stores) {
      const key = String(store.gateway_alias ?? store.provider_code ?? store.code);
      if (!unique.has(key)) unique.set(key, store);
    }
    return [...unique.values()];
  }, [stores]);

  const maxFlow = useMemo(() => {
    return Math.max(
      1,
      ...flow.flatMap((row) => [
        Number(row.incoming_brl ?? 0),
        Number(row.outgoing_brl ?? 0),
      ]),
    );
  }, [flow]);

  async function submitPayout(event: FormEvent) {
    event.preventDefault();
    setPayoutBusy(true);
    setPayoutError("");
    setPayoutSuccess("");

    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(accountId) +
          "/payout-tickets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(amount),
            assetCode: "BRL",
            rail: "PIX",
            destination: {
              keyType: pixKeyType,
              pixKey: pixKey.trim(),
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: { reference?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || "Não foi possível criar o ticket de payout.",
        );
      }

      setPayoutSuccess(
        "Ticket " +
          (payload.data?.reference ?? "") +
          " criado e saldo reservado para processamento.",
      );
      setAmount("");
      setPixKey("");
      await onRefresh();
    } catch (cause) {
      setPayoutError(
        cause instanceof Error ? cause.message : "Falha ao solicitar payout.",
      );
    } finally {
      setPayoutBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.55fr_.72fr_.72fr]">
        <article className="relative overflow-hidden rounded-[24px] border border-[#20F29A]/16 bg-[linear-gradient(135deg,#063229_0%,#06221F_52%,#041411_100%)] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#20F29A]/8 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#85DDBE]">
                  <WalletCards className="h-4 w-4" />
                  Wallet BRL Empresarial
                </span>
                <p className="mt-1 text-[9px] text-[#6E9F90]">
                  Disponível para payout
                </p>
              </div>
              <span className="rounded-full border border-[#20F29A]/20 bg-[#20F29A]/8 px-2.5 py-1 text-[8px] font-bold text-[#7CE2BE]">
                PROD
              </span>
            </div>

            <strong className="mt-6 block text-[36px] font-semibold tracking-[-.05em] text-white sm:text-[46px]">
              {brl(finance.availableBrl)}
            </strong>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setPayoutOpen(true)}
                disabled={!overview?.capabilities.payoutTicketsEnabled}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20F29A] px-4 text-[10px] font-extrabold text-[#042019] transition hover:bg-[#4AF5AD] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BanknoteArrowUp className="h-4 w-4" />
                Solicitar payout
              </button>
              <Link
                href="/docs/api"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[.035] px-4 text-[10px] font-bold text-[#BDD0C9] hover:border-white/20"
              >
                <Code2 className="h-4 w-4" />
                Integrar API
              </Link>
              <button
                onClick={() => void onRefresh()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[.035] px-4 text-[10px] font-bold text-[#BDD0C9] hover:border-white/20"
              >
                <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Atualizar
              </button>
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-white/8 pt-4 text-[9px] text-[#76A194]">
              <Landmark className="h-4 w-4" />
              Payouts são processados por ticket de Tesouraria nesta fase.
            </div>
          </div>
        </article>

        <MetricCard
          icon={Clock3}
          label="A liberar"
          value={brl(finance.pendingBrl)}
          note="Recebíveis aguardando janela de liberação"
          tone="gold"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Reservado"
          value={brl(finance.reservedBrl)}
          note="Payouts em processamento ou reservas operacionais"
          tone="blue"
        />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.3fr_.9fr]">
        <Card
          title="Liberações por Store"
          subtitle="Disponibilidade financeira e rota ativa por operação"
          icon={Store}
          action={
            <span className="text-[8px] text-[#6F8E85]">
              {stores.length} Store(s)
            </span>
          }
        >
          {stores.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[9px]">
                <thead className="text-[#668079]">
                  <tr className="border-b border-white/8">
                    <th className="px-3 py-3 font-semibold">Store</th>
                    <th className="px-3 py-3 font-semibold">Provider</th>
                    <th className="px-3 py-3 font-semibold">Release</th>
                    <th className="px-3 py-3 font-semibold">A liberar</th>
                    <th className="px-3 py-3 font-semibold">Disponível</th>
                    <th className="px-3 py-3 font-semibold">Próxima liberação</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr
                      key={String(store.id ?? store.code)}
                      className="border-b border-white/5 text-[#A9BDB6]"
                    >
                      <td className="px-3 py-3">
                        <strong className="block text-[10px] text-[#E5ECE8]">
                          {store.name ?? store.code ?? "Store"}
                        </strong>
                        <span className="mt-1 block text-[8px] text-[#617A73]">
                          {store.code}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {store.provider_code ?? "—"}
                        <span className="mt-1 block text-[8px] text-[#617A73]">
                          {store.gateway_alias ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {store.release_class ?? "—"} · {store.release_profile ?? "—"}
                      </td>
                      <td className="px-3 py-3">{brl(store.pending_brl)}</td>
                      <td className="px-3 py-3">{brl(store.available_brl)}</td>
                      <td className="px-3 py-3">
                        {dateTime(store.next_available_at)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            "inline-flex rounded-full border px-2 py-1 text-[7px] font-bold " +
                            statusClass(store.routing_mode)
                          }
                        >
                          {store.routing_mode ?? store.status ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Nenhuma Store vinculada a esta conta." />
          )}
        </Card>

        <Card
          title="Gateway PIX"
          subtitle="Providers e roteamento em produção"
          icon={Route}
          action={
            <span
              className={
                "inline-flex rounded-full border px-2 py-1 text-[7px] font-bold " +
                (overview?.capabilities.pixCollectionEnabled
                  ? statusClass("HEALTHY")
                  : statusClass("PENDING"))
              }
            >
              {overview?.capabilities.pixCollectionEnabled
                ? "Operação ativa"
                : "Aguardando ativação"}
            </span>
          }
        >
          <div className="space-y-2">
            {gatewayRows.length ? (
              gatewayRows.map((gateway) => (
                <div
                  key={String(gateway.gateway_alias ?? gateway.provider_code)}
                  className="rounded-2xl border border-white/7 bg-[#030E10] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-[11px]">
                        {gateway.provider_code ?? "Provider"}
                      </strong>
                      <span className="mt-1 block text-[8px] text-[#627B74]">
                        {gateway.gateway_alias ?? "—"}
                      </span>
                    </div>
                    <span
                      className={
                        "rounded-full border px-2 py-1 text-[7px] font-bold " +
                        statusClass(gateway.provider_health)
                      }
                    >
                      {gateway.provider_health ?? "UNKNOWN"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <SmallFact
                      label="Latência"
                      value={
                        gateway.provider_latency_ms != null
                          ? gateway.provider_latency_ms + " ms"
                          : "—"
                      }
                    />
                    <SmallFact
                      label="Classe"
                      value={gateway.release_class ?? "—"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Nenhum gateway ativo." />
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.3fr_.9fr]">
        <Card
          title="Movimentações recentes"
          subtitle="Cobranças PIX e estado financeiro"
          icon={Activity}
          action={
            <span className="text-[8px] text-[#6F8E85]">
              Taxa de sucesso {Number(finance.successRate ?? 0).toFixed(2)}%
            </span>
          }
        >
          {payments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[9px]">
                <thead className="text-[#668079]">
                  <tr className="border-b border-white/8">
                    <th className="px-3 py-3 font-semibold">Referência</th>
                    <th className="px-3 py-3 font-semibold">Store</th>
                    <th className="px-3 py-3 font-semibold">Provider</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-3 py-3 font-semibold">Líquido</th>
                    <th className="px-3 py-3 font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 8).map((payment) => (
                    <tr
                      key={String(payment.id)}
                      className="border-b border-white/5 text-[#A9BDB6]"
                    >
                      <td className="px-3 py-3">
                        {payment.external_reference ?? payment.id ?? "—"}
                        <span className="mt-1 block text-[8px] text-[#617A73]">
                          {dateTime(payment.created_at)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{payment.store_code ?? "—"}</td>
                      <td className="px-3 py-3">{payment.provider_code ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            "rounded-full border px-2 py-1 text-[7px] font-bold " +
                            statusClass(payment.status)
                          }
                        >
                          {payment.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">{brl(payment.net_brl)}</td>
                      <td className="px-3 py-3 font-semibold text-[#E7EEE9]">
                        {brl(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Ainda não existem cobranças PIX nesta conta." />
          )}
        </Card>

        <Card
          title="Fluxo de caixa · 30 dias"
          subtitle="Entradas líquidas e payouts confirmados"
          icon={CircleDollarSign}
        >
          <div className="flex h-[210px] items-end gap-[3px] rounded-2xl border border-white/6 bg-[#030E10] px-3 pb-4 pt-6">
            {flow.map((row) => {
              const incoming = Number(row.incoming_brl ?? 0);
              const outgoing = Number(row.outgoing_brl ?? 0);
              return (
                <div
                  key={row.day}
                  className="flex min-w-0 flex-1 items-end justify-center gap-[2px]"
                  title={
                    String(row.day) +
                    " · Entradas " +
                    brl(incoming) +
                    " · Saídas " +
                    brl(outgoing)
                  }
                >
                  <div
                    className="w-[42%] min-w-[2px] rounded-t bg-[#20F29A]/80"
                    style={{
                      height:
                        Math.max(2, Math.round((incoming / maxFlow) * 150)) +
                        "px",
                    }}
                  />
                  <div
                    className="w-[42%] min-w-[2px] rounded-t bg-[#4AA8FF]/70"
                    style={{
                      height:
                        Math.max(2, Math.round((outgoing / maxFlow) * 150)) +
                        "px",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[8px] text-[#6D8780]">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#20F29A]" /> Entradas
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#4AA8FF]" /> Payouts
            </span>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Payouts & Tesouraria"
          subtitle="Tickets manuais com reserva de saldo"
          icon={BanknoteArrowUp}
          action={
            <button
              onClick={() => setPayoutOpen(true)}
              className="text-[9px] font-semibold text-[#59CFA8]"
            >
              Novo payout →
            </button>
          }
        >
          {payouts.length ? (
            <div className="space-y-2">
              {payouts.slice(0, 6).map((payout) => (
                <div
                  key={String(payout.id)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/6 bg-[#030E10] px-4 py-3"
                >
                  <div>
                    <strong className="text-[10px]">
                      {payout.external_reference ?? payout.id}
                    </strong>
                    <span className="mt-1 block text-[8px] text-[#607871]">
                      {dateTime(payout.created_at)} · {payout.destination_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <strong className="text-[10px]">{brl(payout.amount)}</strong>
                    <span
                      className={
                        "mt-1 inline-flex rounded-full border px-2 py-1 text-[7px] font-bold " +
                        statusClass(payout.status)
                      }
                    >
                      {payout.status ?? "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Nenhum payout solicitado." />
          )}
        </Card>

        <Card
          title="Desenvolvedores"
          subtitle="API, webhooks e integração"
          icon={Code2}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <DeveloperLink
              href="/docs"
              icon={BookOpen}
              title="Documentação"
              description="Quickstart e arquitetura"
            />
            <DeveloperLink
              href="/docs/api"
              icon={Code2}
              title="API Reference"
              description="PIX, status e idempotência"
            />
            <DeveloperLink
              href="/docs/webhooks"
              icon={GitBranch}
              title="Webhooks"
              description="HMAC e eventos"
            />
            <DeveloperLink
              href="/docs/ai-setup"
              icon={Copy}
              title="AI Setup Kits"
              description="Prompts GPT, Claude e agentes"
            />
          </div>
        </Card>
      </section>

      {payoutOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#071416] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.14em] text-[#60CFA8]">
                  Tesouraria
                </span>
                <h3 className="mt-1 text-xl font-semibold tracking-[-.035em]">
                  Solicitar payout PIX
                </h3>
                <p className="mt-2 text-[9px] leading-5 text-[#708781]">
                  O valor é reservado imediatamente e o ticket segue para
                  processamento manual da Tesouraria.
                </p>
              </div>
              <button
                onClick={() => setPayoutOpen(false)}
                className="rounded-lg border border-white/8 p-2 text-[#78908A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitPayout} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[9px] font-semibold text-[#8AA099]">
                  Valor
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Number(finance.availableBrl ?? 0)}
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#020B0D] px-3 text-[12px] outline-none focus:border-[#20F29A]/40"
                  placeholder="0,00"
                />
                <span className="mt-1 block text-[8px] text-[#5D756E]">
                  Disponível: {brl(finance.availableBrl)}
                </span>
              </label>

              <div className="grid grid-cols-[120px_1fr] gap-2">
                <label>
                  <span className="mb-2 block text-[9px] font-semibold text-[#8AA099]">
                    Tipo da chave
                  </span>
                  <select
                    value={pixKeyType}
                    onChange={(event) => setPixKeyType(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#020B0D] px-3 text-[11px] outline-none"
                  >
                    <option value="EVP">Aleatória</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Telefone</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-[9px] font-semibold text-[#8AA099]">
                    Chave PIX
                  </span>
                  <input
                    required
                    value={pixKey}
                    onChange={(event) => setPixKey(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#020B0D] px-3 text-[11px] outline-none focus:border-[#20F29A]/40"
                    placeholder="Chave de destino"
                  />
                </label>
              </div>

              {payoutError ? (
                <div className="rounded-xl border border-red-400/18 bg-red-400/5 px-3 py-2 text-[9px] text-red-200">
                  {payoutError}
                </div>
              ) : null}
              {payoutSuccess ? (
                <div className="flex items-start gap-2 rounded-xl border border-[#20F29A]/18 bg-[#20F29A]/5 px-3 py-2 text-[9px] text-[#8AE2C1]">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {payoutSuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={payoutBusy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#20F29A] text-[10px] font-extrabold text-[#032019] disabled:opacity-50"
              >
                {payoutBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                {payoutBusy ? "A criar ticket…" : "Criar ticket de payout"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  note: string;
  tone: "gold" | "blue";
}) {
  const toneClass =
    tone === "gold"
      ? "border-[#D8A447]/16 bg-[linear-gradient(145deg,#17130B,#0E0E0B)] text-[#D8B968]"
      : "border-[#4AA8FF]/16 bg-[linear-gradient(145deg,#08151D,#091014)] text-[#77BCF5]";

  return (
    <article className={"rounded-[24px] border p-5 " + toneClass}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/15 bg-current/[.045]">
        <Icon className="h-4 w-4" />
      </div>
      <span className="mt-5 block text-[10px] font-bold text-[#B9C7C2]">
        {label}
      </span>
      <strong className="mt-2 block text-[25px] tracking-[-.04em] text-white">
        {value}
      </strong>
      <p className="mt-2 text-[8px] leading-4 text-[#6F817C]">{note}</p>
    </article>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Store;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/8 bg-[#071315]">
      <div className="flex items-center justify-between gap-4 border-b border-white/7 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.035] text-[#72A396]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <strong className="block text-[11px]">{title}</strong>
            <span className="mt-1 block text-[8px] text-[#607871]">
              {subtitle}
            </span>
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[.02] p-3">
      <span className="block text-[7px] uppercase tracking-[.12em] text-[#5F7870]">
        {label}
      </span>
      <strong className="mt-1 block text-[9px] text-[#B7C9C3]">{value}</strong>
    </div>
  );
}

function DeveloperLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Code2;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/7 bg-[#030E10] p-4 transition hover:border-[#20F29A]/18 hover:bg-[#20F29A]/[.025]"
    >
      <div className="flex items-start justify-between">
        <Icon className="h-4 w-4 text-[#68A596]" />
        <ArrowRight className="h-3.5 w-3.5 text-[#526B64] transition group-hover:translate-x-0.5" />
      </div>
      <strong className="mt-4 block text-[10px]">{title}</strong>
      <span className="mt-1 block text-[8px] text-[#617A73]">
        {description}
      </span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[9px] text-[#607871]">
      {text}
    </div>
  );
}
