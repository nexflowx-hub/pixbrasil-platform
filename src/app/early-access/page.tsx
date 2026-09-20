import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Abrir conta",
  description: "Onboarding PiXBrasil para contas Personal e Business.",
};

export default function EarlyAccessPage() {
  return (
    <InfoPage
      eyebrow="Onboarding"
      title="Comece a operar com o PiXBrasil."
      description="Abertura de conta, configuração de Merchant, Stores, API Keys e webhooks são organizadas por perfil para que cada integração entre em produção com routing e liberação definidos."
      bullets={[
        "Conta Personal ou Business",
        "Stores e routing por operação",
        "API PIX S2S e webhooks assinados",
        "Wallet BRL, liberações e payouts",
      ]}
      note="Nunca envie senhas, API Keys ou documentos por canais não autorizados. Credenciais de integração ficam disponíveis apenas nas superfícies seguras da plataforma."
    />
  );
}
