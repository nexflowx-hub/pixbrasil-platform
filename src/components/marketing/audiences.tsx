import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CircleCheck, UserRound } from "lucide-react";

const BENEFITS_PERSONAL = [
  "Carteira multiativos",
  "Portal com estados financeiros",
  "Rails ativados por disponibilidade",
  "Gestão simplificada",
];

const BENEFITS_BUSINESS = [
  "API PIX S2S em produção",
  "Stores e routing por operação",
  "Liquidação em ativos digitais",
  "Suporte especializado",
];

type AudienceCardProps = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: readonly string[];
  href: string;
  image: string;
  imagePosition: string;
  kind: "personal" | "business";
};

function AudienceCard({
  id,
  title,
  subtitle,
  description,
  benefits,
  href,
  image,
  imagePosition,
  kind,
}: AudienceCardProps) {
  const Icon = kind === "personal" ? UserRound : Building2;

  return (
    <article
      id={id}
      data-layout-guard="audience-card"
      className="card-hover group relative flex min-h-[255px] flex-col overflow-hidden rounded-2xl border border-[rgba(43,231,181,0.4)] bg-[linear-gradient(110deg,rgba(3,22,24,0.98),rgba(5,24,27,0.76))] p-5 sm:min-h-[238px] sm:p-6"
    >
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-full sm:w-[48%] lg:w-[44%]">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 639px) 100vw, (max-width: 1024px) 48vw, 42vw"
          className="object-cover brightness-[0.78]"
          style={{
            objectPosition: imagePosition,
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.22) 18%, rgba(0,0,0,0.85) 72%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.22) 18%, rgba(0,0,0,0.85) 72%, black 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,22,24,0.98)_0%,rgba(3,22,24,0.68)_46%,rgba(2,9,11,0.48)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full max-w-full flex-1 flex-col sm:max-w-[64%] lg:max-w-[62%]">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pix/30 bg-pix/[0.08]">
            <Icon className="h-5 w-5 text-pix" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold tracking-[-0.02em] text-cream">{title}</h2>
            <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-mist">{subtitle}</p>
          </div>
        </div>

        <p className="mt-3 text-[12.5px] leading-[1.58] text-mist">{description}</p>

        <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex min-w-0 items-start gap-1.5 text-[11px] font-medium leading-snug text-mist">
              <CircleCheck className="mt-[1px] h-3.5 w-3.5 shrink-0 text-pix" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <Link
          href={href}
          className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-[11.5px] font-semibold text-pix transition-colors hover:text-pix-bright"
        >
          Explorar solução
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function Audiences() {
  return (
    <section
      aria-label="Soluções para pessoas e empresas"
      className="relative z-10 mx-auto grid w-full max-w-[1640px] grid-cols-1 items-stretch gap-4 px-5 pt-8 sm:px-8 lg:grid-cols-2 xl:px-12"
    >
      <AudienceCard
        id="para-voce"
        title="Para Você"
        subtitle="Mais liberdade para o seu dinheiro."
        description="Acompanhe contas, wallets e estados operacionais em uma experiência única, com capacidades financeiras liberadas de forma progressiva e transparente."
        benefits={BENEFITS_PERSONAL}
        href="/personal"
        image="/images/rio-sunset.png"
        imagePosition="70% 30%"
        kind="personal"
      />
      <AudienceCard
        id="empresas"
        title="Para Empresas"
        subtitle="Soluções completas para o seu negócio."
        description="Integre API PIX, separe Stores por regra comercial e acompanhe routing, provider e liberação em uma única camada operacional."
        benefits={BENEFITS_BUSINESS}
        href="/business"
        image="/images/sao-paulo-night.png"
        imagePosition="50% 50%"
        kind="business"
      />
    </section>
  );
}
