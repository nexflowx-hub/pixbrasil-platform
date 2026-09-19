import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";

export const metadata: Metadata = {
  title: "Acesso Antecipado",
  description: "Acesso controlado ao MVP PiXBrasil.",
  robots: { index: false, follow: false },
};

export default function EarlyAccessPage() {
  return (
    <InfoPage
      eyebrow="Acesso antecipado"
      title="O MVP está em acesso controlado."
      description="O Client Portal e o Control Plane já estão operacionais para identidades convidadas. Novas contas ainda não são abertas automaticamente: onboarding, KYC e capacidades financeiras são liberados por etapas."
      bullets={[
        "Acesso Personal e Business por convite",
        "Portal autenticado com estados reais do Core",
        "API PIX empresarial em piloto SHADOW",
        "Operações financeiras liberadas somente após validação do rail",
      ]}
      note="Não envie documentos, chaves ou credenciais por canais não autorizados. O fluxo público de onboarding será aberto quando identidade, risco e consentimentos estiverem integrados de ponta a ponta."
    />
  );
}
