import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/info-page";
export const metadata: Metadata = { title: "Entrar", description: "Estado do acesso autenticado PiXBrasil.", robots: { index: false, follow: false } };
export default function LoginPage() {
  return <InfoPage eyebrow="Área autenticada" title="Login ainda não disponível." description="A autenticação será ativada junto com o backend e o Financial Core. Não apresentamos campos de login sem uma sessão real e segura por trás." note="Nenhuma credencial deve ser enviada por mensagens, formulários externos ou páginas que não estejam vinculadas ao domínio oficial." />;
}
