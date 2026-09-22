import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Como Funciona", description: "Visão conceitual dos fluxos PiXBrasil." };
export default function HowItWorksPage() {
  return <InfoPage eyebrow="Como funciona" title="Do rail de entrada ao settlement digital." description="O desenho do produto separa claramente a confirmação da entrada, a conversão, o ledger e o backing on-chain. O usuário acompanha o estado de cada etapa sem confundir uma estimativa em BRL com o ativo efetivamente mantido." bullets={["Entrada PIX confirmada","Reconciliação e controles de risco","Conversão quando aplicável","Crédito por ledger de dupla entrada","Backing e settlement em redes suportadas","Withdrawal em BRL ou ativo digital quando disponível"]} note="O fluxo é uma visão de arquitetura do produto em desenvolvimento e pode variar conforme ativo, rede, regras de risco e disponibilidade operacional." />;
}
