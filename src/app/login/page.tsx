import type { Metadata } from "next";
import { ClientLogin } from "@/components/client/client-login";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso seguro ao Client Portal PiXBrasil.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <ClientLogin />;
}
