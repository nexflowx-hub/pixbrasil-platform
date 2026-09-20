"use client";

import {
  CheckCircle2,
  Landmark,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

interface SettlementRow {
  id: string;
  payment_intent_id: string;
  external_reference: string | null;
  merchant: string | null;
  store_code: string | null;
  gross_brl: string;
  provider_fee_brl: string;
  platform_fee_brl: string;
  net_brl: string;
  settlement_asset: string | null;
  status: string;
  available_at: string | null;
  created_at: string;
}

function brl(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function SettlementControl() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch<{ success: true; data: SettlementRow[] }>(
        "/api/v1/admin/settlements",
      );
      setRows(response.data);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao carregar settlements.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function release(row: SettlementRow) {
    if (
      !window.confirm(
        "Liberar " +
          brl(row.net_brl) +
          " para a Wallet BRL de " +
          (row.merchant ?? "merchant") +
          "?",
      )
    ) {
      return;
    }

    setBusy(row.id);
    setError("");
    setMessage("");
    try {
      await adminFetch("/api/v1/admin/settlements/" + row.id + "/release", {
        method: "POST",
      });
      setMessage(
        "Settlement " +
          (row.external_reference ?? row.id.slice(0, 8)) +
          " liberado.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao liberar settlement.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">TREASURY · RELEASE CONTROL</span>
          <h1>Settlements & Liberações</h1>
          <p>
            D0 entra disponível automaticamente. D1 permanece pendente até a
            confirmação operacional do provider.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top">
            <span>Total</span>
            <Landmark size={17} />
          </div>
          <strong>{rows.length}</strong>
          <p>settlements registrados</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top">
            <span>Pendentes</span>
            <RefreshCw size={17} />
          </div>
          <strong>{rows.filter((row) => row.status === "PENDING").length}</strong>
          <p>aguardando liberação</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top">
            <span>Disponíveis</span>
            <CheckCircle2 size={17} />
          </div>
          <strong>{rows.filter((row) => row.status === "AVAILABLE").length}</strong>
          <p>creditados na Wallet BRL</p>
          <div className="metric-line" />
        </article>
      </section>

      {message ? (
        <div className="success-banner">
          <CheckCircle2 size={17} />
          {message}
        </div>
      ) : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Settlement book</strong>
            <span>{loading ? "A carregar…" : String(rows.length) + " registros"}</span>
          </div>
          <Landmark size={17} />
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Referência</th>
                <th>Merchant</th>
                <th>Store</th>
                <th>Bruto</th>
                <th>Fees</th>
                <th>Líquido</th>
                <th>Status</th>
                <th>Disponível em</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.external_reference ?? row.id.slice(0, 8)}</strong>
                  </td>
                  <td>{row.merchant ?? "—"}</td>
                  <td>{row.store_code ?? "—"}</td>
                  <td>{brl(row.gross_brl)}</td>
                  <td>{brl(Number(row.provider_fee_brl) + Number(row.platform_fee_brl))}</td>
                  <td>
                    <strong>{brl(row.net_brl)}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        row.status === "AVAILABLE"
                          ? "status-chip good"
                          : "status-chip gold"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {row.available_at
                      ? new Date(row.available_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td>
                    {row.status === "PENDING" ? (
                      <button
                        className="primary-button compact-action"
                        disabled={busy === row.id}
                        onClick={() => void release(row)}
                      >
                        {busy === row.id ? (
                          <LoaderCircle className="spin" size={13} />
                        ) : null}
                        Liberar
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      Nenhum settlement registrado.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
