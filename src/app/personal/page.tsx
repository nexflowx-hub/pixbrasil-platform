import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Para Você", description: "Visão do PiXBrasil Personal para contas individuais no Brasil." };
export default function PersonalPage() {
  return <InfoPage eyebrow="PiXBrasil Personal" title="Uma experiência digital para o seu dinheiro." description="O PiXBrasil Personal está sendo preparado para reunir entrada via PIX, depósitos em ativos digitais, gestão de wallets e saídas em BRL ou cripto numa única experiência." bullets={["Entrada via PIX quando o rail estiver operacional","Depósitos de ativos digitais suportados","Wallets segregadas por ativo e rede","Liquidação e manutenção em infraestrutura blockchain","Saída em BRL ou ativos digitais, conforme disponibilidade","Histórico e transparência operacional"]} note="Esta página descreve o produto planejado. Funcionalidades financeiras ainda não estão abertas ao público e serão ativadas apenas após a infraestrutura técnica, contratual e regulatória aplicável estar concluída." primaryCta={{ label: "Acesso antecipado", href: "/early-access" }} />;
}
