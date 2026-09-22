"use client";

import {
  ArrowLeft,
  Delete,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Settings2,
  Share2,
  Smartphone,
  Store,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import type {
  OverviewData,
  OverviewPayload,
  SessionData,
  SessionPayload,
} from "@/components/client/client-types";
import { brl, statusTone } from "@/components/client/client-types";

type TerminalPayment = {
  paymentIntentId: string;
  reference: string | null;
  amount: number;
  currency: string;
  status: string;
  storeCode: string | null;
  action?: {
    type?: string;
    copyPaste?: string;
    qrCodeImage?: string;
    expiresAt?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

type ChargePayload = {
  success?: boolean;
  data?: TerminalPayment;
  message?: string;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeQrImage(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:image/") || raw.startsWith("https://")) return raw;
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 100) {
    return "data:image/png;base64," + raw;
  }
  return "";
}

function paymentDone(status: string) {
  return ["SUCCEEDED", "PAID", "CONFIRMED", "AVAILABLE"].includes(
    status.toUpperCase(),
  );
}

function paymentFailed(status: string) {
  return ["FAILED", "REJECTED", "CANCELED", "EXPIRED"].includes(
    status.toUpperCase(),
  );
}

export function TerminalClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [storeCode, setStoreCode] = useState("");
  const [terminalName, setTerminalName] = useState("Caixa 1");
  const [terminalId, setTerminalId] = useState("");
  const [amountCents, setAmountCents] = useState("0");
  const [payerName] = useState("Cliente");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [description, setDescription] = useState("");
  const [payment, setPayment] = useState<TerminalPayment | null>(null);
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);

  const amount = Number(amountCents || 0) / 100;

  const stores = useMemo(
    () =>
      (overview?.business?.stores ?? []).filter(
        (store) => store.status.toUpperCase() === "ACTIVE",
      ),
    [overview?.business?.stores],
  );

  const activeStore = stores.find((store) => store.code === storeCode);

  const recent = useMemo(
    () =>
      (overview?.business?.payments ?? [])
        .filter((row) => !storeCode || row.store_code === storeCode)
        .slice(0, 5),
    [overview?.business?.payments, storeCode],
  );

  const loadOverview = useCallback(async (id: string) => {
    const response = await fetch(
      "/api/client/accounts/" + encodeURIComponent(id) + "/overview",
      { cache: "no-store" },
    );
    if (response.status === 401) {
      router.replace("/login?next=%2Fterminal");
      return null;
    }
    const body = (await response.json()) as OverviewPayload;
    if (!response.ok) {
      throw new Error("Não foi possível carregar a conta Business.");
    }
    setOverview(body.data);
    return body.data;
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(async () => {
      const storedTerminal = localStorage.getItem("pixbrasil:terminal:name");
      if (active && storedTerminal) setTerminalName(storedTerminal);
      const storedTerminalId =
        localStorage.getItem("pixbrasil:terminal:id") || crypto.randomUUID();
      localStorage.setItem("pixbrasil:terminal:id", storedTerminalId);
      if (active) setTerminalId(storedTerminalId);

      try {
        const response = await fetch("/api/client/session", {
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/login?next=%2Fterminal");
          return;
        }

        const body = (await response.json()) as SessionPayload;
        if (!response.ok) throw new Error("Sessão indisponível.");
        if (!active) return;

        setSession(body.data);
        const business = body.data.accounts.find(
          (account) => account.accountType === "BUSINESS",
        );
        if (!business) {
          throw new Error("Esta conta não possui acesso Business.");
        }

        setAccountId(business.accountId);
        const loaded = await loadOverview(business.accountId);
        if (!active || !loaded) return;

        const storedStore = localStorage.getItem("pixbrasil:terminal:store");
        const activeStores = (loaded.business?.stores ?? []).filter(
          (store) => store.status.toUpperCase() === "ACTIVE",
        );
        const preferred =
          activeStores.find((store) => store.code === storedStore) ??
          activeStores[0];
        if (preferred) setStoreCode(preferred.code);
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Falha ao abrir terminal.",
        );
      } finally {
        if (active) setBusy(false);
      }
    });

    return () => {
      active = false;
    };
  }, [loadOverview, router]);

  useEffect(() => {
    if (storeCode) {
      localStorage.setItem("pixbrasil:terminal:store", storeCode);
    }
  }, [storeCode]);

  useEffect(() => {
    localStorage.setItem("pixbrasil:terminal:name", terminalName);
  }, [terminalName]);

  useEffect(() => {
    if (!payment?.paymentIntentId || !accountId) return;
    if (paymentDone(payment.status) || paymentFailed(payment.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          "/api/client/accounts/" +
            encodeURIComponent(accountId) +
            "/terminal/payments/" +
            encodeURIComponent(payment.paymentIntentId),
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as ChargePayload;
        if (!response.ok || !body.data) return;
        setPayment(body.data);
        if (paymentDone(body.data.status)) {
          setSuccessFlash(true);
          void loadOverview(accountId);
          window.setTimeout(() => {
            setSuccessFlash(false);
            setPayment(null);
            setAmountCents("0");
            setPayerTaxId("");
            setDescription("");
          }, 3200);
        }
      } catch {
        // Polling is best-effort; the next interval retries.
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [accountId, loadOverview, payment?.paymentIntentId, payment?.status]);

  function appendKey(key: string) {
    if (payment || creating) return;
    setAmountCents((current) => {
      const base = current === "0" ? "" : current;
      const next = (base + key).replace(/^0+/, "").slice(0, 10);
      return next || "0";
    });
  }

  function backspace() {
    if (payment || creating) return;
    setAmountCents((current) => current.slice(0, -1) || "0");
  }

  function clearCharge() {
    setPayment(null);
    setAmountCents("0");
    setPayerTaxId("");
    setDescription("");
    setError("");
  }

  async function createCharge() {
    if (!accountId || !storeCode || amount <= 0) return;
    if (![11, 14].includes(digits(payerTaxId).length)) {
      setError(
        "Para as rotas PIX atuais, informa um CPF ou CNPJ válido do pagador.",
      );
      return;
    }

    setCreating(true);
    setError("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(accountId) +
          "/terminal/charge",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            store: storeCode,
            amount,
            description:
              description.trim() || "Cobrança presencial " + terminalName,
            payer: {
              name: payerName.trim() || "Cliente",
              taxId: digits(payerTaxId),
            },
            terminal: {
              id: terminalId || "mobile",
              name: terminalName,
            },
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as ChargePayload;
      if (!response.ok || !body.data) {
        throw new Error(body.message || "Não foi possível gerar a cobrança.");
      }
      setPayment(body.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao gerar cobrança.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyPix() {
    const value = payment?.action?.copyPaste;
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  async function sharePix() {
    const value = payment?.action?.copyPaste;
    if (!value) return;
    const text =
      "Cobrança PIX " +
      brl(payment?.amount ?? 0) +
      "\n\n" +
      value;
    if (navigator.share) {
      await navigator.share({
        title: "Cobrança PIX",
        text,
      });
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  const qrImage = normalizeQrImage(payment?.action?.qrCodeImage);

  if (busy) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#02110E] text-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#20F29A]" />
          <p className="mt-3 text-[12px] text-[#8FB0A6]">
            A abrir Terminal PiXBrasil…
          </p>
        </div>
      </main>
    );
  }

  if (error && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#02110E] p-5 text-white">
        <div className="max-w-sm rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-center">
          <XCircle className="mx-auto h-7 w-7 text-red-300" />
          <strong className="mt-3 block text-[14px]">Terminal indisponível</strong>
          <p className="mt-2 text-[11px] leading-5 text-red-100/75">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="terminal-shell min-h-screen bg-[#031511] text-[#F4FBF8]">
      <div className="pointer-events-none fixed inset-0 terminal-grid opacity-40" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_-30%,rgba(32,242,154,.18),transparent_66%)]" />

      <header className="terminal-glass sticky top-0 z-40 border-b border-white/8">
        <div className="mx-auto flex h-16 max-w-[980px] items-center gap-3 px-4">
          <a
            href="/app"
            className="terminal-press flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-[#A5C0B8]"
            aria-label="Voltar ao dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <BrandLogo className="text-[17px]" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <strong className="block text-[10px]">
                {activeStore?.name || "Store"}
              </strong>
              <span className="text-[9px] text-[#75968C]">{terminalName}</span>
            </div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="terminal-press flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-[#B2C8C1]"
              aria-label="Configurações do terminal"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[980px] gap-5 px-4 py-5 lg:grid-cols-[1fr_340px] lg:py-8">
        <section className="terminal-card relative overflow-hidden rounded-[24px] border border-white/10 p-5 sm:p-6">
          <div className="terminal-ridge pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#5EEBB6]">
                  Cobrança presencial
                </span>
                <h1 className="mt-1 text-[20px] font-semibold tracking-[-.035em]">
                  Terminal PIX
                </h1>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#38D69C]/25 bg-[#20F29A]/8 px-3 py-1.5 text-[9px] font-bold text-[#70F1BD]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#20F29A]" />
                Online
              </span>
            </div>

            {!payment ? (
              <>
                <div className="mt-7 text-center">
                  <span className="text-[12px] text-[#789A90]">Valor da cobrança</span>
                  <strong className="mt-2 block text-[50px] font-bold tracking-[-.06em] sm:text-[62px]">
                    {brl(amount)}
                  </strong>
                </div>

                <div className="mx-auto mt-7 grid max-w-[520px] grid-cols-3 gap-2.5">
                  {KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => appendKey(key)}
                      className="terminal-key terminal-press h-[62px] rounded-[16px] border border-white/10 text-[20px] font-semibold"
                    >
                      {key}
                    </button>
                  ))}
                  <button
                    onClick={backspace}
                    className="terminal-key terminal-press flex h-[62px] items-center justify-center rounded-[16px] border border-white/10 text-[#A5C0B8]"
                    aria-label="Apagar"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto mt-5 grid max-w-[520px] gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#73958A]">
                      CPF/CNPJ do pagador
                    </span>
                    <input
                      inputMode="numeric"
                      value={payerTaxId}
                      onChange={(event) => setPayerTaxId(event.target.value)}
                      placeholder="Somente números"
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-[12px] outline-none transition focus:border-[#20F29A]/45 focus:ring-4 focus:ring-[#20F29A]/6"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#73958A]">
                      Referência opcional
                    </span>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Mesa 4, balcão, pedido..."
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-[12px] outline-none transition focus:border-[#20F29A]/45 focus:ring-4 focus:ring-[#20F29A]/6"
                    />
                  </label>
                </div>

                {error ? (
                  <div className="mx-auto mt-4 max-w-[520px] rounded-xl border border-red-400/20 bg-red-400/7 px-4 py-3 text-[10px] leading-5 text-red-100">
                    {error}
                  </div>
                ) : null}

                <button
                  onClick={() => void createCharge()}
                  disabled={creating || amount <= 0 || !storeCode}
                  className="terminal-charge terminal-press mx-auto mt-5 flex h-14 w-full max-w-[520px] items-center justify-center gap-3 rounded-[16px] bg-[linear-gradient(105deg,#20F29A,#21EBC1)] text-[13px] font-extrabold text-[#032017] shadow-[0_14px_36px_rgba(32,242,154,.2)] disabled:opacity-40"
                >
                  {creating ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <QrCode className="h-5 w-5" />
                  )}
                  {creating ? "A gerar cobrança…" : "Cobrar agora"}
                </button>
              </>
            ) : (
              <div className="mt-6">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#6EEAB7]">
                    Aguardando pagamento
                  </span>
                  <strong className="mt-2 block text-[38px] font-bold tracking-[-.05em]">
                    {brl(payment.amount)}
                  </strong>
                  <p className="mt-2 text-[10px] text-[#7F9C93]">
                    {activeStore?.name || payment.storeCode} · {terminalName}
                  </p>
                </div>

                <div className="mx-auto mt-5 max-w-[390px] rounded-[24px] border border-white/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,.25)]">
                  {qrImage ? (
                    // Provider-supplied QR is displayed locally; no payment data
                    // is sent to a third-party QR rendering service.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrImage}
                      alt="QR Code PIX da cobrança"
                      className="mx-auto aspect-square w-full max-w-[320px] object-contain"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#F3F8F6] p-6 text-center text-[#425D54]">
                      <div>
                        <QrCode className="mx-auto h-12 w-12 text-[#0AA473]" />
                        <strong className="mt-4 block text-[13px]">
                          PIX Copia e Cola pronto
                        </strong>
                        <p className="mt-2 text-[10px] leading-5 text-[#6A7C76]">
                          Esta rota não devolveu uma imagem QR. Use Copiar ou
                          Partilhar abaixo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mx-auto mt-4 grid max-w-[520px] grid-cols-2 gap-2">
                  <button
                    onClick={() => void copyPix()}
                    disabled={!payment.action?.copyPaste}
                    className="terminal-key terminal-press flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 text-[11px] font-semibold disabled:opacity-35"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar PIX
                  </button>
                  <button
                    onClick={() => void sharePix()}
                    disabled={!payment.action?.copyPaste}
                    className="terminal-key terminal-press flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 text-[11px] font-semibold disabled:opacity-35"
                  >
                    <Share2 className="h-4 w-4" />
                    Partilhar
                  </button>
                </div>

                <div className="mx-auto mt-4 flex max-w-[520px] items-center justify-between rounded-xl border border-white/8 bg-black/10 px-4 py-3">
                  <span className="flex items-center gap-2 text-[10px] text-[#8EAAA1]">
                    <LoaderCircle className="h-4 w-4 animate-spin text-[#20F29A]" />
                    A confirmar automaticamente…
                  </span>
                  <button
                    onClick={clearCharge}
                    className="text-[10px] font-semibold text-[#A5C0B8]"
                  >
                    Cancelar tela
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="terminal-card rounded-[22px] border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#71958A]">
                  Configuração
                </span>
                <strong className="mt-1 block text-[13px]">Ponto de venda</strong>
              </div>
              <Smartphone className="h-5 w-5 text-[#47E8B0]" />
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[9px] text-[#76978D]">Store</span>
                <div className="relative mt-1">
                  <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#61B89A]" />
                  <select
                    value={storeCode}
                    onChange={(event) => setStoreCode(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/15 pl-10 pr-9 text-[11px] outline-none"
                  >
                    {stores.map((store) => (
                      <option
                        key={store.id}
                        value={store.code}
                        className="bg-[#062019]"
                      >
                        {store.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#789A90]" />
                </div>
              </label>

              <label className="block">
                <span className="text-[9px] text-[#76978D]">
                  POS / Dispositivo
                </span>
                <input
                  value={terminalName}
                  onChange={(event) => setTerminalName(event.target.value)}
                  maxLength={80}
                  className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-[11px] outline-none"
                  placeholder="Caixa 1"
                />
              </label>
            </div>
          </section>

          <section className="terminal-card rounded-[22px] border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#71958A]">
                  Store atual
                </span>
                <strong className="mt-1 block text-[13px]">
                  Últimas transações
                </strong>
              </div>
              <button
                onClick={() => accountId && void loadOverview(accountId)}
                className="terminal-press flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[.03] text-[#8EAAA1]"
                aria-label="Atualizar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {recent.length ? (
                recent.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-white/7 bg-black/10 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-[10px]">
                          {row.external_reference || "Pagamento PIX"}
                        </strong>
                        <span className="mt-1 block text-[8px] text-[#718F86]">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="block text-[11px]">
                          {brl(row.amount)}
                        </strong>
                        <span
                          className={
                            "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[7px] font-bold " +
                            statusTone(row.status)
                          }
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-[9px] text-[#718F86]">
                  Nenhuma transação recente nesta Store.
                </div>
              )}
            </div>
          </section>

          <div className="px-1 text-center text-[8px] leading-4 text-[#5E7B72]">
            PiXBrasil Terminal · Cobranças PIX presenciais
            <br />
            Nenhuma credencial de integração fica exposta no dispositivo.
          </div>
        </aside>
      </div>

      {settingsOpen ? (
        <button
          aria-label="Fechar configurações"
          onClick={() => setSettingsOpen(false)}
          className="fixed inset-0 z-30 bg-black/10 lg:hidden"
        />
      ) : null}

      {successFlash ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#052D23]/95 p-5 backdrop-blur-xl">
          <div className="terminal-success text-center">
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#78F2C0]/30 bg-[#20F29A]/10 shadow-[0_0_80px_rgba(32,242,154,.22)]">
              <Check className="h-12 w-12 text-[#58F0B5]" strokeWidth={2.5} />
            </span>
            <h2 className="mt-6 text-[28px] font-bold tracking-[-.04em]">
              Pagamento concluído
            </h2>
            <p className="mt-2 text-[13px] text-[#9BC8B9]">
              {brl(payment?.amount ?? 0)} recebido com sucesso.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
