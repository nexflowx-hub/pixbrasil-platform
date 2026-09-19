import { ClipboardCheck, Clock3, Share2, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: ShieldCheck, title: "Infraestrutura segura", description: "Controles técnicos, segregação de funções e trilha auditável." },
  { icon: Clock3, title: "Liquidação operacional", description: "Estados de processamento claros, sem esconder etapas intermediárias." },
  { icon: Share2, title: "Liquid e TRON", description: "Rails digitais separados por ativo, rede e política operacional." },
  { icon: ClipboardCheck, title: "Gestão de risco", description: "Monitoramento, revisão operacional e decisões registradas." },
];

function TrustSeal() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-gold" role="img" aria-label="Selo: Tecnologia a serviço de um Brasil mais livre">
      <svg viewBox="0 0 26 64" className="h-[58px] w-[24px]" fill="currentColor" aria-hidden="true">
        <path d="M20 4c-6 6-9 14-8 26 1 10 4 20 9 28l-2 2c-7-9-11-20-12-30C6 18 10 9 17 2Z" />
        {[8,14,20,26,32,38,44].map((y,i)=><ellipse key={i} cx={i%2===0?7:11} cy={y+4} rx="4.5" ry="2" transform={`rotate(${-24+i*6} ${i%2===0?7:11} ${y+4})`} opacity="0.9" />)}
      </svg>
      <p className="max-w-[120px] text-center text-[8px] font-bold uppercase leading-[1.65] tracking-[0.14em]">
        Tecnologia<br/>a serviço de um<br/>Brasil mais livre
      </p>
      <svg viewBox="0 0 26 64" className="h-[58px] w-[24px] scale-x-[-1]" fill="currentColor" aria-hidden="true">
        <path d="M20 4c-6 6-9 14-8 26 1 10 4 20 9 28l-2 2c-7-9-11-20-12-30C6 18 10 9 17 2Z" />
        {[8,14,20,26,32,38,44].map((y,i)=><ellipse key={i} cx={i%2===0?7:11} cy={y+4} rx="4.5" ry="2" transform={`rotate(${-24+i*6} ${i%2===0?7:11} ${y+4})`} opacity="0.9" />)}
      </svg>
    </div>
  );
}

export function Trust() {
  return (
    <section
      id="seguranca"
      aria-label="Segurança e confiança"
      className="relative z-10 mx-auto w-full max-w-[1640px] px-5 pb-9 pt-9 sm:px-8 xl:px-12"
    >
      <div className="grid gap-6 xl:grid-cols-[236px_minmax(0,1fr)_170px] xl:items-center xl:gap-8">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-pix">Confiança</p>
          <h2 className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-cream">EM CADA OPERAÇÃO</h2>
          <p className="mt-1.5 text-[11.5px] leading-[1.55] text-mist">
            Infraestrutura robusta, processos revisados e foco em segurança operacional.
          </p>
        </div>

        <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <li key={feature.title} data-layout-guard="trust-card" className="flex min-h-[92px] items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pix/25 bg-pix/[0.07]">
                <feature.icon className="h-[18px] w-[18px] text-pix" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p data-text-safe className="text-[12.5px] font-semibold leading-[1.28] text-cream">{feature.title}</p>
                <p data-text-safe className="mt-1.5 text-[10.8px] leading-[1.42] text-dim">{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-center xl:justify-end">
          <TrustSeal />
        </div>
      </div>
    </section>
  );
}
