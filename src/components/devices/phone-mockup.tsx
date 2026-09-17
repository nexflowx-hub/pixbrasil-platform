import {
  ArrowUpRight,
  Eye,
  Home,
  LayoutGrid,
  MoreHorizontal,
  QrCode,
  RefreshCcw,
  Send,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBar() {
  return (
    <div className="relative flex items-center justify-between px-5 pt-[9px] text-[8px] font-semibold text-cream/90">
      <span>9:41</span>
      {/* Dynamic island */}
      <span className="absolute left-1/2 top-[7px] h-[13px] w-[56px] -translate-x-1/2 rounded-full bg-black/90" />
      <span className="flex items-center gap-[3px]">
        {/* signal */}
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 3}
              y={7 - (i + 1) * 1.6}
              width="2"
              height={(i + 1) * 1.6}
              rx="0.5"
              fill="currentColor"
              opacity={i === 3 ? 0.4 : 1}
            />
          ))}
        </svg>
        {/* wifi */}
        <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
          <path
            d="M1 3.2a6 6 0 0 1 8 0M2.6 5a3.6 3.6 0 0 1 4.8 0M5 6.8h.01"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        {/* battery */}
        <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
          <rect
            x="0.5"
            y="0.5"
            width="13"
            height="7"
            rx="2"
            stroke="currentColor"
            strokeOpacity="0.5"
            fill="none"
          />
          <rect x="2" y="2" width="9" height="4" rx="1" fill="currentColor" />
          <path d="M15 3v2" stroke="currentColor" strokeOpacity="0.5" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: QrCode, label: "Receber PIX" },
  { icon: Send, label: "Enviar" },
  { icon: RefreshCcw, label: "Converter" },
  { icon: MoreHorizontal, label: "Mais" },
];

const ASSETS = [
  {
    symbol: "₮",
    symbolClass: "bg-pix/15 text-pix border-pix/30",
    name: "USDT (Liquid)",
    value: "R$ 12.430,50",
    trend: "+2,4%",
  },
  {
    symbol: "₮",
    symbolClass: "bg-danger/10 text-danger border-danger/25",
    name: "USDT (TRON)",
    value: "R$ 8.225,90",
    trend: "+1,8%",
  },
];

const TABS = [
  { icon: Home, label: "Início", active: true },
  { icon: LayoutGrid, label: "Ativos" },
  { icon: QrCode, label: "PIX" },
  { icon: Wallet, label: "Carteira" },
  { icon: MoreHorizontal, label: "Mais" },
];

/**
 * Real React/CSS smartphone — app UI rendered live inside a premium frame.
 */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-[442px] w-[210px] rounded-[34px] bg-gradient-to-b from-[#3d4d4e] via-[#151d1e] to-[#2e3a3b] p-[5px]",
        "shadow-[0_35px_80px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-black/70",
        className
      )}
      role="img"
      aria-label="Aplicativo PiXBrasil em um smartphone exibindo saldo, ativos e ações rápidas"
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[29px] border border-black/50 bg-[#04161a]">
        {/* screen glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "radial-gradient(280px 200px at 50% -10%, rgba(32,242,154,0.10), transparent 70%)",
          }}
        />

        <StatusBar />

        {/* App header */}
        <div className="mt-3 flex items-center justify-between px-3.5">
          <span className="text-[11px] font-bold tracking-[-0.02em] text-cream">
            Pi
            <span className="bg-gradient-to-r from-[#19F5A4] to-[#28EBD0] bg-clip-text text-transparent">
              X
            </span>
            Brasil<span className="text-mist/80">.org</span>
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#2ACFE5] to-[#0EBF82] text-[9px] font-bold text-[#02120D] ring-1 ring-pix/40">
            A
          </span>
        </div>

        {/* Greeting */}
        <div className="px-3.5 pt-2">
          <p className="text-[13px] font-semibold text-cream">Olá, André</p>
          <p className="text-[8.5px] leading-[1.35] text-dim">
            Sua jornada financeira,
            <br />
            mais livre hoje.
          </p>
        </div>

        {/* Balance card */}
        <div className="mx-3 mt-2.5 rounded-xl border border-pix/25 bg-gradient-to-br from-[#0A2A26] to-[#06201F] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-medium text-dim">Saldo total</span>
            <Eye className="h-3 w-3 text-dim" aria-hidden="true" />
          </div>
          <p className="mt-0.5 text-[15px] font-bold tracking-[-0.01em] text-cream">
            R$ 24.892,30
          </p>
        </div>

        {/* Quick actions */}
        <div className="mt-2.5 grid grid-cols-4 px-3">
          {QUICK_ACTIONS.map((action) => (
            <div
              key={action.label}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-pix/30 bg-pix/10">
                <action.icon
                  className="h-3.5 w-3.5 text-pix"
                  aria-hidden="true"
                />
              </span>
              <span className="text-[6.8px] font-medium text-mist">
                {action.label}
              </span>
            </div>
          ))}
        </div>

        {/* Assets */}
        <div className="mt-3 flex items-center justify-between px-3.5">
          <span className="text-[9px] font-semibold text-cream/90">
            Meus ativos
          </span>
        </div>
        <div className="mt-1.5 space-y-1.5 px-3">
          {ASSETS.map((asset) => (
            <div
              key={asset.name}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold",
                  asset.symbolClass
                )}
              >
                {asset.symbol}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-medium text-mist">
                  {asset.name}
                </p>
                <p className="text-[9.5px] font-semibold text-cream">
                  {asset.value}
                </p>
              </div>
              <span className="flex items-center gap-px text-[8px] font-semibold text-pix">
                {asset.trend}
                <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
              </span>
            </div>
          ))}
        </div>

        {/* Bottom navigation */}
        <nav
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 border-t border-white/[0.07] bg-[#031012]/95 px-2.5 pb-3 pt-1.5 backdrop-blur"
        >
          <ul className="grid grid-cols-5">
            {TABS.map((tab) => (
              <li
                key={tab.label}
                className={cn(
                  "flex flex-col items-center gap-[3px]",
                  tab.active ? "text-pix" : "text-dim/80"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="text-[6.4px] font-medium">{tab.label}</span>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
