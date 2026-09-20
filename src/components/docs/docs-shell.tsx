import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpen,
  Bot,
  Braces,
  Cable,
  ChevronRight,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

const NAV = [
  { href: "/docs", label: "Começar", icon: BookOpen },
  { href: "/docs/api", label: "API Reference", icon: Braces },
  { href: "/docs/webhooks", label: "Webhooks", icon: RadioTower },
  { href: "/docs/ai-setup", label: "AI Setup Kits", icon: Bot },
  { href: "/docs/tracking", label: "Tracking & UTM", icon: Cable },
] as const;

export function DocsShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-[#020B0D] text-[#F4F1E8]">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#020B0D]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 sm:px-8 xl:px-12">
          <Link href="/" aria-label="PiXBrasil home">
            <BrandLogo className="text-[18px]" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#20F29A]/16 bg-[#20F29A]/5 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#71D2B3] sm:inline-flex">
              Docs v1 · Produção
            </span>
            <Link
              href="/login"
              className="rounded-full border border-white/12 px-4 py-2 text-[10px] font-semibold text-[#AABDB8] transition hover:border-[#20F29A]/30 hover:text-white"
            >
              Client Portal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-white/7 px-4 py-4 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-[10px] font-semibold text-[#819A94] transition hover:border-white/8 hover:bg-white/[.025] hover:text-white"
              >
                <item.icon className="h-3.5 w-3.5 text-[#4EBE99]" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 hidden rounded-2xl border border-[#20F29A]/12 bg-[#20F29A]/4 p-4 lg:block">
            <div className="flex items-center gap-2 text-[#67D1AF]">
              <ShieldCheck className="h-4 w-4" />
              <strong className="text-[9px] uppercase tracking-[.12em]">
                Regra de segurança
              </strong>
            </div>
            <p className="mt-2 text-[8px] leading-4 text-[#6D8880]">
              Nunca exponha uma API Key PiXBrasil no browser, aplicativo móvel ou
              prompt público de IA. Use somente variáveis server-side.
            </p>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-10 border-b border-white/7 pb-9">
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.15em] text-[#64C9A8]">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-.05em] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-5 max-w-3xl text-[13px] leading-6 text-[#879E98]">
                {description}
              </p>
            </div>

            {children}

            <div className="mt-14 flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[.018] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="text-[11px]">Precisa integrar agora?</strong>
                <p className="mt-1 text-[9px] text-[#6F8982]">
                  Use o AI Setup Kit e entregue o prompt à IA que já trabalha no seu repositório.
                </p>
              </div>
              <Link
                href="/docs/ai-setup"
                className="inline-flex items-center gap-2 text-[10px] font-bold text-[#20F29A]"
              >
                Abrir AI Setup Kits <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function DocsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-white/7 py-9 first:pt-0 last:border-0">
      <h2 className="text-xl font-semibold tracking-[-.035em]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#728A84]">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function DocsGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

export function DocsCard({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "green" | "gold";
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        tone === "green"
          ? "border-[#20F29A]/16 bg-[#20F29A]/4"
          : tone === "gold"
            ? "border-[#D2A34E]/16 bg-[#D2A34E]/4"
            : "border-white/8 bg-[#061214]",
      ].join(" ")}
    >
      <strong className="text-[11px]">{title}</strong>
      <div className="mt-2 text-[9px] leading-5 text-[#79908A]">{children}</div>
    </div>
  );
}
