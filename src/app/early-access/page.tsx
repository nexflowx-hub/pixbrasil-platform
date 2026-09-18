import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Acesso Antecipado", description: "Estado do onboarding PiXBrasil.", robots: { index: false, follow: false } };
export default function EarlyAccessPage() {
  return <InfoPage eyebrow="Acesso antecipado" title="O onboarding ainda não está aberto." description="Estamos finalizando a infraestrutura do produto. Esta página substitui formulários fictícios: nenhuma conta é criada e nenhum dado financeiro é solicitado enquanto o backend de onboarding não estiver operacional." note="Quando o onboarding for ativado, esta rota será conectada ao fluxo real de identidade, conta Personal ou Business e políticas de acesso." />;
}
