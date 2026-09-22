import type { Metadata } from "next";
import { ClientPortal } from "@/components/client/client-portal";

export const metadata: Metadata = {
  title: "Integrações | PiXBrasil Business",
  description: "API Keys e Webhooks da conta PiXBrasil Business.",
  robots: { index: false, follow: false },
};

export default function IntegrationsPage() {
  return <ClientPortal view="integrations" />;
}
