import { ClipboardCheck, Clock3, Share2, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Infraestrutura segura",
    description: "Padrões de segurança de nível institucional",
  },
  {
    icon: Clock3,
    title: "Liquidação em até 24h",
    description: "Agilidade com controle e conformidade",
  },
  {
    icon: Share2,
    title: "Rede Liquid e TRON",
    description: "Blockchain confiáveis e eficientes",
  },
  {
    icon: ClipboardCheck,
    title: "Gestão de risco e revisão operacional",
    description: "Monitoramento contínuo",
  },
];

/** Golden laurel seal with centered copy. */
function TrustSeal() {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 text-gold"
      role="img"
      aria-label="Selo: Tecnologia a serviço de um Brasil mais livre"
    >
      <svg
        viewBox="0 0 26 64"
        className="h-[58px] w-[24px]"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20 4c-6 6-9 14-8 26 1 10 4 20 9 28l-2 2c-7-9-11-20-12-30C6 18 10 9 17 2Z" />
        {[8, 14, 20, 26, 32, 38, 44].map((y, i) => (
          <ellipse key={i} cx={i % 2 === 0 ? 7 : 11} cy={y + 4} rx="4.5" ry="2" transform={`rotate(${-24 + i * 6} ${i % 2 === 0 ? 7 : 11} ${y + 4})`} opacity="0.9" />
        ))}
      </svg>
      <p className="max-w-[120px] text-center text-[8px] font-bold uppercase leading-[1.65] tracking-[0.14em]">
        Tecnologia
        <br />
        a serviço de um
        <br />
        Brasil mais livre
      </p>
      <svg
        viewBox="0 0 26 64"
        className="h-[58px] w-[24px] scale-x-[-1]"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20 4c-6 6-9 14-8 26 1 10 4 20 9 28l-2 2c-7-9-11-20-12-30C6 18 10 9 17 2Z" />
        {[8, 14, 20, 26, 32, 38, 44].map((y, i) => (
          <ellipse key={i} cx={i % 2 === 0 ? 7 : 11} cy={y + 4} rx="4.5" ry="2" transform={`rotate(${-24 + i * 6} ${i % 2 === 0 ? 7 : 11} ${y + 4})`} opacity="0.9" />
        ))}
      </svg>
    </div>
  );
}

/**
 * Trust strip: label + four security features + gold seal.
 */
export function Trust() {
  return (
    <section
      id="seguranca"
      aria-label="Segurança e confiança"
      className="relative z-10 mx-auto w-full max-w-[1640px] px-5 pt-9 sm:px-8 xl:px-12"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-10">
        {/* Label */}
        <div className="shrink-0 xl:w-[236px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-pix">
            Confiança
          </p>
          <h2 className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-cream">
            EM CADA OPERAÇÃO
          </h2>
          <p className="mt-1.5 text-[11.5px] leading-[1.5] text-mist">
            Infraestrutura robusta, processos revisados e foco total na
            segurança dos seus ativos.
          </p>
        </div>

        {/* Features */}
        <ul className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pix/25 bg-pix/[0.07]">
                <feature.icon
                  className="h-5 w-5 text-pix"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-snug text-cream">
                  {feature.title}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-dim">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Gold seal */}
        <div className="hidden xl:block">
          <TrustSeal />
        </div>
      </div>

      {/* Seal on smaller screens */}
      <div className="mt-6 flex justify-center xl:hidden">
        <TrustSeal />
      </div>
    </section>
  );
}
