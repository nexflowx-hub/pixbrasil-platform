import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Para Empresas", description: "Visão do PiXBrasil Business para merchants e empresas brasileiras." };
export default function BusinessPage() {
  return <InfoPage eyebrow="PiXBrasil Business" title="Pagamentos, lojas e liquidação digital para empresas." description="O PiXBrasil Business será a camada empresarial do produto, com conta business, stores, API, links de pagamento, webhooks, analytics e settlement digital." bullets={["Conta empresarial e contexto multi-store","API PIX e chaves de integração","Links de pagamento e checkout","Webhooks assinados e idempotentes","Analytics e conciliação","Liquidação em ativos digitais e rotas de saída"]} note="Integrações de pagamento e settlement permanecerão desativadas até existirem backend, providers e controles operacionais validados." primaryCta={{ label: "Manifestar interesse", href: "/early-access" }} />;
}
