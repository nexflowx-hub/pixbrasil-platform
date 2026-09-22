import type { Metadata } from "next";
import { TerminalClient } from "@/components/terminal/terminal-client";

export const metadata: Metadata = {
  title: "Terminal PIX",
  description: "Ponto de venda móvel PiXBrasil para cobranças PIX presenciais.",
  manifest: "/terminal.webmanifest",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TerminalPage() {
  return <TerminalClient />;
}
