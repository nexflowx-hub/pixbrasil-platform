"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BusinessDashboard } from "@/components/client/business/business-dashboard";
import { PersonalDashboard } from "@/components/client/personal/personal-dashboard";
import type {
  OverviewData,
  OverviewPayload,
  SessionData,
  SessionPayload
} from "@/components/client/client-types";

export function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [accountId, setAccountId] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [payoutOpen, setPayoutOpen] = useState(false);

  const loadOverview = useCallback(
    async (id: string) => {
      if (!id) return;
      setBusy(true);
      setError("");

      try {
        const response = await fetch(
          "/api/client/accounts/" + encodeURIComponent(id) + "/overview",
          { cache: "no-store" }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as OverviewPayload;
        if (!response.ok) {
          throw new Error("Não foi possível carregar a conta.");
        }

        setOverview(payload.data);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Falha ao carregar conta."
        );
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => {
    let active = true;

    fetch("/api/client/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }

        const payload = (await response.json()) as SessionPayload;
        if (!response.ok) {
          throw new Error("Não foi possível carregar a sessão.");
        }

        return payload.data;
      })
      .then((data) => {
        if (!active || !data) return;
        setSession(data);
        setAccountId(data.accounts[0]?.accountId || "");

        if (!data.accounts.length) {
          setBusy(false);
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Falha de sessão."
        );
        setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!accountId) return;
    void loadOverview(accountId);
  }, [accountId, loadOverview]);

  const activeAccess = useMemo(
    () => session?.accounts.find((account) => account.accountId === accountId),
    [session, accountId]
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sharedProps = {
    session,
    activeAccess,
    overview,
    busy,
    error,
    accountId,
    setAccountId,
    refresh: () => loadOverview(accountId),
    signOut
  };

  if (activeAccess?.accountType === "BUSINESS") {
    return (
      <BusinessDashboard
        {...sharedProps}
        activeAccess={activeAccess}
        payoutOpen={payoutOpen}
        setPayoutOpen={setPayoutOpen}
      />
    );
  }

  return <PersonalDashboard {...sharedProps} />;
}
