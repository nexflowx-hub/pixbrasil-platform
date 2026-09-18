import {
  ArrowLeftRight,
  Building2,
  Code2,
  Layers3,
  Link2,
  UserRound,
} from "lucide-react";

const ITEMS = [
  { icon: UserRound, title: "Conta pessoal", description: "Sua vida financeira em um só lugar" },
  { icon: Building2, title: "Conta empresarial", description: "Mais eficiência para o seu negócio" },
  { icon: Code2, title: "API PIX", description: "Integração simples e poderosa" },
  { icon: Link2, title: "Links de pagamento", description: "Venda onde quiser" },
  { icon: Layers3, title: "Liquidação em ativos digitais", description: "Mantenha o valor em blockchain" },
  { icon: ArrowLeftRight, title: "Saída via PIX ou cripto", description: "Liberdade para usar seus recursos" },
];

export function CapabilityBar() {
  return (
    <section
      id="recursos"
      aria-label="Capacidades da plataforma"
      className="relative z-10 mx-auto w-full max-w-[1640px] px-5 sm:px-8 xl:px-12"
    >
      <div className="glass-panel scrollbar-hide flex snap-x snap-mandatory overflow-x-auto rounded-[18px] 2xl:grid 2xl:grid-cols-6 2xl:overflow-visible">
        {ITEMS.map((item, i) => (
          <div
            key={item.title}
            data-layout-guard="capability-card"
            className={[
              "card-hover flex min-h-[76px] min-w-[238px] snap-start items-start gap-3 px-4 py-4",
              "2xl:min-w-0 2xl:items-center",
              i > 0 ? "border-l border-[rgba(58,211,182,0.14)]" : "",
            ].join(" ")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pix/25 bg-pix/[0.08]">
              <item.icon className="h-[17px] w-[17px] text-pix" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span data-text-safe className="block text-[12.5px] font-semibold leading-[1.22] text-cream 2xl:text-[13px]">
                {item.title}
              </span>
              <span data-text-safe className="mt-1 block text-[10.5px] leading-[1.35] text-dim 2xl:text-[11px]">
                {item.description}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
