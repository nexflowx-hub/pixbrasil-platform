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
      <div className="glass-panel grid auto-rows-fr grid-cols-1 gap-2 rounded-[18px] p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {ITEMS.map((item) => (
          <article
            key={item.title}
            data-layout-guard="capability-card"
            className="card-hover flex min-h-[88px] min-w-0 items-start gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 2xl:min-h-[82px] 2xl:items-center"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pix/25 bg-pix/[0.08]">
              <item.icon className="h-[17px] w-[17px] text-pix" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 data-text-safe className="break-words text-[12.5px] font-semibold leading-[1.28] text-cream 2xl:text-[13px]">
                {item.title}
              </h3>
              <p data-text-safe className="mt-1.5 break-words text-[10.5px] leading-[1.42] text-dim 2xl:text-[11px]">
                {item.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
