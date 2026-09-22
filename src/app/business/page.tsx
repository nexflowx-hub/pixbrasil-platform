import type { Metadata } from "next";
import { AudienceProductPage } from "@/components/marketing/audience-product-page";

export const metadata: Metadata = {
  title: "Para Empresas",
  description: "PiXBrasil Business para operações PIX, Stores, Wallet BRL, liberações e payouts.",
};

export default function Page() {
  return <AudienceProductPage audience="business" />;
}
