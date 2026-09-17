import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  Code2,
  CreditCard,
  FileText,
  Home,
  Layers3,
  ArrowLeftRight,
  Settings,
  UserRound,
  Wallet,
} from "lucide-react";
import { BalanceChart } from "./balance-chart";
import { cn } from "@/lib/utils";

const SIDEBAR = [
  { icon: Home, label: "Início", active: true },
  { icon: QrIcon, label: "PIX" },
  { icon: Layers3, label: "Ativos" },
  { icon: ArrowLeftRight, label: "Converter" },
  { icon: FileText, label: "Histórico" },
  { icon: CreditCard, label: "Cartões" },
  { icon: Code2, label: "API" },
  { icon: Settings, label: "Configurações" },
];

function QrIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M18 18h3v3" />
    </svg>
  );
}

const ASSET_CARDS = [
  {
    symbol: "₮",
    symbolClass: "bg-pix/15 text-pix border-pix/30",
    name: "USDT Liquid",
    value: "R$ 12.430,50",
    amount: "3.420,00 USDT",
  },
  {
    symbol: "◆",
    symbolClass: "bg-danger/10 text-danger border-danger/25",
    name: "USDT TRON",
    value: "R$ 8.225,90",
    amount: "2.280,00 USDT",
  },
  {
    symbol: "₿",
    symbolClass: "bg-gold/10 text-gold-bright border-gold/25",
    name: "L-BTC",
    value: "R$ 4.235,90",
    amount: "0,048 L-BTC",
  },
];

/**
 * Premium laptop running the PiXBrasil web dashboard —
 * the entire interface is real React/CSS, not an image.
 */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-[690px]", className)} role="img" aria-label="Dashboard web PiXBrasil em um laptop exibindo saldo, ativos digitais e status operacional">
      {/* Screen */}
      <div className="rounded-[18px] border border-[#1d2829] bg-gradient-to-b from-[#10191a] to-[#0b1314] p-[9px] pb-[10px] shadow-[0_35px_80px_rgba(0,0,0,0.55)] ring-1 ring-black/70">
        <div className="flex h-[398px] flex-col overflow-hidden rounded-[11px] bg-[#031719] ring-1 ring-pix/10">
          {/* Topbar */}
          <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-3.5">
            <span className="leading-none">
              <span className="text-[11.5px] font-bold tracking-[-0.02em] text-cream">
                Pi
                <span className="bg-gradient-to-r from-[#19F5A4] to-[#28EBD0] bg-clip-text text-transparent">
                  X
                </span>
                Brasil<span className="text-mist/80">.org</span>
              </span>
              <span className="mt-[2px] block text-[4.6px] font-semibold uppercase tracking-[0.26em] text-[#8BA5A0]">
                Seu dinheiro sem fronteiras
              </span>
            </span>

            <div className="ml-3 flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-full border border-pix/45 bg-pix/12 px-2.5 py-[5px] text-[9px] font-semibold text-pix">
                <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
                Pessoal
              </span>
              <span className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-[5px] text-[9px] font-medium text-dim">
                <Wallet className="h-2.5 w-2.5" aria-hidden="true" />
                Empresarial
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#2ACFE5] to-[#0EBF82] text-[9px] font-bold text-[#02120D]">
                A
              </span>
              <span className="leading-tight">
                <span className="block text-[8.5px] font-semibold text-cream">
                  André Silva
                </span>
                <span className="block text-[6.5px] text-dim">
                  Conta Pessoal
                </span>
              </span>
              <Bell className="h-3 w-3 text-mist" aria-hidden="true" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Sidebar */}
            <aside className="w-[116px] shrink-0 border-r border-white/[0.06] px-2 py-2.5">
              <ul className="space-y-[3px]">
                {SIDEBAR.map((item) => (
                  <li
                    key={item.label}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-[6px] text-[9px]",
                      item.active
                        ? "border border-pix/25 bg-pix/10 font-semibold text-cream"
                        : "border border-transparent text-dim"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-3 w-3",
                        item.active ? "text-pix" : "text-dim"
                      )}
                      aria-hidden="true"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </aside>

            {/* Main panel */}
            <div className="min-w-0 flex-1 space-y-2.5 p-3">
              {/* Balance */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[8.5px] font-medium text-dim">
                      Saldo total
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[19px] font-bold tracking-[-0.01em] text-cream">
                        R$ 24.892,30
                      </p>
                      <span className="flex items-center gap-0.5 rounded-md bg-pix/10 px-1.5 py-[3px] text-[8px] font-semibold text-pix">
                        <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
                        +5,2%
                      </span>
                    </div>
                    <p className="mt-1 text-[7px] text-dim">
                      Últimos 30 dias
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[7px] text-mist">
                      Últimos 30 dias
                      <ChevronDown className="h-2 w-2" aria-hidden="true" />
                    </span>
                    <BalanceChart className="h-[54px] w-[218px]" />
                  </div>
                </div>
              </div>

              {/* Assets */}
              <div className="grid grid-cols-3 gap-2">
                {ASSET_CARDS.map((asset) => (
                  <div
                    key={asset.name}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold",
                          asset.symbolClass
                        )}
                      >
                        {asset.symbol}
                      </span>
                      <span className="text-[8.5px] font-semibold text-cream">
                        {asset.name}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] font-bold text-cream">
                      {asset.value}
                    </p>
                    <p className="mt-[1px] text-[7px] text-dim">
                      {asset.amount}
                    </p>
                  </div>
                ))}
              </div>

              {/* Operational */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
                  <p className="text-[8px] text-dim">Recebimentos PIX hoje</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-pix/12">
                      <ArrowUpRight
                        className="h-2.5 w-2.5 text-pix"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-[11px] font-bold text-cream">
                      R$ 7.320,00
                    </span>
                  </div>
                  <p className="mt-1 text-[7px] text-dim">12 transações</p>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
                  <p className="text-[8px] text-dim">Saídas</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-danger/12">
                      <ArrowDownRight
                        className="h-2.5 w-2.5 text-danger"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-[11px] font-bold text-cream">
                      R$ 2.140,00
                    </span>
                  </div>
                  <p className="mt-1 text-[7px] text-dim">5 transações</p>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
                  <p className="text-[8px] text-dim">Status operacional</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pix opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-pix" />
                    </span>
                    <span className="text-[11px] font-bold text-pix">
                      Online
                    </span>
                  </div>
                  <p className="mt-1 text-[7px] text-dim">
                    Tudo funcionando normalmente
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base / hinge */}
      <div className="relative -mx-[13px] h-[13px] rounded-b-[14px] rounded-t-[3px] bg-gradient-to-b from-[#33403f] via-[#1a2424] to-[#0d1415] shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
        <span className="absolute left-1/2 top-0 h-[5px] w-[92px] -translate-x-1/2 rounded-b-[6px] bg-[#0a0f10]" />
      </div>
    </div>
  );
}
