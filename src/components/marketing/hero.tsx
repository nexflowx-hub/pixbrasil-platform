import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ShieldCheck, Zap } from "lucide-react";
import { BrazilFlag } from "@/components/brand/logo";
import { HeroDeviceScene } from "@/components/devices/hero-device-scene";

const TRUST_ITEMS = [
  { icon: Zap, label: "Rápido" },
  { icon: ShieldCheck, label: "Seguro" },
  { icon: BadgeCheck, label: "Transparente" },
  { icon: null, label: "Feito para o Brasil" }, // Brazil flag
];

/**
 * Landing hero — 42% copy / 58% device composition, cinematic background.
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      aria-label="Apresentação PiXBrasil"
      className="relative"
    >
      {/* Left skyline backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[52%] md:block"
      >
        <Image
          src="/images/hero-skyline.png"
          alt=""
          fill
          priority
          sizes="52vw"
          className="object-cover object-center opacity-60"
          style={{
            maskImage:
              "linear-gradient(to right, black 0%, black 34%, transparent 92%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 0%, black 34%, transparent 92%)",
          }}
        />
        {/* readability wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(2,9,11,0.55) 0%, rgba(2,9,11,0.25) 45%, rgba(2,9,11,0) 75%), linear-gradient(0deg, rgba(2,9,11,0.85) 0%, rgba(2,9,11,0) 40%)",
          }}
        />
      </div>

      {/* Earth horizon — bottom right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-180px] right-[-60px] z-0 hidden h-[260px] w-[580px] md:block lg:bottom-[-200px] lg:h-[290px] lg:w-[640px] xl:bottom-[-220px] xl:h-[300px] xl:w-[680px] 2xl:h-[340px] 2xl:w-[760px] 2xl:right-[-80px] 2xl:bottom-[-240px]"
      >
        <div
          className="absolute inset-0 rounded-[100%] border-t border-[rgba(205,255,240,0.6)] bg-[#03181B]"
          style={{
            boxShadow:
              "0 -12px 55px rgba(40,235,208,0.34), 0 -2px 12px rgba(215,255,246,0.45), inset 0 24px 60px -22px rgba(40,235,208,0.24)",
          }}
        >
          {/* city lights */}
          <div
            className="absolute inset-0 rounded-[100%] opacity-80"
            style={{
              background:
                "radial-gradient(2px 2px at 28% 14%, rgba(231,197,105,0.85), transparent 100%)," +
                "radial-gradient(1.6px 1.6px at 44% 9%, rgba(231,197,105,0.7), transparent 100%)," +
                "radial-gradient(2px 2px at 60% 12%, rgba(231,197,105,0.8), transparent 100%)," +
                "radial-gradient(1.4px 1.4px at 73% 8%, rgba(231,197,105,0.6), transparent 100%)," +
                "radial-gradient(1.8px 1.8px at 84% 15%, rgba(231,197,105,0.7), transparent 100%)," +
                "radial-gradient(1.4px 1.4px at 36% 20%, rgba(231,197,105,0.5), transparent 100%)," +
                "radial-gradient(1.6px 1.6px at 55% 19%, rgba(231,197,105,0.45), transparent 100%)," +
                "radial-gradient(90px 26px at 50% 10%, rgba(40,235,208,0.22), transparent 100%)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1640px] grid-cols-1 items-center gap-10 px-5 pb-8 pt-[96px] sm:px-8 lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)] lg:gap-4 lg:pb-10 lg:pt-[100px] xl:px-12">
        {/* ── Copy ── */}
        <div className="max-w-[560px] lg:pl-[26px] xl:pl-[44px]">
          <p
            className="anim-hero-text text-[10.5px] font-bold uppercase tracking-[0.3em] text-aqua sm:text-[11px]"
            style={{ animationDelay: "0.05s" }}
          >
            MVP privado · infraestrutura financeira em validação
          </p>

          <h1 className="mt-4 text-[42px] font-bold leading-[0.99] tracking-[-0.035em] text-cream sm:text-[44px] lg:text-[42px] xl:text-[50px] 2xl:text-[52px] 3xl:text-[54px]">
            <span
              className="anim-hero-text block"
              style={{ animationDelay: "0.1s" }}
            >
              Entrada via PIX.
            </span>
            <span
              className="anim-hero-text text-gradient-hero block"
              style={{ animationDelay: "0.18s" }}
            >
              Liquidação digital.
            </span>
            <span
              className="anim-hero-text block"
              style={{ animationDelay: "0.26s" }}
            >
              Controle total.
            </span>
          </h1>

          <p
            className="anim-hero-item mt-5 max-w-[520px] text-[15px] leading-[1.55] text-mist sm:text-[15.5px]"
            style={{ animationDelay: "0.4s" }}
          >
            Uma camada brasileira para organizar PIX, routing, saldos e
            liquidação digital com rastreabilidade de ponta a ponta. O acesso
            inicial é controlado enquanto cada rail financeiro conclui sua
            validação operacional.
          </p>

          <div
            className="anim-hero-item mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.52s" }}
          >
            <Link
              href="/early-access"
              className="btn-cta group flex h-[46px] items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-7 text-[14.5px] font-bold"
            >
              Solicitar acesso
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/business"
              className="btn-outline-green flex h-[46px] items-center justify-center whitespace-nowrap rounded-full px-7 text-[14px] font-medium"
            >
              Ver solução empresarial
            </Link>
          </div>

          {/* Trust micro-points */}
          <ul
            className="anim-hero-item mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5"
            style={{ animationDelay: "0.64s" }}
          >
            {TRUST_ITEMS.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-1.5 text-[12.5px] font-medium text-mist"
              >
                {item.icon ? (
                  <item.icon
                    className="h-[15px] w-[15px] text-pix"
                    aria-hidden="true"
                  />
                ) : (
                  <BrazilFlag className="h-[13px] w-[17px]" />
                )}
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Device composition ── */}
        <div className="relative min-w-0">
          <HeroDeviceScene />
        </div>
      </div>
    </section>
  );
}
