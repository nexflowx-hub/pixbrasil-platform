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
    title: "Visibilidade primeiro. Movimentação quando o rail estiver pronto.",
    description:
      "O Client Portal reúne conta, KYC, wallets e atividade numa interface única. No MVP, a experiência é read-only para contas convidadas enquanto recebimentos, câmbio e withdrawals concluem validação operacional.",
    icon: UserRound,
    capabilities: [
      ["Client Portal autenticado", "AVAILABLE", "Sessão HttpOnly e account overview real."],
      ["Wallets multiativos", "AVAILABLE", "Saldos por ativo e rede, sem conversão fictícia."],
      ["Receber via PIX", "VALIDATING", "Rail financeiro ainda bloqueado para contas Personal."],
      ["Enviar / Withdraw", "VALIDATING", "Disponível somente após payout e settlement guardrails."],
      ["Conversão", "PLANNED", "Sem FX sintético no MVP."],
    ],
    highlights: [
      [WalletCards, "Wallets transparentes", "Disponível, pending, reserved e blocked separados por ativo."],
      [ShieldCheck, "Estado de identidade", "KYC e status da conta expostos sem esconder restrições."],
      [LockKeyhole, "Sessão isolada", "O browser não recebe acesso direto ao Financial Core."],
    ],
  },
  business: {
    eyebrow: "PIXBRASIL BUSINESS",
    title: "Uma camada de controle para PIX, Stores e routing.",
    description:
      "Empresas visualizam Stores, provider selecionado, classe de liberação e PaymentIntents no mesmo portal. A API S2S está disponível no piloto SHADOW; execução PIX live continua protegida por kill-switch.",
    icon: Building2,
    capabilities: [
      ["Client Portal Business", "AVAILABLE", "Account switch e visão merchant/store real."],
      ["Stores e routing", "AVAILABLE", "Provider, gateway, D0/D1 e release profile por Store."],
      ["API PIX S2S", "SHADOW", "PaymentIntent e routing decision sem movimentar fundos."],
      ["PIX live", "VALIDATING", "Aguardando create → webhook → settlement validado."],
      ["Payouts", "VALIDATING", "Manual/automatic payout permanecem feature-flagged."],
    ],
    highlights: [
      [Store, "Store-scoped", "Cada operação pode ter provider, custos e release diferentes."],
      [GitBranch, "Routing explícito", "D0/D1 não fazem fallback cruzado por acidente."],
      [Code2, "S2S isolado", "API Keys com hash SHA-256 e grants por Store."],
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
                Solicitar acesso
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/9 bg-[#061416]/92 p-5 shadow-[0_30px_100px_rgba(0,0,0,.28)] sm:p-6">
            <div className="flex items-center justify-between border-b border-white/7 pb-4">
              <div>
                <span className="text-[9px] uppercase tracking-[.14em] text-[#607970]">Capability matrix</span>
                <strong className="mt-1 block text-[14px]">Estado do MVP</strong>
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
              <span className="text-[9px] font-bold uppercase tracking-[.14em] text-[#C7A95A]">TRANSPARÊNCIA OPERACIONAL</span>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Nenhuma feature é chamada de “ativa” antes de estar operacional.</h2>
              <p className="mt-3 max-w-3xl text-[10px] leading-5 text-[#8D826A]">
                O PiXBrasil distingue interface disponível, rail em SHADOW, capacidade em validação e função planejada. Isso também aparece no portal e no Control Plane.
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
