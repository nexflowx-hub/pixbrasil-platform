import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Acesso Antecipado",
  description: "Solicite acesso comercial ao PiXBrasil.",
  robots: { index: false, follow: false },
};

export default function EarlyAccessPage() {
  return (
    <InfoPage
      eyebrow="Acesso antecipado"
      title="Abertura de conta e onboarding comercial."
      description="O PiXBrasil está em produção. Novas contas Business passam por onboarding comercial, configuração de Stores, definição de routing e ativação das credenciais de integração."
      bullets={[
        "Acesso Personal e Business com identidade verificada",
        "Portal autenticado com Wallet, Stores e atividade financeira",
        "API PIX empresarial em produção por Store",
        "Payouts processados por ticket de Tesouraria nesta fase",
      ]}
      note="Nunca envie API Keys, webhook secrets ou credenciais de provider por canais não autorizados. O onboarding comercial define as Stores, permissões e integrações necessárias para cada conta."
    />
  );
}
