import Image from "next/image";
import { ArrowRight, Building2, CircleCheck, UserRound } from "lucide-react";

const BENEFITS_PERSONAL = [
  "Carteira multiativos",
  "Recebimento via PIX",
  "Saque em BRL ou cripto",
  "Gestão simplificada",
];

const BENEFITS_BUSINESS = [
  "API PIX robusta",
  "Links de pagamento",
  "Liquidação em ativos digitais",
  "Suporte especializado",
];

/**
 * Audience cards: personal (Rio) and business (São Paulo).
 */
export function Audiences() {
  return (
    <section
      aria-label="Soluções para pessoas e empresas"
      className="relative z-10 mx-auto grid w-full max-w-[1640px] grid-cols-1 gap-4 px-5 pt-8 sm:px-8 lg:grid-cols-2 xl:px-12"
    >
      {/* ── Para Você ── */}
      <article
        id="para-voce"
        className="card-hover group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-[rgba(43,231,181,0.4)] bg-[linear-gradient(110deg,rgba(3,22,24,0.97),rgba(5,24,27,0.72))] p-5"
      >
        {/* Rio image — right half, masked */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-[52%] sm:w-[46%]"
        >
          <Image
            src="/images/rio-sunset.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-[70%_30%] brightness-[0.82]"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, black 70%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, black 70%)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,22,24,0.95) 0%,rgba(3,22,24,0.55) 55%,rgba(2,9,11,0.5) 100%)]" />
        </div>

        <div className="relative flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pix/30 bg-pix/[0.08]">
            <UserRound className="h-5 w-5 text-pix" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[19px] font-bold tracking-[-0.02em] text-cream">
              Para Você
            </h2>
            <p className="mt-0.5 text-[12.5px] font-medium text-mist">
              Mais liberdade para o seu dinheiro.
            </p>
          </div>
        </div>

        <p className="relative mt-3 max-w-[440px] text-[12.5px] leading-[1.55] text-mist">
          Receba em PIX, mantenha seus ativos digitais em Liquid e TRON e
          saque quando quiser. Tudo em um só lugar, com total controle.
        </p>

        <ul className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {BENEFITS_PERSONAL.map((benefit) => (
            <li
              key={benefit}
              className="flex items-center gap-1.5 text-[11px] font-medium text-mist"
            >
              <CircleCheck
                className="h-3.5 w-3.5 text-pix"
                aria-hidden="true"
              />
              {benefit}
            </li>
          ))}
        </ul>

        <span
          className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-pix/40 bg-[#03181A]/80 text-pix transition-all duration-200 group-hover:bg-pix group-hover:text-[#02120D]"
          aria-hidden="true"
        >
          <ArrowRight className="h-4.5 w-4.5" />
        </span>
      </article>

      {/* ── Para Empresas ── */}
      <article
        id="empresas"
        className="card-hover group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-[rgba(43,231,181,0.4)] bg-[linear-gradient(110deg,rgba(3,22,24,0.97),rgba(5,24,27,0.72))] p-5"
      >
        {/* São Paulo image — right half, masked */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-[52%] sm:w-[46%]"
        >
          <Image
            src="/images/sao-paulo-night.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-center brightness-[0.85]"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, black 70%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, black 70%)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,22,24,0.95) 0%,rgba(3,22,24,0.55) 55%,rgba(2,9,11,0.55) 100%)]" />
        </div>

        <div className="relative flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pix/30 bg-pix/[0.08]">
            <Building2 className="h-5 w-5 text-pix" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[19px] font-bold tracking-[-0.02em] text-cream">
              Para Empresas
            </h2>
            <p className="mt-0.5 text-[12.5px] font-medium text-mist">
              Soluções completas para o seu negócio.
            </p>
          </div>
        </div>

        <p className="relative mt-3 max-w-[440px] text-[12.5px] leading-[1.55] text-mist">
          Receba pagamentos via PIX, utilize nossa API, crie links de
          pagamento, mantenha liquidez em ativos digitais e escale com
          segurança.
        </p>

        <ul className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {BENEFITS_BUSINESS.map((benefit) => (
            <li
              key={benefit}
              className="flex items-center gap-1.5 text-[11px] font-medium text-mist"
            >
              <CircleCheck
                className="h-3.5 w-3.5 text-pix"
                aria-hidden="true"
              />
              {benefit}
            </li>
          ))}
        </ul>

        <p className="absolute right-4 top-1/2 hidden -translate-y-1/2 text-right text-[9.5px] font-bold uppercase leading-[1.7] tracking-[0.14em] text-white/95 [text-shadow:0_2px_12px_rgba(0,0,0,0.9),0_0_18px_rgba(2,9,11,0.8)] lg:block">
          Empresas
          <br />
          que constroem
          <br />
          o amanhã
          <br />
          <span className="text-gradient-hero">escolhem PiXBrasil</span>
        </p>
      </article>
    </section>
  );
}
