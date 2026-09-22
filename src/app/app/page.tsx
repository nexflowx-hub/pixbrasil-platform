import type { Metadata } from "next";
import { ClientPortal } from "@/components/client/client-portal";

export const metadata: Metadata = {
  title: "PiXBrasil | Client Portal",
  description: "Portal PiXBrasil para contas Particular e Business.",
  robots: { index: false, follow: false },
};

export default function ClientPortalPage() {
  return <ClientPortal />;
}
