import Link from "next/link";
import { WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02090B] px-5 text-center">
      <section className="glass-panel w-full max-w-lg rounded-3xl p-8">
        <BrandLogo tagline className="justify-center text-[22px]" />
        <WifiOff className="mx-auto mt-8 h-8 w-8 text-pix" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-cream">Sem conexão.</h1>
        <p className="mt-3 text-sm leading-6 text-mist">
          O aplicativo não armazena dados financeiros offline. Reconecte-se para acessar páginas e informações atualizadas.
        </p>
        <Link href="/" className="btn-outline-green mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
          Tentar novamente
        </Link>
      </section>
    </main>
  );
}
