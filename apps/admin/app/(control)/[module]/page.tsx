import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";

const modules: Record<string, { title: string; eyebrow: string; description: string }> = {
  onboarding: {
    title: "Onboarding",
    eyebrow: "ACCOUNT LIFECYCLE",
    description: "Fila de onboarding, verificação e ativação operacional.",
  },
  merchants: {
    title: "Merchants",
    eyebrow: "COMMERCE CONTROL",
    description: "Merchants, estados operacionais, produtos e limites.",
  },
  stores: {
    title: "Stores",
    eyebrow: "COMMERCE CONTROL",
    description: "Stores, moedas, produtos e escopo de routing.",
  },
  "gateway-vault": {
    title: "Gateway Vault",
    eyebrow: "PROVIDER SECURITY",
    description: "Contas de provider, versões de credenciais e rotação via Vault.",
  },
  transactions: {
    title: "Transactions",
    eyebrow: "PAYMENT OPERATIONS",
    description: "Timeline operacional e tentativas de provider.",
  },
  ledger: {
    title: "Ledger & Movements",
    eyebrow: "FINANCIAL CORE",
    description: "Ledger imutável, movimentos e correções compensatórias.",
  },
  settlements: {
    title: "Settlements",
    eyebrow: "TREASURY",
    description: "Liquidação e reconciliação entre providers, Core e merchants.",
  },
  payouts: {
    title: "Payouts",
    eyebrow: "TREASURY",
    description: "Fila de saídas e aprovações de payout.",
  },
  users: {
    title: "Users & RBAC",
    eyebrow: "ACCESS CONTROL",
    description: "Admins, roles, permissions e requisitos MFA.",
  },
  audit: {
    title: "Audit",
    eyebrow: "CONTROL EVIDENCE",
    description: "Eventos administrativos e trilha de auditoria.",
  },
  system: {
    title: "System",
    eyebrow: "PLATFORM CONTROL",
    description: "Feature flags, runtime e configuração operacional segura.",
  },
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const metadata = modules[module];
  if (!metadata) notFound();

  return <ModulePlaceholder {...metadata} />;
}
