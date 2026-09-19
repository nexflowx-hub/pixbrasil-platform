import type { Metadata } from "next";
import { ClientPortal } from "@/components/client/client-portal";

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Contas Personal e Business no PiXBrasil.",
  robots: { index: false, follow: false },
};

export default function ClientPortalPage() {
  return <ClientPortal />;
}
