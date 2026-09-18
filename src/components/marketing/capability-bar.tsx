import {
  ArrowLeftRight,
  Building2,
  Code2,
  Layers3,
  Link2,
  UserRound,
} from "lucide-react";

const ITEMS = [
  {
    icon: UserRound,
    title: "Conta pessoal",
    description: "Sua vida financeira em um só lugar",
  },
  {
    icon: Building2,
    title: "Conta empresarial",
    description: "Mais eficiência para o seu negócio",
  },
  {
    icon: Code2,
    title: "API PIX",
    description: "Integração simples e poderosa",
  },
  {
    icon: Link2,
    title: "Links de pagamento",
    description: "Venda onde quiser",
  },
  {
    icon: Layers3,
    title: "Liquidação em ativos digitais",
    description: "Mantém o valor em blockchain",
  },
  {
    icon: ArrowLeftRight,
    title: "Saída via PIX ou cripto",
    description: "Liberdade para usar seus recursos",
  },
];

/**
 * Glass capability ribbon right below the hero.
 */
export function CapabilityBar() {
  return (
    <section
      id="recursos"
      aria-label="Capacidades da plataforma"
      className="relative z-10 mx-auto w-full max-w-[1640px] px-5 sm:px-8 xl:px-12"
    >
      <div className="glass-panel scrollbar-hide flex snap-x snap-mandatory gap-0 overflow-x-auto rounded-[18px] xl:grid xl:grid-cols-6 xl:overflow-visible">
        {ITEMS.map((item, i) => (
          <div
            key={item.title}
            className={`card-hover flex min-w-[228px] snap-start items-center gap-2.5 px-3 py-3.5 xl:min-w-0 xl:px-4 ${
              i > 0 ? "border-l border-[rgba(58,211,182,0.14)]" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pix/25 bg-pix/[0.08]">
              <item.icon
                className="h-[17px] w-[17px] text-pix"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[12.5px] font-semibold leading-tight text-cream xl:text-[13px]">
                {item.title}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[10.5px] leading-snug text-dim xl:text-[11px]">
                {item.description}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
