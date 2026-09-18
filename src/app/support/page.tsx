import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Central de Ajuda", description: "Estado de suporte e lançamento do PiXBrasil." };
export default function SupportPage() {
  return <InfoPage eyebrow="Central de Ajuda" title="Produto em preparação para lançamento." description="Nesta fase a landing pública está sendo validada enquanto backend, banco de dados, integrações e processos operacionais são construídos. Não há operações financeiras públicas ativas por este site." bullets={["Nenhum depósito deve ser enviado com base apenas nesta landing","Nenhuma chave PIX operacional é publicada aqui","Nenhuma wallet de depósito é disponibilizada nesta fase","Canais oficiais serão publicados antes da abertura do onboarding"]} />;
}
