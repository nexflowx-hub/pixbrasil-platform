import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Abrir conta",
  description: "Onboarding PiXBrasil Personal e Business.",
};

export default function OnboardingPage() {
  return (
    <InfoPage
      eyebrow="Onboarding"
      title="Conecte sua operação ao PiXBrasil."
      description="Contas Business podem operar PIX por Store, routing multi-provider, settlement, Wallet BRL e webhooks. O onboarding define identidade, permissões, Stores e perfil comercial antes da emissão das credenciais de produção."
      bullets={[
        "Conta Personal e Business com acesso autenticado",
        "Stores e routing configurados por operação",
        "API PIX S2S e webhooks assinados",
        "Wallet BRL com liberações D0/D1",
        "Payouts por ticket operacional nesta fase",
      ]}
      note="Credenciais de API, signing secrets e dados financeiros devem ser configurados apenas nos canais seguros disponibilizados pelo PiXBrasil."
    />
  );
}
