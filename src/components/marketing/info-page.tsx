import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck } from "lucide-react";
import { AmbientBackground } from "@/components/visuals/ambient-background";
import { SiteHeader } from "@/components/marketing/header";
import { SiteFooter } from "@/components/marketing/footer";

type InfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: readonly string[];
  note?: string;
  primaryCta?: { label: string; href: string };
};

export function InfoPage({ eyebrow, title, description, bullets = [], note, primaryCta }: InfoPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#02090B]">
      <AmbientBackground />
      <SiteHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-5 pb-20 pt-28 sm:px-8">
        <section className="glass-panel w-full rounded-3xl p-6 sm:p-10 lg:p-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-pix">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-0.04em] text-cream sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-mist">{description}</p>
          {bullets.length > 0 ? (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {bullets.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-mist">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-pix" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {note ? <div className="mt-8 rounded-2xl border border-pix/20 bg-pix/[0.05] p-4 text-sm leading-6 text-mist">{note}</div> : null}
          <div className="mt-9 flex flex-wrap gap-3">
            {primaryCta ? (
              <Link href={primaryCta.href} className="btn-cta inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold">
                {primaryCta.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
            <Link href="/" className="btn-outline-green inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à página inicial
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
