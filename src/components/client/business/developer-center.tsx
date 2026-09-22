"use client";

import {
  Ban,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  TestTube2,
  Webhook,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { StoreRow } from "@/components/client/client-types";

type ApiKeyRow = {
  apiKeyId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  storeCodes: string[];
};

type WebhookRow = {
  endpointId: string;
  name: string;
  endpointUrl: string;
  events: string[];
  status: string;
  failureCount: number;
  lastDeliveryAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type DeveloperPayload = {
  success: true;
  data: {
    apiKeys: ApiKeyRow[];
    webhooks: WebhookRow[];
  };
};

type OneTimeSecret = {
  title: string;
  value: string;
  detail: string;
};

const EVENTS = [
  "payment.pending",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
];

export function DeveloperCenter(props: {
  accountId: string;
  stores: StoreRow[];
  role: string;
}) {
  const canManage = ["OWNER", "ADMIN"].includes(props.role);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [keyName, setKeyName] = useState("Integração produção");
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [webhookName, setWebhookName] = useState("Webhook produção");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([...EVENTS]);
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);

  const activeStores = useMemo(
    () => props.stores.filter((store) => store.status.toUpperCase() === "ACTIVE"),
    [props.stores],
  );

  const load = useCallback(async () => {
    if (!props.accountId || !canManage) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/developer",
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as
        | DeveloperPayload
        | { message?: string };
      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "Não foi possível carregar as integrações.",
        );
      }
      setApiKeys(body.data.apiKeys);
      setWebhooks(body.data.webhooks);
      if (!selectedStores.length && activeStores.length) {
        setSelectedStores(activeStores.map((store) => store.code));
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as integrações.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeStores, canManage, props.accountId, selectedStores.length]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function toggleStore(code: string) {
    setSelectedStores((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  function toggleEvent(event: string) {
    setWebhookEvents((current) =>
      current.includes(event)
        ? current.filter((item) => item !== event)
        : [...current, event],
    );
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    if (!selectedStores.length) {
      setError("Seleciona pelo menos uma Store.");
      return;
    }
    setBusy("key:create");
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/api-keys",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: keyName,
            storeCodes: selectedStores,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        data?: {
          secret?: string;
          keyPrefix?: string;
          storeCodes?: string[];
        };
        message?: string;
      };
      if (!response.ok || !body.data?.secret) {
        throw new Error(body.message || "Não foi possível criar a API Key.");
      }

      setSecret({
        title: "API Key — exibição única",
        value: body.data.secret,
        detail:
          "Guarda esta chave num secret manager. O PiXBrasil não permite recuperar o segredo depois de fechar esta mensagem.",
      });
      setMessage(
        "API Key criada para " +
          (body.data.storeCodes?.join(", ") || "as Stores selecionadas") +
          ".",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao criar API Key.",
      );
    } finally {
      setBusy("");
    }
  }

  async function revokeKey(key: ApiKeyRow) {
    if (!window.confirm('Revogar a API Key "' + key.name + '"?')) return;
    setBusy("key:" + key.apiKeyId);
    setError("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/api-keys/" +
          encodeURIComponent(key.apiKeyId) +
          "/revoke",
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message || "Não foi possível revogar a chave.");
      }
      setMessage("API Key revogada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao revogar.");
    } finally {
      setBusy("");
    }
  }

  async function createWebhook(event: FormEvent) {
    event.preventDefault();
    if (!webhookEvents.length) {
      setError("Seleciona pelo menos um evento.");
      return;
    }
    setBusy("webhook:create");
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/webhooks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: webhookName,
            endpointUrl: webhookUrl,
            events: webhookEvents,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        data?: { signingSecret?: string; endpointId?: string };
        message?: string;
      };
      if (!response.ok || !body.data?.signingSecret) {
        throw new Error(body.message || "Não foi possível criar o webhook.");
      }

      setSecret({
        title: "Webhook secret — exibição única",
        value: body.data.signingSecret,
        detail:
          "Usa este segredo para validar X-PiXBrasil-Signature com HMAC-SHA256. O segredo não será mostrado novamente.",
      });
      setWebhookUrl("");
      setMessage("Webhook criado e ativo.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao criar webhook.",
      );
    } finally {
      setBusy("");
    }
  }

  async function webhookAction(
    endpoint: WebhookRow,
    action: "test" | "revoke",
  ) {
    if (
      action === "revoke" &&
      !window.confirm('Revogar o webhook "' + endpoint.name + '"?')
    ) {
      return;
    }

    setBusy("webhook:" + action + ":" + endpoint.endpointId);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/client/accounts/" +
          encodeURIComponent(props.accountId) +
          "/webhooks/" +
          encodeURIComponent(endpoint.endpointId) +
          "/" +
          action,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        data?: { status?: string };
      };
      if (!response.ok) {
        throw new Error(body.message || "Operação de webhook falhou.");
      }
      setMessage(
        action === "test"
          ? "Evento de teste enviado: " + (body.data?.status || "processado") + "."
          : "Webhook revogado.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Operação de webhook falhou.",
      );
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copiado para a área de transferência.");
  }

  if (!canManage) {
    return (
      <section
        id="integrations"
        className="rounded-[16px] border border-[#DCE7E3] bg-white p-6 shadow-[0_18px_50px_rgba(20,58,47,.05)]"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EDF8F4] text-[#118B65]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[16px] font-bold tracking-[-.02em]">
              Integrações
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#6C7F78]">
              A gestão de API Keys e Webhooks está disponível para utilizadores
              Owner ou Admin desta conta Business.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="integrations"
      className="overflow-hidden rounded-[16px] border border-[#DCE7E3] bg-white shadow-[0_18px_50px_rgba(20,58,47,.05)]"
    >
      <div className="flex flex-col gap-4 border-b border-[#E6EEEB] bg-[linear-gradient(135deg,#FBFDFC,#F4FAF7)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#CFE8DF] bg-white text-[#0E9A6C] shadow-sm">
            <Code2 className="h-5 w-5" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#168A66]">
              Developer Center
            </span>
            <h2 className="mt-1 text-[17px] font-bold tracking-[-.025em]">
              API Keys & Webhooks
            </h2>
            <p className="mt-1 text-[12px] text-[#6D8079]">
              Credenciais por Store e notificações HTTPS para a sua integração.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-[#D8E5E0] bg-white px-4 text-[11px] font-semibold text-[#36554B] shadow-sm transition hover:-translate-y-[1px] hover:shadow-md disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </button>
      </div>

      {secret ? (
        <div className="mx-5 mt-5 rounded-[14px] border border-[#AEE8D3] bg-[linear-gradient(145deg,#F1FFF9,#E8FAF2)] p-4 shadow-[0_14px_30px_rgba(16,139,95,.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0EA874]" />
                <strong className="text-[12px]">{secret.title}</strong>
              </div>
              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#507268]">
                {secret.detail}
              </p>
            </div>
            <button
              onClick={() => setSecret(null)}
              className="text-[10px] font-semibold text-[#52756B]"
            >
              Fechar
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#CDEADF] bg-white p-2">
            <code className="min-w-0 flex-1 overflow-x-auto px-2 text-[11px] text-[#0B3328]">
              {secret.value}
            </code>
            <button
              onClick={() => void copy(secret.value)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#073A30] px-3 text-[10px] font-bold text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-0 xl:grid-cols-2">
        <div className="border-b border-[#E6EEEB] p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#0E9368]" />
            <strong className="text-[13px]">API Keys</strong>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#73857F]">
            Cada chave pode ser limitada às Stores escolhidas. O segredo é
            apresentado apenas uma vez.
          </p>

          <form onSubmit={createKey} className="mt-4 rounded-[14px] border border-[#E0EAE6] bg-[#FAFCFB] p-4">
            <label className="block">
              <span className="text-[10px] font-bold text-[#52665F]">
                Nome da credencial
              </span>
              <input
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                maxLength={120}
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE6E2] bg-white px-3 text-[12px] outline-none transition focus:border-[#18B983] focus:ring-4 focus:ring-[#18B983]/8"
              />
            </label>

            <div className="mt-4">
              <span className="text-[10px] font-bold text-[#52665F]">
                Stores autorizadas
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {activeStores.map((store) => {
                  const checked = selectedStores.includes(store.code);
                  return (
                    <button
                      type="button"
                      key={store.id}
                      onClick={() => toggleStore(store.code)}
                      className={[
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                        checked
                          ? "border-[#AEE8D3] bg-[#F0FBF6] shadow-[0_6px_16px_rgba(17,138,98,.06)]"
                          : "border-[#E1E9E6] bg-white hover:border-[#CBD9D4]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          checked
                            ? "bg-[#0FA874] text-white"
                            : "bg-[#EEF4F2] text-[#62776F]",
                        ].join(" ")}
                      >
                        <Store className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <strong className="block text-[11px]">{store.name}</strong>
                        <small className="mt-0.5 block text-[9px] text-[#82938D]">
                          {store.code}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                busy === "key:create" ||
                !selectedStores.length ||
                !keyName.trim()
              }
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#073A30] px-4 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(7,58,48,.16)] transition hover:-translate-y-[1px] hover:bg-[#0A493C] disabled:opacity-45"
            >
              {busy === "key:create" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Gerar API Key
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {apiKeys.length ? (
              apiKeys.map((key) => (
                <div
                  key={key.apiKeyId}
                  className="rounded-[13px] border border-[#E1E9E6] bg-white p-3.5 transition hover:border-[#CBD8D3] hover:shadow-[0_8px_24px_rgba(22,61,49,.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-[11px]">
                        {key.name}
                      </strong>
                      <code className="mt-1 block text-[10px] text-[#506C62]">
                        {key.keyPrefix}…
                      </code>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[9px] font-bold",
                        key.status === "ACTIVE"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      ].join(" ")}
                    >
                      {key.status === "ACTIVE" ? "Ativa" : "Revogada"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {key.storeCodes.map((store) => (
                      <span
                        key={store}
                        className="rounded-full bg-[#F1F6F4] px-2 py-1 text-[9px] font-semibold text-[#5D746C]"
                      >
                        {store}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#EDF2F0] pt-3 text-[9px] text-[#84948F]">
                    <span>
                      Último uso:{" "}
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleString("pt-BR")
                        : "Nunca"}
                    </span>
                    {key.status === "ACTIVE" ? (
                      <button
                        onClick={() => void revokeKey(key)}
                        disabled={busy === "key:" + key.apiKeyId}
                        className="inline-flex items-center gap-1.5 font-semibold text-red-600 disabled:opacity-45"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Revogar
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[#D8E4E0] p-5 text-center text-[10px] text-[#80918B]">
                Nenhuma API Key emitida.
              </div>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[#0E9368]" />
            <strong className="text-[13px]">Webhooks</strong>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#73857F]">
            Receba atualizações de pagamento no seu servidor com assinatura
            HMAC-SHA256.
          </p>

          <form onSubmit={createWebhook} className="mt-4 rounded-[14px] border border-[#E0EAE6] bg-[#FAFCFB] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-bold text-[#52665F]">
                  Nome
                </span>
                <input
                  value={webhookName}
                  onChange={(event) => setWebhookName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE6E2] bg-white px-3 text-[12px] outline-none focus:border-[#18B983] focus:ring-4 focus:ring-[#18B983]/8"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#52665F]">
                  Endpoint HTTPS
                </span>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://seusite.com/webhooks/pixbrasil"
                  required
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE6E2] bg-white px-3 text-[12px] outline-none focus:border-[#18B983] focus:ring-4 focus:ring-[#18B983]/8"
                />
              </label>
            </div>

            <div className="mt-4">
              <span className="text-[10px] font-bold text-[#52665F]">
                Eventos
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {EVENTS.map((eventName) => {
                  const checked = webhookEvents.includes(eventName);
                  return (
                    <button
                      type="button"
                      key={eventName}
                      onClick={() => toggleEvent(eventName)}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[10px] font-medium transition",
                        checked
                          ? "border-[#B9E7D6] bg-[#F0FBF6] text-[#195E49]"
                          : "border-[#E1E9E6] bg-white text-[#6B7D76]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-2 w-2 rounded-full",
                          checked ? "bg-[#10B77D]" : "bg-[#C7D3CF]",
                        ].join(" ")}
                      />
                      {eventName}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                busy === "webhook:create" ||
                !webhookUrl.trim() ||
                !webhookEvents.length
              }
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#073A30] px-4 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(7,58,48,.16)] transition hover:-translate-y-[1px] hover:bg-[#0A493C] disabled:opacity-45"
            >
              {busy === "webhook:create" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Adicionar webhook
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {webhooks.length ? (
              webhooks.map((endpoint) => (
                <div
                  key={endpoint.endpointId}
                  className="rounded-[13px] border border-[#E1E9E6] bg-white p-3.5 transition hover:border-[#CBD8D3] hover:shadow-[0_8px_24px_rgba(22,61,49,.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block text-[11px]">
                        {endpoint.name}
                      </strong>
                      <span className="mt-1 block truncate text-[9px] text-[#73857F]">
                        {endpoint.endpointUrl}
                      </span>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[9px] font-bold",
                        endpoint.status === "ACTIVE"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      ].join(" ")}
                    >
                      {endpoint.status === "ACTIVE" ? "Ativo" : endpoint.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {endpoint.events.map((eventName) => (
                      <span
                        key={eventName}
                        className="rounded-full bg-[#F2F6F5] px-2 py-1 text-[8px] font-semibold text-[#667A73]"
                      >
                        {eventName}
                      </span>
                    ))}
                  </div>

                  {endpoint.lastError ? (
                    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[9px] text-red-700">
                      Último erro: {endpoint.lastError}
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between border-t border-[#EDF2F0] pt-3">
                    <span className="text-[9px] text-[#84948F]">
                      Última entrega:{" "}
                      {endpoint.lastDeliveryAt
                        ? new Date(endpoint.lastDeliveryAt).toLocaleString(
                            "pt-BR",
                          )
                        : "Ainda não enviado"}
                    </span>
                    {endpoint.status === "ACTIVE" ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            void webhookAction(endpoint, "test")
                          }
                          disabled={
                            busy ===
                            "webhook:test:" + endpoint.endpointId
                          }
                          className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#1765D1]"
                        >
                          <TestTube2 className="h-3.5 w-3.5" />
                          Testar
                        </button>
                        <button
                          onClick={() =>
                            void webhookAction(endpoint, "revoke")
                          }
                          disabled={
                            busy ===
                            "webhook:revoke:" + endpoint.endpointId
                          }
                          className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-red-600"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Revogar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[#D8E4E0] p-5 text-center text-[10px] text-[#80918B]">
                Nenhum webhook configurado.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#E6EEEB] bg-[#FBFCFC] px-5 py-4 text-[10px] text-[#6D8079] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0E9A6C]" />
          Segredos nunca são recuperáveis depois da exibição inicial.
        </span>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 font-bold text-[#0B7656]"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Ver documentação
        </a>
      </div>
    </section>
  );
}
