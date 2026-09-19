"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Radio,
  Server,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL, adminFetch } from "@/lib/api";

interface Provider {
  id: string;
  code: string;
  name: string;
  status: string;
  environment: string;
  provider_account_count: number;
  gateway_connection_count: number;
}

interface ProviderResponse {
  success: true;
  data: Provider[];
}

interface RoutingResponse {
  success: true;
  data: {
    policies: Array<{
      id: string;
      name: string;
      strategy: string;
      activation_mode: string;
      status: string;
      route_count: number;
    }>;
    featureFlags: Array<{ key: string; enabled: boolean }>;
  };
}

interface ApprovalResponse {
  success: true;
  data: Array<{
    id: string;
    action_code: string;
    resource_type: string;
    status: string;
    approval_count: number;
    required_approvals: number;
  }>;
}

interface ReadyResponse {
  success: boolean;
  version: string;
  status: string;
  database: { status: string; latencyMs: number };
  redis: { status: string; latencyMs: number };
}

export function DashboardOverview() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routing, setRouting] = useState<RoutingResponse["data"] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalResponse["data"]>([]);
  const [ready, setReady] = useState<ReadyResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      adminFetch<ProviderResponse>("/api/v1/admin/providers"),
      adminFetch<RoutingResponse>("/api/v1/admin/routing/overview"),
      adminFetch<ApprovalResponse>("/api/v1/admin/approvals"),
      fetch(`${API_URL}/api/health/ready`, { cache: "no-store" }).then(
        (response) => response.json() as Promise<ReadyResponse>,
      ),
    ])
      .then(([providerData, routingData, approvalData, readyData]) => {
        if (!active) return;
        setProviders(providerData.data);
        setRouting(routingData.data);
        setApprovals(approvalData.data);
        setReady(readyData);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Falha de telemetria");
      });

    return () => {
      active = false;
    };
  }, []);

  const connectedProviders = providers.filter(
    (provider) => provider.provider_account_count > 0,
  ).length;
  const routingEnforced =
    routing?.featureFlags.find((flag) => flag.key === "routing_enforcement")
      ?.enabled ?? false;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">NETWORK OPERATIONS CENTER</span>
          <h1>Overview</h1>
          <p>
            Estado operacional, providers, routing e ações críticas do Atlas
            Financial Core.
          </p>
        </div>
        <div className="heading-actions">
          <span className="live-pill"><i /> LIVE TELEMETRY</span>
          <span className="timestamp">{new Date().toLocaleDateString("pt-BR")}</span>
        </div>
      </section>

      {error ? <div className="warning-banner"><AlertTriangle size={17} />{error}</div> : null}

      <section className="metric-grid">
        <Metric
          label="Runtime"
          value={ready?.status || "CHECKING"}
          detail={ready ? `API v${ready.version}` : "A validar"}
          icon={Server}
          tone="green"
        />
        <Metric
          label="Providers"
          value={String(providers.length || 0).padStart(2, "0")}
          detail={`${connectedProviders} com conta configurada`}
          icon={Waypoints}
          tone="aqua"
        />
        <Metric
          label="Routing"
          value={routingEnforced ? "ENFORCED" : "SHADOW"}
          detail={`${routing?.policies.length || 0} políticas`}
          icon={GitBranch}
          tone={routingEnforced ? "green" : "gold"}
        />
        <Metric
          label="Approval Queue"
          value={String(approvals.length)}
          detail="ações pendentes / aprovadas"
          icon={ShieldCheck}
          tone={approvals.length ? "gold" : "green"}
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel panel-wide">
          <PanelHeader
            title="Provider health"
            subtitle="Biblioteca e conexões ativas"
            icon={Radio}
          />
          <div className="provider-list">
            {providers.length ? (
              providers.map((provider) => (
                <div className="provider-row" key={provider.id}>
                  <div className="provider-mark">
                    {provider.code.slice(0, 2)}
                  </div>
                  <div className="provider-name">
                    <strong>{provider.name}</strong>
                    <span>{provider.code} · {provider.environment}</span>
                  </div>
                  <div className="provider-meta">
                    <span>{provider.provider_account_count} accounts</span>
                    <span>{provider.gateway_connection_count} gateways</span>
                  </div>
                  <span className={provider.status === "ACTIVE" ? "status-chip good" : "status-chip"}>
                    <i />
                    {provider.status}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState label="Nenhum provider cadastrado." />
            )}
          </div>
        </div>

        <div className="panel">
          <PanelHeader
            title="Core health"
            subtitle="Readiness em tempo real"
            icon={Activity}
          />
          <div className="health-stack">
            <HealthRow
              label="PostgreSQL"
              status={ready?.database.status || "CHECKING"}
              latency={ready?.database.latencyMs}
              icon={Database}
            />
            <HealthRow
              label="Redis"
              status={ready?.redis.status || "CHECKING"}
              latency={ready?.redis.latencyMs}
              icon={Radio}
            />
            <HealthRow
              label="Admin API"
              status={ready?.status === "READY" ? "ONLINE" : "CHECKING"}
              icon={Server}
            />
          </div>
        </div>

        <div className="panel panel-wide">
          <PanelHeader
            title="Routing policies"
            subtitle="Decisões ainda protegidas por feature flag"
            icon={GitBranch}
          />
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Strategy</th>
                  <th>Mode</th>
                  <th>Routes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {routing?.policies.length ? (
                  routing.policies.map((policy) => (
                    <tr key={policy.id}>
                      <td><strong>{policy.name}</strong></td>
                      <td>{policy.strategy}</td>
                      <td><span className="status-chip gold">{policy.activation_mode}</span></td>
                      <td>{policy.route_count}</td>
                      <td>{policy.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}><EmptyState label="Nenhuma política criada ainda." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <PanelHeader
            title="Security posture"
            subtitle="Guardrails ativos"
            icon={ShieldCheck}
          />
          <div className="security-list">
            <SecurityItem label="Admin MFA" value="AAL2" />
            <SecurityItem label="RBAC source" value="CONTROLPLANE" />
            <SecurityItem label="Routing enforcement" value={routingEnforced ? "ON" : "OFF"} muted={!routingEnforced} />
            <SecurityItem label="Manual payouts" value="OFF" muted />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Server;
  tone: "green" | "aqua" | "gold";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
      <div className="metric-line" />
    </article>
  );
}

function PanelHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: typeof Server;
}) {
  return (
    <div className="panel-header">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Icon size={17} />
    </div>
  );
}

function HealthRow({
  label,
  status,
  latency,
  icon: Icon,
}: {
  label: string;
  status: string;
  latency?: number;
  icon: typeof Server;
}) {
  const healthy = status === "ONLINE" || status === "READY";
  return (
    <div className="health-row">
      <div className="health-icon"><Icon size={16} /></div>
      <div>
        <strong>{label}</strong>
        <span>{latency !== undefined ? `${latency} ms` : "guarded"}</span>
      </div>
      <span className={healthy ? "status-chip good" : "status-chip gold"}>
        {healthy ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
        {status}
      </span>
    </div>
  );
}

function SecurityItem({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="security-item">
      <span>{label}</span>
      <strong className={muted ? "muted-value" : ""}>{value}</strong>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <Network size={17} />
      <span>{label}</span>
      <ArrowUpRight size={14} />
    </div>
  );
}
