"use client";

import {
  Building2,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  Route,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

export function MerchantControlPlane() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [keys, setKeys] = useState<Record<string, ApiKeyRow[]>>({});
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await adminFetch<{ success: true; data: Merchant[] }>(
      "/api/v1/admin/merchants",
    );
    setMerchants(response.data);
    setError("");

    for (const merchant of response.data) {
      const keyResponse = await adminFetch<{
        success: true;
        data: ApiKeyRow[];
      }>(`/api/v1/admin/merchants/${merchant.id}/api-keys`);
      setKeys((current) => ({
        ...current,
        [merchant.id]: keyResponse.data,
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminFetch<{ success: true; data: Merchant[] }>("/api/v1/admin/merchants")
      .then(async (response) => {
        if (!active) return;
        setMerchants(response.data);
        setError("");

        const keyPairs = await Promise.all(
          response.data.map(async (merchant) => {
            const keyResponse = await adminFetch<{
              success: true;
              data: ApiKeyRow[];
            }>(`/api/v1/admin/merchants/${merchant.id}/api-keys`);
            return [merchant.id, keyResponse.data] as const;
          }),
        );

        if (active) setKeys(Object.fromEntries(keyPairs));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar merchants.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  async function generateKey(merchant: Merchant) {
    setBusy(merchant.id);
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
          name: `${merchant.trade_name ?? "Merchant"} S2S Pilot`,
          storeCodes: merchant.stores.map((store) => store.code),
        }),
      });

      setGenerated(response.data);
      setMessage("Nova API Key criada. Copia o segredo agora; ele não poderá ser recuperado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao criar API Key.",
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
          <h1>Merchants</h1>
          <p>
            Merchants, stores, routing financeiro, release profiles e credenciais S2S.
          </p>
        </div>
        <button className="secondary-button" onClick={() => void load()}>
          <RefreshCw size={15} />
          Atualizar
        </button>
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
              <span>{generated.name}</span>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="secret-value-row">
            <code>{generated.secret}</code>
            <button className="secondary-button" onClick={() => void copySecret()}>
              <Copy size={14} />
              Copiar
            </button>
          </div>
          <p>
            Guarda esta chave diretamente no ambiente server-side da Novidades.Store.
            O PiXBrasil persiste apenas o hash SHA-256.
          </p>
        </section>
      ) : null}

      <section className="merchant-grid">
        {merchants.map((merchant) => (
          <article className="panel merchant-card" key={merchant.id}>
            <div className="merchant-card-head">
              <div className="provider-identity">
                <div className="provider-mark">
                  <Building2 size={18} />
                </div>
                <div>
                  <span className="eyebrow">{merchant.tier_code}</span>
                  <h2>{merchant.trade_name ?? merchant.legal_name ?? "Merchant"}</h2>
                  <p>{merchant.id}</p>
                </div>
              </div>
              <span className="status-chip good">{merchant.status}</span>
            </div>

            <div className="merchant-store-list">
              {merchant.stores.map((storeRow) => (
                <div className="merchant-store-row" key={storeRow.id}>
                  <div className="merchant-store-name">
                    <Store size={15} />
                    <div>
                      <strong>{storeRow.name}</strong>
                      <span>{storeRow.code}</span>
                    </div>
                  </div>
                  <div className="merchant-store-route">
                    <span>
                      <Route size={13} />
                      {storeRow.gatewayAlias ?? "—"}
                    </span>
                    <span>{storeRow.releaseProfile ?? "—"}</span>
                    <span>{storeRow.routingMode ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="merchant-api-section">
              <div>
                <span className="eyebrow">S2S API KEYS</span>
                <strong>{keys[merchant.id]?.length ?? 0} ativa(s)/históricas</strong>
              </div>
              <button
                className="primary-button compact-action"
                disabled={busy === merchant.id}
                onClick={() => void generateKey(merchant)}
              >
                <KeyRound size={14} />
                Gerar chave S2S
              </button>
            </div>

            {(keys[merchant.id] ?? []).length ? (
              <div className="merchant-key-list">
                {(keys[merchant.id] ?? []).map((keyRow) => (
                  <div key={keyRow.id} className="merchant-key-row">
                    <div>
                      <strong>{keyRow.name}</strong>
                      <code>{keyRow.key_prefix}…</code>
                    </div>
                    <div>
                      <span className={keyRow.status === "ACTIVE" ? "status-chip good" : "status-chip"}>
                        {keyRow.status}
                      </span>
                      <small>
                        {keyRow.last_used_at
                          ? `last used ${new Date(keyRow.last_used_at).toLocaleString()}`
                          : "never used"}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
