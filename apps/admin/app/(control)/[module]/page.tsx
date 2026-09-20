import { notFound } from "next/navigation";
import { OperationalPage } from "@/components/operational-page";
import { PayoutControlPlane } from "@/components/payout-control-plane";
import { ModulePlaceholder } from "@/components/module-placeholder";

const operational = new Set([
  "onboarding",
  "stores",
  "transactions",
  "ledger",
  "settlements",
  "payouts",
  "users",
  "audit",
  "system",
  "risk",
]);

const foundations: Record<string, { title: string; eyebrow: string; description: string }> = {
  "gateway-vault": {
    title: "Gateway Vault",
    eyebrow: "PROVIDER SECURITY",
    description: "Contas de provider, versões de credenciais e rotação via Vault.",
  },
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;

  if (module === "payouts") {
    return <PayoutControlPlane />;
  }

  if (operational.has(module)) {
    return <OperationalPage kind={module as
      | "onboarding"
      | "stores"
      | "transactions"
      | "ledger"
      | "settlements"
      | "payouts"
      | "users"
      | "audit"
      | "system"
      | "risk"} />;
  }

  const metadata = foundations[module];
  if (!metadata) notFound();

  return <ModulePlaceholder {...metadata} />;
}
