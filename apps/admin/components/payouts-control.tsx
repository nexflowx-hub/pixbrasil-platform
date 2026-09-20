"use client";

import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

type PayoutRow = {
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
};

function brl(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function PayoutsControl() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  async function reject(row: PayoutRow) {
    const reason = window.prompt("Motivo da rejeição (opcional):", "") ?? "";
    if (!window.confirm("Rejeitar este payout e devolver o saldo reservado?")) return;

    setBusy(row.id);
    setError("");
    try {
      await adminFetch("/api/v1/admin/payouts/" + row.id + "/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setMessage("Payout rejeitado e reserva devolvida à Wallet.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao rejeitar payout.");
    } finally {
      setBusy("");
    }
  }

  async function markPaid(row: PayoutRow) {
    const proofReference = window.prompt(
      "Referência do comprovativo / E2E / hash da operação:",
      "",
    );
    if (!proofReference?.trim()) return;

    setBusy(row.id);
    setError("");
    try {
      await adminFetch("/api/v1/admin/payouts/" + row.id + "/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofReference: proofReference.trim() }),
      });
      setMessage("Payout marcado como pago e lançado no ledger.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao marcar payout.");
    } finally {
      setBusy("");
    }
  }

  async function confirm(row: PayoutRow) {
    if (!window.confirm("Confirmar definitivamente este payout?")) return;
    setBusy(row.id);
    setError("");
    try {
      await adminFetch("/api/v1/admin/payouts/" + row.id + "/confirm", {
        method: "POST",
      });
      setMessage("Payout confirmado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao confirmar payout.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">TREASURY OPERATIONS</span>
          <h1>Payouts</h1>
          <p>
            Tickets manuais, saldo reservado, comprovativos e confirmação operacional.
          </p>
        </div>
        <button className="secondary-button" onClick={() => {
          setLoading(true);
          void load();
        }} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top"><span>Tickets</span><Send size={17} /></div>
          <strong>{rows.length}</strong>
          <p>total visível</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top"><span>Pendentes</span><CircleDollarSign size={17} /></div>
          <strong>{rows.filter((row) => ["DRAFT","APPROVAL_REQUIRED","APPROVED","PROCESSING"].includes(row.status)).length}</strong>
          <p>requerem operação manual</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top"><span>Concluídos</span><CheckCircle2 size={17} /></div>
          <strong>{rows.filter((row) => ["PAID","CONFIRMED"].includes(row.status)).length}</strong>
          <p>pagos / confirmados</p>
          <div className="metric-line" />
        </article>
      </section>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Fila operacional</strong>
            <span>Payout automático permanece desligado; este fluxo é manual.</span>
          </div>
          <CircleDollarSign size={17} />
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Criado</th>
                <th>Ticket</th>
                <th>Conta</th>
                <th>Valor</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                  <td><code>{row.id.slice(0, 8)}…</code></td>
                  <td><code>{row.account_id.slice(0, 8)}…</code></td>
                  <td><strong>{brl(row.amount)}</strong></td>
                  <td>{row.destination_type || "—"}</td>
                  <td><span className={["PAID","CONFIRMED"].includes(row.status) ? "status-chip good" : "status-chip gold"}>{row.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["DRAFT","APPROVAL_REQUIRED","APPROVED","PROCESSING"].includes(row.status) ? (
                        <>
                          <button className="primary-button compact-action" disabled={busy===row.id} onClick={() => void markPaid(row)}>
                            <Send size={13} /> Marcar pago
                          </button>
                          <button className="danger-button compact-action" disabled={busy===row.id} onClick={() => void reject(row)}>
                            <Ban size={13} /> Rejeitar
                          </button>
                        </>
                      ) : null}
                      {row.status === "PAID" ? (
                        <button className="primary-button compact-action" disabled={busy===row.id} onClick={() => void confirm(row)}>
                          <CheckCircle2 size={13} /> Confirmar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7}><div className="empty-state">Nenhum ticket de payout.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
