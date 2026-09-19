"use client";

import { useEffect, useState } from "react";
import {
  Blocks,
  FileCheck2,
  GitBranch,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { adminFetch } from "@/lib/api";

type PageKind = "providers" | "routing" | "approvals";

const config = {
  providers: {
    title: "Provider Library",
    eyebrow: "PAYMENT INFRASTRUCTURE",
    description:
      "Providers disponíveis no Core e respetivas contas/conexões operacionais.",
    endpoint: "/api/v1/admin/providers",
    icon: Blocks,
  },
  routing: {
    title: "Routing Studio",
    eyebrow: "DECISION ENGINE",
    description:
      "Políticas de roteamento e feature flags. Enforcement continua bloqueado até ativação controlada.",
    endpoint: "/api/v1/admin/routing/overview",
    icon: GitBranch,
  },
  approvals: {
    title: "Approval Queue",
    eyebrow: "MAKER / CHECKER",
    description:
      "Ações críticas pendentes de aprovação e step-up authentication.",
    endpoint: "/api/v1/admin/approvals",
    icon: FileCheck2,
  },
} satisfies Record<PageKind, unknown>;

export function DataPage({ kind }: { kind: PageKind }) {
  const meta = config[kind] as {
    title: string;
    eyebrow: string;
    description: string;
    endpoint: string;
    icon: typeof Blocks;
  };
  const Icon = meta.icon;
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    adminFetch<unknown>(meta.endpoint)
      .then((data) => {
        if (active) {
          setError("");
          setPayload(data);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Erro de leitura");
      });
    return () => {
      active = false;
    };
  }, [meta.endpoint, refreshKey]);

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
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Atualizar
        </button>
      </section>

      {error ? (
        <div className="warning-banner">
          <ShieldAlert size={17} />
          {error}
        </div>
      ) : null}

      <section className="panel data-inspector">
        <div className="panel-header">
          <div>
            <strong>Live API response</strong>
            <span>Read-only · no-store</span>
          </div>
          <Icon size={18} />
        </div>
        <pre>{payload ? JSON.stringify(payload, null, 2) : "A carregar…"}</pre>
      </section>
    </div>
  );
}
