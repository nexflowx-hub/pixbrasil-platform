"use client";

import {
  BanknoteArrowDown,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/api";

type PayoutRow = {
  id: string;
  account_id: string;
  account_type: string;
  asset_code: string;
  symbol: string;
  amount: string;
  destination_type: string | null;
  destination_snapshot: Record<string, unknown> | null;
  status: string;
  external_reference: string | null;
  approval_request_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
};

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("pt-BR");
}

function tone(status: string) {
  if (["PAID", "CONFIRMED"].includes(status)) return "status-chip good";
  return "status-chip gold";
}

export function PayoutControlPlane() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState<Record<string, string>>({});

  async function load() {
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
  }

  useEffect(() => {
    let active = true;
    adminFetch<{ success: true; data: PayoutRow[] }>("/api/v1/admin/payouts")
      .then((response) => {
        if (active) setRows(response.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar payouts.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function transition(
    event: FormEvent,
    row: PayoutRow,
    status: string,
  ) {
    event.preventDefault();
    const externalReference = reference[row.id]?.trim() ?? "";
    if (status === "PAID" && !externalReference) {
      setError("Informe a referência/comprovativo da saída antes de marcar PAID.");
      return;
    }

    setBusy(row.id + ":" + status);
    setError("");
    setMessage("");

    try {
      await adminFetch(
        "/api/v1/admin/payouts/" + row.id + "/status",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            externalReference: externalReference || undefined,
            proofMetadata: {
              source: "ADMIN_CONTROL_PLANE",
            },
          }),
        },
      );
      setMessage("Payout " + row.id + " atualizado para " + status + ".");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar payout.");
    } finally {
      setBusy("");
    }
  }

  const pending = rows.filter((row) =>
    ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING"].includes(row.status),
  );
  const volume = pending.reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">TREASURY OPERATIONS</span>
          <h1>Payouts</h1>
          <p>
            Tickets operacionais, reserva de Wallet BRL e confirmação manual de saída PIX.
          </p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void load()}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Atualizar
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card tone-aqua">
          <div className="metric-top"><span>Fila aberta</span><BanknoteArrowDown size={17} /></div>
          <strong>{pending.length}</strong>
          <p>tickets aguardando operação</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-gold">
          <div className="metric-top"><span>Reservado</span><CircleDollarSign size={17} /></div>
          <strong>{money(volume)}</strong>
          <p>saldo comprometido com tickets</p>
          <div className="metric-line" />
        </article>
        <article className="metric-card tone-green">
          <div className="metric-top"><span>Modelo atual</span><ShieldCheck size={17} /></div>
          <strong>MANUAL</strong>
          <p>Telegram + confirmação no Control Plane</p>
          <div className="metric-line" />
        </article>
      </section>

      {message ? <div className="success-banner"><CheckCircle2 size={17} />{message}</div> : null}
      {error ? <div className="warning-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Fila de payouts</strong>
            <span>{rows.length} tickets</span>
          </div>
          <Send size={17} />
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Criado</th>
                <th>Valor</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Referência</th>
                <th>Operação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => {
                const destination = row.destination_snapshot ?? {};
                const masked = String(destination.pixKeyMasked ?? "—");
                const type = String(destination.pixKeyType ?? row.destination_type ?? "PIX");
                const mutable = ["APPROVAL_REQUIRED", "APPROVED", "PROCESSING"].includes(row.status);
                return (
                  <tr key={row.id}>
                    <td>{date(row.created_at)}</td>
                    <td><strong>{money(row.amount)}</strong></td>
                    <td>{type} · {masked}</td>
                    <td><span className={tone(row.status)}>{row.status}</span></td>
                    <td>
                      {mutable ? (
                        <input
                          value={reference[row.id] ?? row.external_reference ?? ""}
                          onChange={(event) =>
                            setReference((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          placeholder="E2E / referência da saída"
                          style={{ minWidth: 180 }}
                        />
                      ) : row.external_reference ?? "—"}
                    </td>
                    <td>
                      {mutable ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {row.status !== "PROCESSING" ? (
                            <button
                              className="secondary-button compact-action"
                              disabled={busy !== ""}
                              onClick={(event) => void transition(event, row, "PROCESSING")}
                            >
                              Processar
                            </button>
                          ) : null}
                          <button
                            className="primary-button compact-action"
                            disabled={busy !== ""}
                            onClick={(event) => void transition(event, row, "PAID")}
                          >
                            Marcar pago
                          </button>
                          <button
                            className="danger-button compact-action"
                            disabled={busy !== ""}
                            onClick={(event) => void transition(event, row, "CANCELED")}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : row.status === "PAID" ? (
                        <button
                          className="primary-button compact-action"
                          disabled={busy !== ""}
                          onClick={(event) => void transition(event, row, "CONFIRMED")}
                        >
                          Confirmar
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="empty-state">Nenhum payout solicitado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
