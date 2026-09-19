import { ProviderControlPlane } from "@/components/provider-control-plane";

export const metadata = { title: "Provider Library" };

export default function ProvidersPage() {
  return <ProviderControlPlane mode="library" />;
}
