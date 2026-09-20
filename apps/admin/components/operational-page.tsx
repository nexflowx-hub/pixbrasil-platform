"use client";

import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  CircleDollarSign,
  Database,
  FileClock,
  Landmark,
  LoaderCircle,
  Radar,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/api";

type Kind =
  | "onboarding"
  | "stores"
  | "transactions"
  | "ledger"
  | "settlements"
  | "payouts"
  | "users"
  | "audit"
  | "system"
  | "risk";

const definitions = {
  onboarding: {
    endpoint: "/api/v1/admin/onboarding",
    eyebrow: "ACCOUNT LIFECYCLE",
    title: "Onboarding",
    description: "Contas, KYC, identidade, produtos e membros ativos.",
    icon: BookOpenCheck,
    sections: [{ key: "root", title: "Accounts", columns: ["email","account_type","account_status","kyc_status","identity_level","products","active_members","created_at"] }],
  },
  stores: {
    endpoint: "/api/v1/admin/stores",
    eyebrow: "COMMERCE CONTROL",
    title: "Stores",
    description: "Escopo financeiro, provider, routing e release por Store.",
    icon: Store,
    sections: [{ key: "root", title: "Store topology", columns: ["merchant","code","status","provider_code","gateway_alias","provider_health","route_cost_profile","release_profile","release_class","activation_mode"] }],
  },
  transactions: {
    endpoint: "/api/v1/admin/transactions",
    eyebrow: "PAYMENT OPERATIONS",
    title: "Transactions",
    description: "PaymentIntents e última tentativa conhecida de provider.",
    icon: Activity,
    sections: [{ key: "root", title: "Payment timeline", columns: ["external_reference","merchant","store_code","amount","currency","status","provider_code","gateway_alias","provider_attempt_status","ambiguous","created_at"] }],
  },
  ledger: {
    endpoint: "/api/v1/admin/ledger",
    eyebrow: "FINANCIAL CORE",
    title: "Ledger & Balances",
    description: "Ledger imutável e saldos materializados, em modo read-only.",
    icon: Database,
    sections: [
      { key: "transactions", title: "Ledger transactions", columns: ["reference","type","status","external_reference","entry_count","created_at","posted_at"] },
      { key: "balances", title: "Wallet balances", columns: ["account_type","asset_code","network","available","pending","reserved","blocked","wallet_status","updated_at"] },
    ],
  },
  settlements: {
    endpoint: "/api/v1/admin/settlements",
    eyebrow: "TREASURY",
    title: "Settlements",
    description: "Disponibilidade, fees e net settlement por PaymentIntent.",
    icon: Landmark,
    sections: [{ key: "root", title: "Settlement book", columns: ["external_reference","merchant","store_code","gross_brl","provider_fee_brl","platform_fee_brl","net_brl","settlement_asset","status","available_at"] }],
  },
  payouts: {
    endpoint: "/api/v1/admin/payouts",
    eyebrow: "TREASURY",
    title: "Payouts",
    description: "Pedidos e evidência de payout. Escrita permanece feature-flagged.",
    icon: CircleDollarSign,
    sections: [{ key: "root", title: "Payout queue", columns: ["account_type","asset_code","amount","destination_type","status","external_reference","approval_request_id","created_at","confirmed_at"] }],
  },
  users: {
    endpoint: "/api/v1/admin/users",
    eyebrow: "ACCESS CONTROL",
    title: "Users & RBAC",
    description: "Administradores, roles, MFA e atividade de sessão.",
    icon: Users,
    sections: [{ key: "root", title: "Control-plane users", columns: ["email","display_name","status","roles","require_mfa","last_seen_at","created_at"] }],
  },
  audit: {
    endpoint: "/api/v1/admin/audit",
    eyebrow: "CONTROL EVIDENCE",
    title: "Audit",
    description: "Trilha administrativa sem reexpor payloads sensíveis.",
    icon: Radar,
    sections: [{ key: "root", title: "Audit events", columns: ["created_at","actor_type","actor_name","actor_email","action","resource_type","resource_id","request_id"] }],
  },
  system: {
    endpoint: "/api/v1/admin/system",
    eyebrow: "PLATFORM CONTROL",
    title: "System",
    description: "Feature flags, configurações e migrações do Core.",
    icon: Settings2,
    sections: [
      { key: "featureFlags", title: "Feature flags", columns: ["key","enabled","description","updated_at"] },
      { key: "settings", title: "System settings", columns: ["key","value","description","updated_at"] },
      { key: "migrations", title: "Recent migrations", columns: ["version","name"] },
    ],
  },
  risk: {
    endpoint: "/api/v1/admin/risk",
    eyebrow: "RISK & COMPLIANCE",
    title: "Risk posture",
    description: "Estado de KYC, pagamentos e webhooks. Scoring dedicado ainda não está ativo.",
    icon: ShieldCheck,
    sections: [
      { key: "accountPosture", title: "Account posture", columns: ["account_status","kyc_status","total"] },
      { key: "paymentPosture", title: "Payment posture", columns: ["status","total"] },
      { key: "webhookPosture", title: "Webhook posture", columns: ["status","total"] },
    ],
  },
} as const;

export function OperationalPage({ kind }: { kind: Kind }) {
  const meta = definitions[kind];
  const Icon = meta.icon;
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return adminFetch<{ success: true; data: unknown }>(meta.endpoint);
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
  }, [meta.endpoint, refresh]);

  const total = useMemo(() => {
    if (Array.isArray(payload)) return payload.length;
    if (payload && typeof payload === "object") {
      return Object.values(payload as Record<string, unknown>).reduce<number>(
        (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
        0,
      );
    }
    return 0;
  }, [payload]);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{meta.eyebrow}</span>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top"><span>Visible records</span><Icon size={17} /></div>
          <strong>{String(total).padStart(2, "0")}</strong>
          <p>operational control view</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top"><span>Access</span><ShieldCheck size={17} /></div>
          <strong>RBAC</strong>
          <p>AAL2 control plane</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top"><span>Writes</span><FileClock size={17} /></div>
          <strong>GUARDED</strong>
          <p>feature flags + approvals</p>
          <div className="metric-line" />
        </article>
      </section>

      {error ? (
        <div className="warning-banner">
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {meta.sections.map((section) => {
        const rows = rowsFor(payload, section.key);
        return (
          <section className="panel" key={section.key}>
            <div className="panel-header">
              <div>
                <strong>{section.title}</strong>
                <span>{loading ? "A carregar…" : rows.length ? String(rows.length) + " registos" : "sem registos"}</span>
              </div>
              <Icon size={17} />
            </div>
            <OperationalTable rows={rows} columns={[...section.columns]} loading={loading} />
          </section>
        );
      })}

      {kind === "risk" ? (
        <div className="warning-banner">
          <ShieldCheck size={17} />
          Risk scoring transacional dedicado ainda não está ativo. O painel apresenta a postura factual atual da operação.
        </div>
      ) : null}
    </div>
  );
}

function rowsFor(payload: unknown, key: string): Record<string, unknown>[] {
  if (key === "root") return Array.isArray(payload) ? payload as Record<string, unknown>[] : [];
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function OperationalTable({
  rows,
  columns,
  loading,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="empty-state"><LoaderCircle className="spin" size={16} /> A carregar dados do Core…</div>;
  }
  if (!rows.length) {
    return <div className="empty-state">Nenhum registo neste módulo.</div>;
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{label(column)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? row.key ?? index)}>
              {columns.map((column) => (
                <td key={column}>{renderValue(row[column], column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderValue(value: unknown, column: string) {
  if (value == null || value === "") return <span className="muted-value">—</span>;
  if (typeof value === "boolean") {
    return <span className={value ? "status-chip good" : "status-chip gold"}>{value ? "ON" : "OFF"}</span>;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    const compact = JSON.stringify(value);
    return compact.length > 72 ? compact.slice(0, 69) + "…" : compact;
  }
  const string = String(value);
  if (column.includes("status") || column.includes("health") || column.includes("mode")) {
    const good = ["ACTIVE","HEALTHY","READY","ONLINE","SUCCEEDED","PROCESSED","APPROVED"].includes(string.toUpperCase());
    return <span className={good ? "status-chip good" : "status-chip gold"}>{string}</span>;
  }
  if (column.endsWith("_at") || column === "created_at") {
    const date = new Date(string);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("pt-BR");
  }
  return string;
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
