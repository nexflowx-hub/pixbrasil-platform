"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

interface PayoutRow {
  id: string;
  account_id: string;
  account_type: string;
  asset_code: string;
  symbol: string;
  amount: string;
  destination_type: string | null;
  status: string;
  external_reference: string | null;
  approval_request_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

function money(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function PayoutControl() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch<{ success: true; data: PayoutRow[] }>(
        "/api/v1/admin/payouts",
      );
      setRows(response.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar payouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function transition(
    payout: PayoutRow,
    status: "PROCESSING" | "PAID" | "CONFIRMED" | "REJECTED" | "CANCELED" | "FAILED",
  ) {
    const externalReference =
      status === "PAID" || status === "CONFIRMED"
        ? window.prompt(
            "Referência/comprovativo externo do payout (opcional):",
            payout.external_reference ?? "",
          ) ?? ""
        : "";

    setBusy(payout.id + ":" + status);
    setError("");
    setMessage("");
    try {
      await adminFetch("/api/v1/admin/payouts/" + payout.id + "/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          externalReference,
          proofMetadata: { processedVia: "ADMIN_CONTROL_PLANE" },
        }),
      });
      setMessage(
        "Payout " +
          (payout.external_reference ?? payout.id) +
          " → " +
          status +
          ".",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar payout.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">TREASURY · MANUAL OPERATIONS</span>
          <h1>Payout Tickets</h1>
          <p>
            Fila operacional com saldo previamente reservado na Wallet BRL. A execução externa
            permanece manual nesta fase; cada mudança fica auditada.
          </p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void load()}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top"><span>Total</span><CircleDollarSign size={17} /></div>
          <strong>{rows.length}</strong>
          <p>tickets visíveis</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top"><span>Fila</span><RotateCcw size={17} /></div>
          <strong>{rows.filter((row) => ["DRAFT","PROCESSING","PAID"].includes(row.status)).length}</strong>
          <p>aguardando conclusão</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top"><span>Confirmados</span><CheckCircle2 size={17} /></div>
          <strong>{rows.filter((row) => row.status === "CONFIRMED").length}</strong>
          <p>saldo reservado baixado</p>
          <div className="metric-line" />
        </article>
      </section>

      {message ? <div className="success-banner"><CheckCircle2 size={17} />{message}</div> : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Manual payout queue</strong>
            <span>{loading ? "A carregar…" : String(rows.length) + " tickets"}</span>
          </div>
          <CircleDollarSign size={17} />
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Referência</th>
                <th>Conta</th>
                <th>Destino</th>
                <th>Valor</th>
                <th>Criado</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.external_reference ?? row.id.slice(0, 8)}</strong></td>
                  <td>{row.account_type}</td>
                  <td>{row.destination_type ?? "—"}</td>
                  <td><strong>{money(row.amount)}</strong></td>
                  <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                  <td>
                    <span className={row.status === "CONFIRMED" ? "status-chip good" : "status-chip gold"}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {row.status === "DRAFT" ? (
                        <>
                          <button className="primary-button compact-action" disabled={busy.startsWith(row.id)} onClick={() => void transition(row, "PROCESSING")}>
                            Processar
                          </button>
                          <button className="danger-button compact-action" disabled={busy.startsWith(row.id)} onClick={() => void transition(row, "REJECTED")}>
                            Rejeitar
                          </button>
                        </>
                      ) : null}
                      {row.status === "PROCESSING" ? (
                        <>
                          <button className="primary-button compact-action" disabled={busy.startsWith(row.id)} onClick={() => void transition(row, "PAID")}>
                            Marcar pago
                          </button>
                          <button className="danger-button compact-action" disabled={busy.startsWith(row.id)} onClick={() => void transition(row, "FAILED")}>
                            Falhou
                          </button>
                        </>
                      ) : null}
                      {row.status === "PAID" ? (
                        <button className="primary-button compact-action" disabled={busy.startsWith(row.id)} onClick={() => void transition(row, "CONFIRMED")}>
                          Confirmar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">Nenhum payout em fila.</div>
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
