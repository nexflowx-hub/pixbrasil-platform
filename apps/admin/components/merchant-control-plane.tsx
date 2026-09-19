"use client";

import {
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/api";

interface MerchantStore {
  id: string;
  code: string;
  name: string;
  status: string;
  currency: string;
  routeCostProfile: string | null;
  releaseProfile: string | null;
  releaseClass: string | null;
  platformFeeProfile: string | null;
  crossReleaseClassFailover: boolean;
  routingPolicy: string | null;
  routingMode: string | null;
  gatewayAlias: string | null;
}

interface Merchant {
  id: string;
  account_id: string;
  status: string;
  tier_code: string;
  legal_name: string | null;
  trade_name: string | null;
  metadata: Record<string, unknown>;
  stores: MerchantStore[];
}

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  store_codes: string[];
}

interface GeneratedKey {
  apiKeyId: string;
  name: string;
  keyPrefix: string;
  secret: string;
  scopes: string[];
  storeCodes: string[];
  warning: string;
}

interface KeyDraft {
  name: string;
  storeCodes: string[];
}

function merchantLabel(merchant: Merchant) {
  return merchant.trade_name ?? merchant.legal_name ?? "Merchant";
}

function formatDate(value: string | null) {
  if (!value) return "never";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MerchantControlPlane() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [keys, setKeys] = useState<Record<string, ApiKeyRow[]>>({});
  const [drafts, setDrafts] = useState<Record<string, KeyDraft>>({});
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const activeKeyCount = useMemo(
    () =>
      Object.values(keys)
        .flat()
        .filter((key) => key.status === "ACTIVE").length,
    [keys],
  );

  const hydrateDrafts = useCallback((rows: Merchant[]) => {
    setDrafts((current) => {
      const next = { ...current };
      for (const merchant of rows) {
        if (!next[merchant.id]) {
          next[merchant.id] = {
            name: `${merchantLabel(merchant)} S2S`,
            storeCodes: merchant.stores
              .filter((store) => store.status === "ACTIVE")
              .map((store) => store.code),
          };
        }
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch<{ success: true; data: Merchant[] }>(
        "/api/v1/admin/merchants",
      );

      const keyPairs = await Promise.all(
        response.data.map(async (merchant) => {
          const keyResponse = await adminFetch<{
            success: true;
            data: ApiKeyRow[];
          }>(`/api/v1/admin/merchants/${merchant.id}/api-keys`);
          return [merchant.id, keyResponse.data] as const;
        }),
      );

      setMerchants(response.data);
      setKeys(Object.fromEntries(keyPairs));
      hydrateDrafts(response.data);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o Merchant Control Plane.",
      );
    } finally {
      setLoading(false);
    }
  }, [hydrateDrafts]);

  useEffect(() => {
    let active = true;

    adminFetch<{ success: true; data: Merchant[] }>("/api/v1/admin/merchants")
      .then(async (response) => {
        const keyPairs = await Promise.all(
          response.data.map(async (merchant) => {
            const keyResponse = await adminFetch<{
              success: true;
              data: ApiKeyRow[];
            }>(`/api/v1/admin/merchants/${merchant.id}/api-keys`);
            return [merchant.id, keyResponse.data] as const;
          }),
        );

        if (!active) return;
        setMerchants(response.data);
        setKeys(Object.fromEntries(keyPairs));
        hydrateDrafts(response.data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o Merchant Control Plane.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hydrateDrafts]);

  function updateDraft(merchantId: string, patch: Partial<KeyDraft>) {
    setDrafts((current) => ({
      ...current,
      [merchantId]: {
        name: current[merchantId]?.name ?? "Merchant S2S",
        storeCodes: current[merchantId]?.storeCodes ?? [],
        ...patch,
      },
    }));
  }

  function toggleStore(merchantId: string, code: string) {
    const current = drafts[merchantId]?.storeCodes ?? [];
    updateDraft(merchantId, {
      storeCodes: current.includes(code)
        ? current.filter((value) => value !== code)
        : [...current, code],
    });
  }

  async function generateKey(merchant: Merchant) {
    const draft = drafts[merchant.id];
    const storeCodes = draft?.storeCodes ?? [];

    if (!storeCodes.length) {
      setError("Seleciona pelo menos uma Store para conceder à nova API Key.");
      return;
    }

    setBusy(`create:${merchant.id}`);
    setGenerated(null);
    setMessage("");
    setError("");

    try {
      const response = await adminFetch<{
        success: true;
        data: GeneratedKey;
      }>(`/api/v1/admin/merchants/${merchant.id}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft?.name?.trim() || `${merchantLabel(merchant)} S2S`,
          storeCodes,
        }),
      });

      setGenerated(response.data);
      setMessage(
        "Nova API Key criada. Copia o segredo agora; ele não poderá ser recuperado.",
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

  async function revokeKey(merchant: Merchant, key: ApiKeyRow) {
    if (
      !window.confirm(
        `Revogar a chave "${key.name}" (${key.key_prefix}…)? Esta ação interrompe novas chamadas S2S que usem esta chave.`,
      )
    ) {
      return;
    }

    setBusy(`revoke:${key.id}`);
    setMessage("");
    setError("");

    try {
      await adminFetch(
        `/api/v1/admin/merchants/${merchant.id}/api-keys/${key.id}/revoke`,
        { method: "POST" },
      );
      setMessage(`API Key ${key.key_prefix}… revogada.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao revogar API Key.",
      );
    } finally {
      setBusy("");
    }
  }

  async function copySecret() {
    if (!generated?.secret) return;
    await navigator.clipboard.writeText(generated.secret);
    setMessage("API Key copiada para a área de transferência.");
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">COMMERCE CONTROL</span>
          <h1>Merchants & API Keys</h1>
          <p>
            Gestão de merchants, Stores, routing financeiro, release profiles e
            credenciais S2S com grants por Store.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          Atualizar
        </button>
      </section>

      <section className="merchant-summary-grid">
        <div className="panel merchant-summary-card">
          <span>Merchants</span>
          <strong>{merchants.length}</strong>
          <small>contas empresariais no PiXBrasil</small>
        </div>
        <div className="panel merchant-summary-card">
          <span>Stores</span>
          <strong>
            {merchants.reduce((total, merchant) => total + merchant.stores.length, 0)}
          </strong>
          <small>escopos financeiros configurados</small>
        </div>
        <div className="panel merchant-summary-card">
          <span>API Keys ativas</span>
          <strong>{activeKeyCount}</strong>
          <small>segredos nunca são persistidos em plaintext</small>
        </div>
      </section>

      {message ? (
        <div className="success-banner">
          <CheckCircle2 size={17} />
          {message}
        </div>
      ) : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      {generated ? (
        <section className="panel one-time-secret">
          <div className="panel-header">
            <div>
              <strong>API Key — exibição única</strong>
              <span>
                {generated.name} · Stores: {generated.storeCodes.join(", ")}
              </span>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="secret-value-row">
            <code>{generated.secret}</code>
            <button
              className="secondary-button"
              onClick={() => void copySecret()}
            >
              <Copy size={14} />
              Copiar
            </button>
          </div>
          <p>
            Guarda esta chave diretamente no ambiente server-side da aplicação.
            O PiXBrasil persiste somente o SHA-256 e o prefixo de identificação.
          </p>
        </section>
      ) : null}

      {loading && !merchants.length ? (
        <section className="panel merchant-loading">
          <LoaderCircle className="spin" size={20} />
          A carregar Merchant Control Plane…
        </section>
      ) : null}

      {!loading && !merchants.length ? (
        <section className="panel merchant-empty">
          <Building2 size={22} />
          <strong>Nenhum Merchant configurado</strong>
          <span>
            Cria primeiro a conta empresarial e as Stores antes de emitir
            credenciais S2S.
          </span>
        </section>
      ) : null}

      <section className="merchant-grid">
        {merchants.map((merchant) => {
          const draft = drafts[merchant.id] ?? {
            name: `${merchantLabel(merchant)} S2S`,
            storeCodes: [],
          };
          const merchantKeys = keys[merchant.id] ?? [];

          return (
            <article className="panel merchant-card" key={merchant.id}>
              <div className="merchant-card-head">
                <div className="provider-identity">
                  <div className="provider-mark">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <span className="eyebrow">{merchant.tier_code}</span>
                    <h2>{merchantLabel(merchant)}</h2>
                    <p>
                      Merchant {merchant.id} · Account {merchant.account_id}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    merchant.status === "ACTIVE"
                      ? "status-chip good"
                      : "status-chip"
                  }
                >
                  {merchant.status}
                </span>
              </div>

              <div className="merchant-store-list">
                {merchant.stores.map((storeRow) => (
                  <div className="merchant-store-row" key={storeRow.id}>
                    <div className="merchant-store-name">
                      <Store size={15} />
                      <div>
                        <strong>{storeRow.name}</strong>
                        <span>
                          {storeRow.code} · {storeRow.currency}
                        </span>
                      </div>
                    </div>
                    <div className="merchant-store-route">
                      <span>
                        <Route size={13} />
                        {storeRow.gatewayAlias ?? "gateway pendente"}
                      </span>
                      <span>
                        {storeRow.routeCostProfile ?? "cost profile pendente"}
                      </span>
                      <span>
                        {storeRow.releaseProfile ?? "release pendente"}
                      </span>
                      <span>{storeRow.routingMode ?? "routing pendente"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="merchant-key-builder">
                <div className="merchant-key-builder-head">
                  <div>
                    <span className="eyebrow">NOVA CREDENCIAL S2S</span>
                    <strong>API Key com grants por Store</strong>
                  </div>
                  <KeyRound size={17} />
                </div>

                <label className="merchant-key-name">
                  <span>Nome da chave</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft(merchant.id, { name: event.target.value })
                    }
                    maxLength={120}
                    placeholder="Novidades.Store S2S"
                  />
                </label>

                <div className="merchant-grants">
                  <span>Stores autorizadas</span>
                  <div className="merchant-grant-grid">
                    {merchant.stores.map((storeRow) => {
                      const checked = draft.storeCodes.includes(storeRow.code);
                      return (
                        <label
                          className={
                            checked
                              ? "merchant-grant-option selected"
                              : "merchant-grant-option"
                          }
                          key={storeRow.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={storeRow.status !== "ACTIVE"}
                            onChange={() =>
                              toggleStore(merchant.id, storeRow.code)
                            }
                          />
                          <span>
                            <strong>{storeRow.code}</strong>
                            <small>
                              {storeRow.gatewayAlias ?? "sem gateway"} ·{" "}
                              {storeRow.releaseClass ?? "—"}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="merchant-key-builder-actions">
                  <span>
                    Scopes: <code>payments:create</code> + <code>webhooks:manage</code> ·{" "}
                    {draft.storeCodes.length} Store(s)
                  </span>
                  <button
                    className="primary-button compact-action"
                    disabled={
                      busy === `create:${merchant.id}` ||
                      !draft.storeCodes.length ||
                      merchant.status !== "ACTIVE"
                    }
                    onClick={() => void generateKey(merchant)}
                  >
                    {busy === `create:${merchant.id}` ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <KeyRound size={14} />
                    )}
                    Gerar API Key
                  </button>
                </div>
              </div>

              <div className="merchant-api-section">
                <div>
                  <span className="eyebrow">CREDENCIAIS EXISTENTES</span>
                  <strong>
                    {merchantKeys.filter((key) => key.status === "ACTIVE").length}{" "}
                    ativa(s) · {merchantKeys.length} total
                  </strong>
                </div>
              </div>

              {merchantKeys.length ? (
                <div className="merchant-key-list">
                  {merchantKeys.map((keyRow) => (
                    <div key={keyRow.id} className="merchant-key-row">
                      <div className="merchant-key-main">
                        <strong>{keyRow.name}</strong>
                        <code>{keyRow.key_prefix}…</code>
                        <small>
                          Stores:{" "}
                          {keyRow.store_codes.length
                            ? keyRow.store_codes.join(", ")
                            : "sem grants"}
                        </small>
                      </div>
                      <div className="merchant-key-meta">
                        <span
                          className={
                            keyRow.status === "ACTIVE"
                              ? "status-chip good"
                              : "status-chip"
                          }
                        >
                          {keyRow.status}
                        </span>
                        <small>Criada: {formatDate(keyRow.created_at)}</small>
                        <small>
                          Last used: {formatDate(keyRow.last_used_at)}
                        </small>
                      </div>
                      {keyRow.status === "ACTIVE" ? (
                        <button
                          className="danger-button compact-action"
                          disabled={busy === `revoke:${keyRow.id}`}
                          onClick={() => void revokeKey(merchant, keyRow)}
                        >
                          {busy === `revoke:${keyRow.id}` ? (
                            <LoaderCircle className="spin" size={13} />
                          ) : (
                            <Ban size={13} />
                          )}
                          Revogar
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="merchant-no-keys">
                  Nenhuma API Key emitida para este Merchant.
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
