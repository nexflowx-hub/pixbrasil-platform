import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Tarifas", description: "Política de transparência comercial do PiXBrasil." };
export default function PricingPage() {
  return <InfoPage eyebrow="Tarifas" title="Precificação transparente antes de qualquer operação." description="A estrutura comercial final ainda está em definição. Antes do lançamento, cada modalidade terá tarifas, prazos, limites, conversão e custos de rede apresentados de forma clara antes da confirmação." bullets={["Sem tarifas ocultas","Cotação e custos apresentados antes da operação","Custos de blockchain separados quando aplicáveis","Condições empresariais podem variar por volume e risco"]} note="Nenhuma tarifa pública nesta página deve ser interpretada como oferta contratual até a publicação dos termos comerciais definitivos." />;
}
