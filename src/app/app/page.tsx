import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Building2,
  CircleDollarSign,
  Home,
  QrCode,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "App Demo",
  description: "Demonstração instalável da experiência PiXBrasil.",
  robots: { index: false, follow: false },
};

const assets = [
  { label: "USDT · Liquid", amount: "3.420,00", brl: "R$ 12.430,50" },
  { label: "USDT · TRON", amount: "2.280,00", brl: "R$ 8.225,90" },
  { label: "L-BTC · Liquid", amount: "0,048", brl: "R$ 4.235,90" },
];

export default function AppDemoPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#02090B] text-cream">
      <header className="sticky top-0 z-30 border-b border-pix/15 bg-[#02090B]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLogo tagline className="text-[19px]" />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-bright">
              Modo demonstração
            </span>
            <button type="button" aria-label="Notificações de demonstração" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-mist">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-7">
        <aside className="hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 lg:block">
          <nav className="space-y-1 text-[13px]">
            {[
              [Home, "Início"],
              [QrCode, "PIX"],
              [WalletCards, "Ativos"],
              [ArrowLeftRight, "Converter"],
              [UserRound, "Conta pessoal"],
              [Building2, "Empresas"],
            ].map(([Icon, label], index) => {
              const ItemIcon = Icon as typeof Home;
              return (
                <div key={String(label)} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${index === 0 ? "border border-pix/20 bg-pix/10 text-cream" : "text-dim"}`}>
                  <ItemIcon className="h-4 w-4 shrink-0 text-pix" />
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="rounded-3xl border border-pix/20 bg-[linear-gradient(145deg,rgba(8,38,38,.82),rgba(3,18,21,.75))] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pix">Saldo demonstrativo</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">R$ 24.892,30</h1>
                <p className="mt-1.5 text-[12px] text-dim">Valuation em BRL · ativos digitais simulados</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  [QrCode, "Receber PIX"],
                  [ArrowUpRight, "Enviar"],
                  [ArrowLeftRight, "Converter"],
                ].map(([Icon, label]) => {
                  const ActionIcon = Icon as typeof QrCode;
                  return (
                    <button key={String(label)} type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-full border border-pix/20 bg-pix/[0.06] px-4 text-[11.5px] font-semibold text-mist opacity-80">
                      <ActionIcon className="h-3.5 w-3.5 text-pix" />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.label} data-layout-guard="pwa-asset-card" className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <p data-text-safe className="text-[11px] font-semibold text-mist">{asset.label}</p>
                <p data-text-safe className="mt-3 text-lg font-bold text-cream">{asset.brl}</p>
                <p data-text-safe className="mt-1 text-[11px] text-dim">{asset.amount}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article data-layout-guard="pwa-status-card" className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <CircleDollarSign className="h-5 w-5 text-pix" />
              <p data-text-safe className="mt-3 text-[12px] font-semibold">Recebimentos PIX</p>
              <p data-text-safe className="mt-1 text-[11px] leading-relaxed text-dim">Simulação visual. Nenhuma cobrança é criada nesta versão.</p>
            </article>
            <article data-layout-guard="pwa-status-card" className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <ArrowDownToLine className="h-5 w-5 text-aqua" />
              <p data-text-safe className="mt-3 text-[12px] font-semibold">Saídas</p>
              <p data-text-safe className="mt-1 text-[11px] leading-relaxed text-dim">BRL e cripto aparecerão aqui após backend e providers estarem ativos.</p>
            </article>
            <article data-layout-guard="pwa-status-card" className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <ShieldCheck className="h-5 w-5 text-gold-bright" />
              <p data-text-safe className="mt-3 text-[12px] font-semibold">Status operacional</p>
              <p data-text-safe className="mt-1 text-[11px] leading-relaxed text-dim">Frontend demo online · operações financeiras desativadas.</p>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="btn-outline-green inline-flex h-10 items-center rounded-full px-5 text-[12px] font-semibold">Voltar ao site</Link>
            <Link href="/how-it-works" className="btn-outline-green inline-flex h-10 items-center rounded-full px-5 text-[12px] font-semibold">Ver arquitetura do fluxo</Link>
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#031012]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {[Home, QrCode, WalletCards, UserRound].map((Icon, index) => (
            <button key={index} type="button" disabled className={`flex flex-col items-center gap-1 text-[10px] ${index === 0 ? "text-pix" : "text-dim"}`}>
              <Icon className="h-4 w-4" />
              <span>{["Início", "PIX", "Ativos", "Conta"][index]}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="h-20 lg:hidden" />
    </main>
  );
}
