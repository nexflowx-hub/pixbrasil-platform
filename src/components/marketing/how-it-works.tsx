import Link from "next/link";
import { ArrowLeftRight, ArrowRight, ArrowDown, Layers3, Wallet } from "lucide-react";

function PixSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" />
      <path d="M8.1 8.1 12 4.4l3.9 3.7M15.9 15.9 12 19.6l-3.9-3.7M8.1 15.9 4.4 12l3.7-3.9M15.9 8.1 19.6 12l-3.7 3.9" />
    </svg>
  );
}

const STEPS = [
  { number: 1, icon: PixSymbol, title: "PIX", description: "A entrada é confirmada pelo provider" },
  { number: 2, icon: ArrowLeftRight, title: "Conversão", description: "A rota de conversão é registrada e conciliada" },
  { number: 3, icon: Layers3, title: "Blockchain", description: "O ativo é mantido no rail digital aplicável" },
  { number: 4, icon: Wallet, title: "Saída", description: "Retirada em BRL ou cripto, conforme disponibilidade" },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-label="Como funciona" className="relative z-10 mx-auto w-full max-w-[1640px] px-5 pt-8 sm:px-8 xl:px-12">
      <div className="grid gap-6 2xl:grid-cols-[264px_minmax(0,1fr)_190px] 2xl:items-center">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-pix">Como funciona</p>
          <h2 className="mt-2 text-[22px] font-bold leading-[1.12] tracking-[-0.03em] text-cream xl:text-[24px]">
            Do PIX ao mundo digital, em poucos passos.
          </h2>
          <p className="mt-2 text-[12.5px] text-mist">Simples para você. Poderoso para o seu negócio.</p>
          <Link href="/how-it-works" className="group mt-3 inline-flex items-center gap-2 rounded-full border border-pix/35 bg-pix/[0.08] px-3.5 py-2 text-[11px] font-medium text-cream transition-all duration-200 hover:border-pix/60 hover:bg-pix/15">
            Conheça todos os detalhes
            <ArrowRight className="h-3.5 w-3.5 text-pix transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="hidden min-w-0 grid-cols-4 gap-3 lg:grid">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative min-w-0">
              <StepCard step={step} />
              {i < STEPS.length - 1 ? (
                <ArrowRight className="absolute -right-[18px] top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-pix/70" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <StepCard step={step} />
              {i < STEPS.length - 1 ? <ArrowDown className="mx-auto mt-1 h-5 w-5 text-pix/70 sm:hidden" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>

        <p
          className="font-script justify-self-center -rotate-3 text-center text-[26px] font-semibold leading-[1.05] text-transparent 2xl:justify-self-end"
          style={{ backgroundImage:"linear-gradient(100deg,#E7C569 0%,#D2A34E 55%,#8FE8C2 100%)", WebkitBackgroundClip:"text", backgroundClip:"text" }}
          aria-label="Mesmo valor. Mais possibilidades."
        >
          Mesmo valor.<br/>Mais possibilidades.
        </p>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div data-layout-guard="flow-card" className="card-hover glass-panel flex h-full min-h-[96px] min-w-0 items-start gap-3 rounded-2xl px-4 py-4">
      <step.icon className="h-9 w-9 shrink-0 text-pix" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold leading-tight text-cream">{step.number}. {step.title}</p>
        <p className="mt-1.5 text-[11px] leading-[1.38] text-dim">{step.description}</p>
      </div>
    </div>
  );
}
