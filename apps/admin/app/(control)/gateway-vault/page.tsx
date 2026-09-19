import { ProviderControlPlane } from "@/components/provider-control-plane";

export const metadata = { title: "Gateway Vault" };

export default function GatewayVaultPage() {
  return <ProviderControlPlane mode="vault" />;
}
