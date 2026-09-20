"use client";

import {
  AlertTriangle,
  FileCheck2,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

type PageKind = "routing" | "approvals";

interface RoutingPayload {
  policies: Array<{
    id: string;
    name: string;
    payment_method: string;
    currency: string;
    strategy: string;
    activation_mode: string;
    status: string;
    priority: number;
    version: number;
    route_count: number;
  }>;
  featureFlags: Array<{
    key: string;
    enabled: boolean;
    description?: string;
    updated_at?: string;
  }>;
}

interface ApprovalRow {
  id: string;
  action_code: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  required_approvals: number;
  approval_count: number;
  min_aal: string;
  maker_checker_required: boolean;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export function DataPage({ kind }: { kind: PageKind }) {
  const routing = kind === "routing";
  const [payload, setPayload] = useState<RoutingPayload | ApprovalRow[] | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  const endpoint = routing
    ? "/api/v1/admin/routing/overview"
    : "/api/v1/admin/approvals";

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return adminFetch<{ success: true; data: RoutingPayload | ApprovalRow[] }>(endpoint);
      })
      .then((response) => {
        if (!active) return;
        setPayload(response.data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Falha de leitura.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, refresh]);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{routing ? "DECISION ENGINE" : "MAKER / CHECKER"}</span>
          <h1>{routing ? "Routing Studio" : "Approval Queue"}</h1>
          <p>
            {routing
              ? "Políticas, rotas e kill-switches que controlam a seleção de provider."
              : "Ações críticas que exigem aprovação independente e AAL2."}
          </p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      {error ? <div className="warning-banner"><AlertTriangle size={17} />{error}</div> : null}

      {routing ? (
        <RoutingView payload={payload as RoutingPayload | null} loading={loading} />
      ) : (
        <ApprovalView rows={(payload as ApprovalRow[] | null) ?? []} loading={loading} />
      )}
    </div>
  );
}

function RoutingView({ payload, loading }: { payload: RoutingPayload | null; loading: boolean }) {
  return (
    <>
      <section className="metric-grid">
        <Metric label="Policies" value={String(payload?.policies.length ?? 0)} icon={GitBranch} />
        <Metric
          label="Enforcement"
          value={payload?.featureFlags.find((flag) => flag.key === "routing_enforcement")?.enabled ? "ON" : "OFF"}
          icon={ShieldCheck}
          gold
        />
        <Metric
          label="Live payments"
          value={payload?.featureFlags.find((flag) => flag.key === "live_payment_execution")?.enabled ? "ON" : "OFF"}
          icon={ShieldCheck}
          gold
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><strong>Routing policies</strong><span>store/account scoped decisions</span></div>
          <GitBranch size={17} />
        </div>
        {loading ? <Loading /> : (
          <div className="table-shell">
            <table>
              <thead><tr><th>Policy</th><th>Method</th><th>Strategy</th><th>Mode</th><th>Routes</th><th>Version</th><th>Status</th></tr></thead>
              <tbody>
                {payload?.policies.length ? payload.policies.map((policy) => (
                  <tr key={policy.id}>
                    <td><strong>{policy.name}</strong></td>
                    <td>{policy.payment_method} · {policy.currency}</td>
                    <td>{policy.strategy}</td>
                    <td><span className="status-chip gold">{policy.activation_mode}</span></td>
                    <td>{policy.route_count}</td>
                    <td>v{policy.version}</td>
                    <td>{policy.status}</td>
                  </tr>
                )) : <tr><td colSpan={7}><Empty label="Nenhuma política configurada." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><strong>Safety switches</strong><span>financial writes remain guarded</span></div>
          <ShieldCheck size={17} />
        </div>
        <div className="security-list">
          {(payload?.featureFlags ?? []).map((flag) => (
            <div className="security-item" key={flag.key}>
              <span>{flag.key}</span>
              <strong className={flag.enabled ? "" : "muted-value"}>{flag.enabled ? "ON" : "OFF"}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ApprovalView({ rows, loading }: { rows: ApprovalRow[]; loading: boolean }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div><strong>Critical action queue</strong><span>maker-checker evidence</span></div>
        <FileCheck2 size={17} />
      </div>
      {loading ? <Loading /> : (
        <div className="table-shell">
          <table>
            <thead><tr><th>Created</th><th>Action</th><th>Resource</th><th>Approvals</th><th>AAL</th><th>Maker-checker</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                  <td><strong>{row.action_code}</strong></td>
                  <td>{row.resource_type}{row.resource_id ? " · " + row.resource_id : ""}</td>
                  <td>{row.approval_count}/{row.required_approvals}</td>
                  <td>{row.min_aal}</td>
                  <td>{row.maker_checker_required ? "YES" : "NO"}</td>
                  <td><span className={row.status === "APPROVED" ? "status-chip good" : "status-chip gold"}>{row.status}</span></td>
                </tr>
              )) : <tr><td colSpan={7}><Empty label="Nenhuma ação crítica pendente." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, icon: Icon, gold = false }: { label: string; value: string; icon: typeof GitBranch; gold?: boolean }) {
  return (
    <article className={"metric-card " + (gold ? "tone-gold" : "tone-aqua")}>
      <div className="metric-top"><span>{label}</span><Icon size={17} /></div>
      <strong>{value}</strong>
      <p>control-plane state</p>
      <div className="metric-line" />
    </article>
  );
}

function Loading() {
  return <div className="empty-state"><LoaderCircle className="spin" size={16} /> A carregar…</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}
