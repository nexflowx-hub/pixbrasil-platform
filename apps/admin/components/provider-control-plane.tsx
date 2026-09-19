"use client";

import {
  Activity,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TestTube2,
  Waypoints,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/api";

interface ConnectionRow {
  provider_id: string;
  provider_code: "PIXGO" | "MISTICPAY";
  provider_name: string;
  provider_status: string;
  provider_account_id: string | null;
  provider_account_label: string | null;
  provider_account_status: string | null;
  gateway_connection_id: string | null;
  gateway_alias: string | null;
  environment: string | null;
  connection_status: string | null;
  capabilities: Record<string, unknown> | null;
  limits: Record<string, unknown> | null;
  connection_metadata: Record<string, unknown> | null;
  has_credentials: boolean;
  credential_fingerprint: string | null;
  credential_created_at: string | null;
  routing_route_id: string | null;
  route_enabled: boolean | null;
  route_priority: number | null;
  routing_policy_id: string | null;
  routing_policy_name: string | null;
  activation_mode: string | null;
  routing_policy_status: string | null;
}

interface ControlResponse {
  success: true;
  data: {
    connections: ConnectionRow[];
    routingEnforcement: boolean;
  };
}

interface CredentialDraft {
  apiKey?: string;
  webhookSecret?: string;
  clientId?: string;
  clientSecret?: string;
}

export function ProviderControlPlane({
  mode = "vault",
}: {
  mode?: "library" | "vault";
}) {
  const [payload, setPayload] = useState<ControlResponse["data"] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CredentialDraft>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await adminFetch<ControlResponse>(
        "/api/v1/admin/provider-control-plane",
      );
      setPayload(response.data);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o Provider Control Plane.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => payload?.connections.filter((row) => row.gateway_connection_id) ?? [],
    [payload],
  );

  function updateDraft(
    connectionId: string,
    field: keyof CredentialDraft,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [connectionId]: {
        ...current[connectionId],
        [field]: value,
      },
    }));
  }

  async function saveCredentials(
    event: FormEvent<HTMLFormElement>,
    row: ConnectionRow,
  ) {
    event.preventDefault();
    if (!row.gateway_connection_id) return;

    const connectionId = row.gateway_connection_id;
    setBusy(`save:${connectionId}`);
    setMessage("");
    setError("");

    try {
      await adminFetch(
        `/api/v1/admin/gateway-connections/${connectionId}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(drafts[connectionId] ?? {}),
        },
      );
      setDrafts((current) => ({ ...current, [connectionId]: {} }));
      setMessage(`${row.gateway_alias}: credenciais gravadas no Vault.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao gravar credenciais.",
      );
    } finally {
      setBusy("");
    }
  }

  async function action(
    row: ConnectionRow,
    actionName: "test" | "promote-shadow",
  ) {
    if (!row.gateway_connection_id) return;
    const connectionId = row.gateway_connection_id;
    setBusy(`${actionName}:${connectionId}`);
    setMessage("");
    setError("");

    try {
      const result = await adminFetch<{
        success: true;
        data: Record<string, unknown>;
      }>(
        `/api/v1/admin/gateway-connections/${connectionId}/${actionName}`,
        { method: "POST" },
      );

      if (actionName === "test") {
        const health = result.data.health as
          | { status?: string; latencyMs?: number }
          | undefined;
        setMessage(
          `${row.gateway_alias}: ${health?.status ?? "TESTED"}` +
            (health?.latencyMs !== undefined
              ? ` · ${health.latencyMs} ms`
              : ""),
        );
      } else {
        setMessage(`${row.gateway_alias}: promovida para SHADOW.`);
      }

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Ação do provider falhou.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            {mode === "vault"
              ? "SECURE PROVIDER CREDENTIALS"
              : "PAYMENT INFRASTRUCTURE"}
          </span>
          <h1>{mode === "vault" ? "Gateway Vault" : "Provider Library"}</h1>
          <p>
            {mode === "vault"
              ? "Credenciais criptografadas, testes S2S e promoção controlada para SHADOW."
              : "Provider accounts, conexões, capacidades e estado de routing em tempo real."}
          </p>
        </div>

        <div className="heading-actions">
          <span
            className={
              payload?.routingEnforcement
                ? "status-chip gold"
                : "status-chip good"
            }
          >
            <ShieldCheck size={12} />
            Routing enforcement{" "}
            {payload?.routingEnforcement ? "ON" : "OFF"}
          </span>
          <button className="secondary-button" onClick={() => void load()}>
            <RefreshCw size={15} />
            Atualizar
          </button>
        </div>
      </section>

      {message ? (
        <div className="success-banner">
          <CheckCircle2 size={17} />
          {message}
        </div>
      ) : null}

      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="provider-control-grid">
        {rows.map((row) => {
          const connectionId = row.gateway_connection_id!;
          const metadata = row.connection_metadata ?? {};
          const credentialState = String(
            metadata.credentialState ??
              (row.has_credentials ? "STORED" : "MISSING"),
          );
          const lifecycleState = String(
            metadata.lifecycleState ?? "REGISTERED",
          );
          const validated = credentialState === "VALIDATED";
          const shadow = lifecycleState === "SHADOW";

          return (
            <article className="provider-control-card" key={connectionId}>
              <header className="provider-control-head">
                <div className="provider-identity">
                  <div className="provider-mark">
                    {row.provider_code.slice(0, 2)}
                  </div>
                  <div>
                    <span className="eyebrow">{row.provider_code}</span>
                    <h2>{row.provider_name}</h2>
                    <p>{row.gateway_alias}</p>
                  </div>
                </div>

                <div className="provider-state-stack">
                  <span
                    className={
                      row.connection_status === "ACTIVE"
                        ? "status-chip good"
                        : "status-chip gold"
                    }
                  >
                    {row.connection_status}
                  </span>
                  <span className="status-chip">
                    {row.activation_mode ?? "SHADOW"}
                  </span>
                </div>
              </header>

              <div className="provider-facts">
                <ProviderFact
                  icon={ServerCog}
                  label="Provider account"
                  value={row.provider_account_label ?? "—"}
                />
                <ProviderFact
                  icon={KeyRound}
                  label="Credential state"
                  value={credentialState}
                  good={validated}
                />
                <ProviderFact
                  icon={Waypoints}
                  label="Routing route"
                  value={
                    row.route_enabled
                      ? `ENABLED · P${row.route_priority ?? "—"}`
                      : "DISABLED"
                  }
                  good={Boolean(row.route_enabled)}
                />
                <ProviderFact
                  icon={Activity}
                  label="Lifecycle"
                  value={lifecycleState}
                  good={shadow}
                />
              </div>

              <div className="credential-fingerprint">
                <LockKeyhole size={14} />
                <div>
                  <span>Vault fingerprint</span>
                  <code>
                    {row.credential_fingerprint
                      ? `…${row.credential_fingerprint.slice(-16)}`
                      : "NO ACTIVE SECRET"}
                  </code>
                </div>
              </div>

              {mode === "vault" ? (
                <>
                  <form
                    className="provider-credential-form"
                    onSubmit={(event) => void saveCredentials(event, row)}
                  >
                    {row.provider_code === "PIXGO" ? (
                      <>
                        <label>
                          API Key
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder="pk_••••••••••••"
                            value={drafts[connectionId]?.apiKey ?? ""}
                            onChange={(event) =>
                              updateDraft(
                                connectionId,
                                "apiKey",
                                event.target.value,
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          Webhook Secret
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder="whsec_•••••••••••• (opcional nesta fase)"
                            value={
                              drafts[connectionId]?.webhookSecret ?? ""
                            }
                            onChange={(event) =>
                              updateDraft(
                                connectionId,
                                "webhookSecret",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          Access Key ID
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder="pk_••••••••••••"
                            value={drafts[connectionId]?.clientId ?? ""}
                            onChange={(event) =>
                              updateDraft(
                                connectionId,
                                "clientId",
                                event.target.value,
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          Access Key Secret
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder="sk_••••••••••••"
                            value={
                              drafts[connectionId]?.clientSecret ?? ""
                            }
                            onChange={(event) =>
                              updateDraft(
                                connectionId,
                                "clientSecret",
                                event.target.value,
                              )
                            }
                            required
                          />
                        </label>
                      </>
                    )}

                    <div className="provider-actions">
                      <button
                        className="secondary-button"
                        type="submit"
                        disabled={busy === `save:${connectionId}`}
                      >
                        <KeyRound size={14} />
                        {row.has_credentials ? "Rotacionar Vault" : "Gravar no Vault"}
                      </button>

                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          !row.has_credentials ||
                          busy === `test:${connectionId}`
                        }
                        onClick={() => void action(row, "test")}
                      >
                        <TestTube2 size={14} />
                        Testar conexão
                      </button>

                      <button
                        className="primary-button compact-action"
                        type="button"
                        disabled={
                          !validated ||
                          shadow ||
                          Boolean(payload?.routingEnforcement) ||
                          busy === `promote-shadow:${connectionId}`
                        }
                        onClick={() => void action(row, "promote-shadow")}
                      >
                        <ShieldCheck size={14} />
                        {shadow ? "Em SHADOW" : "Promover SHADOW"}
                      </button>
                    </div>
                  </form>

                  <p className="provider-security-note">
                    Segredos são enviados somente à API autenticada AAL2,
                    criptografados no Supabase Vault e nunca retornados ao
                    browser.
                  </p>
                </>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ProviderFact({
  icon: Icon,
  label,
  value,
  good = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="provider-fact">
      <Icon size={15} />
      <div>
        <span>{label}</span>
        <strong className={good ? "fact-good" : ""}>{value}</strong>
      </div>
    </div>
  );
}
