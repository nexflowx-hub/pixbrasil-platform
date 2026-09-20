import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Code2,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/header";
import { SiteFooter } from "@/components/marketing/footer";

type Audience = "personal" | "business";

const content = {
  personal: {
    eyebrow: "PIXBRASIL PERSONAL",
    title: "Sua conta, wallets e atividade numa visão única.",
    description:
      "O Client Portal reúne identidade, saldos por ativo, estados financeiros e atividade da conta. As capacidades transacionais são apresentadas conforme os produtos habilitados para cada perfil.",
    icon: UserRound,
    capabilities: [
      ["Client Portal autenticado", "AVAILABLE", "Sessão segura e visão consolidada da conta."],
      ["Wallets multiativos", "AVAILABLE", "Saldos available, pending, reserved e blocked por ativo."],
      ["Atividade financeira", "AVAILABLE", "Histórico consolidado do Financial Core."],
      ["Produtos transacionais", "ACCOUNT-SCOPED", "Disponibilidade definida pelo perfil e produtos contratados."],
    ],
    highlights: [
      [WalletCards, "Wallets transparentes", "Disponível, pendente, reservado e bloqueado separados por ativo."],
      [ShieldCheck, "Identidade e acesso", "Estado da conta e permissões apresentados de forma explícita."],
      [LockKeyhole, "Sessão isolada", "O browser não recebe acesso direto ao Financial Core."],
    ],
  },
  business: {
    eyebrow: "PIXBRASIL BUSINESS",
    title: "Controle financeiro para PIX, Stores, routing e liquidação.",
    description:
      "Receba PIX em produção por Store, acompanhe provider, custos, classe D0/D1, settlement, Wallet BRL, webhooks e payouts no mesmo ambiente operacional.",
    icon: Building2,
    capabilities: [
      ["Client Portal Business", "AVAILABLE", "Wallet BRL, Stores, pagamentos, liberações e payouts."],
      ["Stores e routing", "AVAILABLE", "Provider, gateway e release policy configurados por Store."],
      ["API PIX S2S", "AVAILABLE", "PaymentIntent idempotente com QR PIX real e consulta de status."],
      ["Settlement & Wallet BRL", "AVAILABLE", "Recebimentos confirmados alimentam saldo disponível ou a liberar."],
      ["Payouts", "AVAILABLE", "Solicitação pelo portal com processamento operacional por ticket nesta fase."],
    ],
    highlights: [
      [Store, "Store-scoped", "Cada operação pode ter provider, custos e release próprios."],
      [GitBranch, "Routing explícito", "As rotas respeitam saúde, prioridade e classe de liberação."],
      [Code2, "S2S isolado", "API Keys com hash SHA-256, grants por Store e webhooks assinados."],
    ],
  },
} as const;

export function AudienceProductPage({ audience }: { audience: Audience }) {
  const meta = content[audience];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-[#020B0D] text-[#F4F1E8]">
      <SiteHeader />
      <main className="relative overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_22%_20%,rgba(32,242,154,.12),transparent_31%),radial-gradient(circle_at_78%_38%,rgba(40,235,208,.08),transparent_32%)]" />
        <section className="relative mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center xl:px-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#20F29A]/20 bg-[#20F29A]/5 px-3 py-1.5 text-[10px] font-bold tracking-[.14em] text-[#76D7B7]">
              <Icon className="h-3.5 w-3.5" />
              {meta.eyebrow}
            </span>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-[58px]">
              {meta.title}
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#8DA39D]">
              {meta.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="btn-cta flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[13px] font-bold">
                Entrar no portal <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/early-access" className="btn-outline-green flex h-11 items-center justify-center rounded-full px-6 text-[13px]">
                Abrir conta
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/9 bg-[#061416]/92 p-5 shadow-[0_30px_100px_rgba(0,0,0,.28)] sm:p-6">
            <div className="flex items-center justify-between border-b border-white/7 pb-4">
              <div>
                <span className="text-[9px] uppercase tracking-[.14em] text-[#607970]">Capability matrix</span>
                <strong className="mt-1 block text-[14px]">Capacidades da plataforma</strong>
              </div>
              <ShieldCheck className="h-5 w-5 text-[#20F29A]" />
            </div>
            <div className="mt-3 space-y-2">
              {meta.capabilities.map(([name, status, description]) => (
                <div key={name} className="rounded-2xl border border-white/7 bg-[#030D0F] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-[11px]">{name}</strong>
                    <StatusBadge value={status} />
                  </div>
                  <p className="mt-2 text-[9px] leading-5 text-[#687F79]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 xl:px-12">
          <div className="grid gap-4 lg:grid-cols-3">
            {meta.highlights.map(([HighlightIcon, title, description]) => (
              <article key={title} className="rounded-[22px] border border-white/8 bg-white/[.018] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#20F29A]/18 bg-[#20F29A]/5 text-[#20F29A]">
                  <HighlightIcon className="h-4.5 w-4.5" />
                </div>
                <h2 className="mt-5 text-[15px] font-semibold tracking-[-.025em]">{title}</h2>
                <p className="mt-2 text-[10px] leading-5 text-[#708780]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 xl:px-12">
          <div className="rounded-[26px] border border-[#D2A34E]/16 bg-[#D2A34E]/4 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-[.14em] text-[#C7A95A]">OPERAÇÃO TRANSPARENTE</span>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">O estado financeiro é visível do provider à Wallet.</h2>
              <p className="mt-3 max-w-3xl text-[10px] leading-5 text-[#8D826A]">
                PaymentIntent, routing, confirmação do provider, settlement, liberação e payout permanecem rastreáveis no Client Portal e no Control Plane.
              </p>
            </div>
            <Link href="/how-it-works" className="mt-5 inline-flex shrink-0 items-center gap-2 text-[11px] font-semibold text-[#D2A34E] sm:mt-0">
              Ver arquitetura <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const available = value === "AVAILABLE";
  const validating = value === "VALIDATING" || value === "SHADOW";
  const Icon = available ? CheckCircle2 : validating ? Clock3 : CircleDashed;
  return (
    <span className={[
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-bold tracking-[.08em]",
      available
        ? "border-[#20F29A]/18 bg-[#20F29A]/5 text-[#74D8B6]"
        : validating
          ? "border-[#D2A34E]/18 bg-[#D2A34E]/5 text-[#D5B86A]"
          : "border-white/9 bg-white/[.025] text-[#708780]",
    ].join(" ")}>
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}
