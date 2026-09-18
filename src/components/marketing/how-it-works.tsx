import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowDown,
  Layers3,
  Wallet,
} from "lucide-react";

/** PIX-inspired diamond symbol (four joined arrows). */
function PixSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" />
      <path d="M8.1 8.1 12 4.4l3.9 3.7M15.9 15.9 12 19.6l-3.9-3.7M8.1 15.9 4.4 12l3.7-3.9M15.9 8.1 19.6 12l-3.7 3.9" />
    </svg>
  );
}

const STEPS = [
  {
    number: 1,
    icon: PixSymbol,
    title: "PIX",
    description: "Você recebe via PIX",
  },
  {
    number: 2,
    icon: ArrowLeftRight,
    title: "Conversão",
    description: "O valor é convertido em ativos digitais",
  },
  {
    number: 3,
    icon: Layers3,
    title: "Blockchain",
    description: "Seus ativos em Liquid e TRON",
  },
  {
    number: 4,
    icon: Wallet,
    title: "Saque",
    description: "Retire em BRL via PIX ou em cripto",
  },
];

/**
 * "Como funciona" — intro + 4 horizontal steps with emerald connectors.
 */
export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-label="Como funciona"
      className="relative z-10 mx-auto w-full max-w-[1640px] px-5 pt-8 sm:px-8 xl:px-12"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
        {/* Intro */}
        <div className="shrink-0 xl:w-[264px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-pix">
            Como funciona
          </p>
          <h2 className="mt-2 text-[22px] font-bold leading-[1.12] tracking-[-0.03em] text-cream xl:text-[24px]">
            Do PIX ao mundo digital, em poucos passos.
          </h2>
          <p className="mt-2 text-[12.5px] text-mist">
            Simples para você. Poderoso para o seu negócio.
          </p>
          <Link
            href="/how-it-works"
            className="group mt-3 inline-flex items-center gap-2 rounded-full border border-pix/35 bg-pix/[0.08] px-3.5 py-2 text-[11px] font-medium text-cream transition-all duration-200 hover:border-pix/60 hover:bg-pix/15"
          >
            Conheça todos os detalhes
            <ArrowRight
              className="h-3.5 w-3.5 text-pix transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* Steps — desktop horizontal */}
        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex min-w-0 items-center gap-2">
              <StepCard step={step} />
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="h-6 w-6 shrink-0 text-pix/80"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps — tablet 2x2 / mobile vertical */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <StepCard step={step} />
              {i < STEPS.length - 1 && (
                <ArrowDown
                  className="mx-auto mt-1 h-5 w-5 text-pix/70 sm:hidden"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {/* Handwritten flourish */}
        <p
          className="font-script shrink-0 -rotate-3 text-center text-[26px] font-semibold leading-[1.05] text-transparent xl:w-[190px]"
          style={{
            backgroundImage:
              "linear-gradient(100deg, #E7C569 0%, #D2A34E 55%, #8FE8C2 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
          aria-label="Mesmo valor. Mais possibilidades."
        >
          Mesmo valor.
          <br />
          Mais possibilidades.
        </p>
      </div>
    </section>
  );
}

function StepCard({
  step,
}: {
  step: (typeof STEPS)[number];
}) {
  return (
    <div className="card-hover glass-panel flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3.5">
      <step.icon className="h-10 w-10 shrink-0 text-pix" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[14px] font-bold leading-tight text-cream">
          {step.number}. {step.title}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-dim">
          {step.description}
        </p>
      </div>
    </div>
  );
}
