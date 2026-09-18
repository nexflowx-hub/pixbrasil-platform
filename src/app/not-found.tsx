import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-[#02090B] px-5 text-center"><section><p className="text-sm font-semibold uppercase tracking-[0.3em] text-pix">404</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-cream">Página não encontrada.</h1><p className="mx-auto mt-4 max-w-xl text-mist">O endereço pode ter mudado ou ainda não fazer parte da versão pública do PiXBrasil.</p><Link href="/" className="btn-cta mt-7 inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar ao início</Link></section></main>;
}
