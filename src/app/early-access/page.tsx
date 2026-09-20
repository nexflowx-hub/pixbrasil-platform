import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Acesso PiXBrasil",
  description: "Onboarding e acesso à plataforma PiXBrasil.",
};

export default function AccessPage() {
  return (
    <InfoPage
      eyebrow="Acesso PiXBrasil"
      title="Entre na operação PiXBrasil."
      description="O Client Portal, a API PIX, o Business Dashboard e o Control Plane estão em produção. Novas contas passam por onboarding, configuração das Stores e habilitação dos produtos adequados ao perfil operacional."
      bullets={[
        "Contas Personal e Business",
        "Wallet BRL e visão financeira por Store",
        "API PIX S2S com webhooks assinados",
        "Routing multi-provider e classes de liberação",
        "Payouts por ticket manual durante a fase atual de automação",
      ]}
      note="Nunca envie API Keys, credenciais de provider ou chaves secretas por chat ou canais não autorizados. Credenciais devem permanecer no ambiente server-side ou Vault."
    />
  );
}
