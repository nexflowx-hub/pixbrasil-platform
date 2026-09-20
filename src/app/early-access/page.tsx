import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Começar",
  description: "Onboarding e acesso ao PiXBrasil.",
};

export default function EarlyAccessPage() {
  return (
    <InfoPage
      eyebrow="Onboarding"
      title="Conecte sua operação ao PiXBrasil."
      description="Contas Personal e Business usam o mesmo Financial Core, com permissões, KYC e políticas aplicadas por perfil. Empresas podem integrar PIX por API, organizar Stores, configurar webhooks e acompanhar routing, liberações e payouts no Client Portal."
      bullets={[
        "Client Portal Personal e Business",
        "API PIX S2S por Store",
        "Webhooks assinados e idempotência",
        "Routing multi-provider e release D0/D1",
        "Payout Business por ticket operacional nesta fase",
      ]}
      note="O acesso a funcionalidades financeiras depende do estado da conta, KYC, permissões e políticas comerciais aplicáveis."
    />
  );
}
