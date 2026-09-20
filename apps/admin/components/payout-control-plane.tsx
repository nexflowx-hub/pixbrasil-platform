"use client";

import {
  BanknoteArrowUp,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/api";

interface PayoutRow {
  id: string;
  account_id: string;
  account_type: string;
  asset_code: string;
  symbol: string;
  amount: string;
  destination_type: string | null;
  destination_snapshot: Record<string, unknown>;
  status: string;
  external_reference: string | null;
  proof_metadata: Record<string, unknown>;
  approval_request_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR");
}

function statusClass(status: string) {
  if (["CONFIRMED", "PAID", "APPROVED"].includes(status)) return "status-chip good";
  if (["REJECTED", "CANCELED", "FAILED"].includes(status)) return "status-chip danger";
  return "status-chip gold";
}

export function PayoutControlPlane() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [externalRefs, setExternalRefs] = useState<Record<string, string>>({});

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
    let active = true;

    adminFetch<{ success: true; data: PayoutRow[] }>("/api/v1/admin/payouts")
      .then((response) => {
        if (!active) return;
        setRows(response.data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Falha ao carregar payouts.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const open = rows.filter((row) =>
      ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING", "PAID"].includes(row.status),
    );
    return {
      open: open.length,
      reserved: open
        .filter((row) => row.status !== "PAID")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
      confirmed: rows
        .filter((row) => row.status === "CONFIRMED")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }, [rows]);

  async function transition(row: PayoutRow, status: string) {
    if (
      ["REJECTED", "CANCELED", "FAILED"].includes(status) &&
      !window.confirm(
        "Confirmar " + status + "? O valor reservado será devolvido à Wallet.",
      )
    ) {
      return;
    }

    const externalReference = (externalRefs[row.id] ?? "").trim();
    if (status === "PAID" && !externalReference && !row.external_reference) {
      setError("Informe a referência externa/comprovativo antes de marcar como PAID.");
      return;
    }

    setBusy(row.id + ":" + status);
    setError("");
    setMessage("");

    try {
      await adminFetch("/api/v1/admin/payouts/" + row.id + "/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          externalReference,
          proof: {
            operatorNote: "Manual treasury processing",
            channel: "TELEGRAM_MANUAL",
          },
        }),
      });
      setMessage("Payout " + (row.external_reference ?? row.id) + " atualizado para " + status + ".");
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
          <span className="eyebrow">TREASURY OPERATIONS</span>
          <h1>Payout Tickets</h1>
          <p>
            Fila manual de Tesouraria. O saldo é reservado no pedido e só sai da
            Wallet quando o ticket é marcado como PAID.
          </p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void load()}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top"><span>Tickets abertos</span><BanknoteArrowUp size={17} /></div>
          <strong>{summary.open}</strong>
          <p>fila operacional</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top"><span>Saldo reservado</span><ShieldCheck size={17} /></div>
          <strong>{money(summary.reserved)}</strong>
          <p>aguardando processamento</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top"><span>Confirmado</span><CircleDollarSign size={17} /></div>
          <strong>{money(summary.confirmed)}</strong>
          <p>histórico carregado</p>
          <div className="metric-line" />
        </article>
      </section>

      {message ? (
        <div className="success-banner"><CheckCircle2 size={17} />{message}</div>
      ) : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Manual treasury queue</strong>
            <span>{rows.length} ticket(s)</span>
          </div>
          <BanknoteArrowUp size={17} />
        </div>

        {loading ? (
          <div className="empty-state"><LoaderCircle className="spin" size={16} /> A carregar tickets…</div>
        ) : rows.length ? (
          <div className="payout-ticket-list">
            {rows.map((row) => {
              const destination = row.destination_snapshot ?? {};
              const currentBusy = busy.startsWith(row.id + ":");
              return (
                <article className="payout-ticket-card" key={row.id}>
                  <div className="payout-ticket-main">
                    <div>
                      <span className="eyebrow">{row.asset_code} · {row.destination_type ?? "MANUAL"}</span>
                      <strong>{row.external_reference ?? row.id}</strong>
                      <small>{dateTime(row.created_at)} · Account {row.account_id}</small>
                    </div>
                    <div className="payout-ticket-amount">
                      <strong>{money(row.amount)}</strong>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </div>
                  </div>

                  <div className="payout-ticket-destination">
                    <span>Destino</span>
                    <code>{JSON.stringify(destination)}</code>
                  </div>

                  {["APPROVED", "PROCESSING"].includes(row.status) ? (
                    <label className="payout-proof-field">
                      <span>Referência externa / comprovativo</span>
                      <input
                        value={externalRefs[row.id] ?? row.external_reference ?? ""}
                        onChange={(event) =>
                          setExternalRefs((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                        placeholder="ID da transferência, E2E ou referência operacional"
                      />
                    </label>
                  ) : null}

                  <div className="payout-ticket-actions">
                    {row.status === "APPROVAL_REQUIRED" ? (
                      <>
                        <button disabled={currentBusy} className="primary-button compact-action" onClick={() => void transition(row, "APPROVED")}>
                          Aprovar
                        </button>
                        <button disabled={currentBusy} className="danger-button compact-action" onClick={() => void transition(row, "REJECTED")}>
                          <XCircle size={13} /> Rejeitar
                        </button>
                      </>
                    ) : null}

                    {row.status === "APPROVED" ? (
                      <>
                        <button disabled={currentBusy} className="secondary-button compact-action" onClick={() => void transition(row, "PROCESSING")}>
                          Em processamento
                        </button>
                        <button disabled={currentBusy} className="primary-button compact-action" onClick={() => void transition(row, "PAID")}>
                          Marcar PAID
                        </button>
                        <button disabled={currentBusy} className="danger-button compact-action" onClick={() => void transition(row, "CANCELED")}>
                          Cancelar
                        </button>
                      </>
                    ) : null}

                    {row.status === "PROCESSING" ? (
                      <>
                        <button disabled={currentBusy} className="primary-button compact-action" onClick={() => void transition(row, "PAID")}>
                          Marcar PAID
                        </button>
                        <button disabled={currentBusy} className="danger-button compact-action" onClick={() => void transition(row, "FAILED")}>
                          Falhou
                        </button>
                      </>
                    ) : null}

                    {row.status === "PAID" ? (
                      <button disabled={currentBusy} className="primary-button compact-action" onClick={() => void transition(row, "CONFIRMED")}>
                        Confirmar payout
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">Nenhum payout solicitado.</div>
        )}
      </section>
    </div>
  );
}
