import type { Metadata } from "next";
import { AudienceProductPage } from "@/components/marketing/audience-product-page";

export const metadata: Metadata = {
  title: "Para Empresas",
  description: "Estado real das capacidades PiXBrasil no MVP controlado.",
};

export default function Page() {
  return <AudienceProductPage audience="business" />;
}
