"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandLogo, BrazilFlag } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Para Você",
    href: "#para-voce",
    dropdown: [
      { label: "Conta pessoal", href: "/personal" },
      { label: "Carteira multiativos", href: "/personal" },
      { label: "Saques via PIX ou cripto", href: "/how-it-works" },
    ],
  },
  {
    label: "Empresas",
    href: "#empresas",
    dropdown: [
      { label: "Conta empresarial", href: "/business" },
      { label: "API PIX", href: "/business" },
      { label: "Links de pagamento", href: "/business" },
    ],
  },
  { label: "Como Funciona", href: "/how-it-works" },
  { label: "Tarifas", href: "/pricing" },
  { label: "Segurança", href: "#seguranca" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[rgba(51,207,177,0.16)] bg-[rgba(1,10,12,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1640px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        {/* Left — brand */}
        <Link
          href="/"
          aria-label="PiXBrasil.org — página inicial"
          className="shrink-0"
        >
          <BrandLogo tagline className="text-[19px] sm:text-[20px]" taglineClassName="hidden sm:block" />
        </Link>

        {/* Center — navigation */}
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-5 xl:flex xl:gap-7"
        >
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="group relative">
              <Link
                href={item.href}
                className="flex items-center gap-1 whitespace-nowrap text-[13.5px] font-medium text-mist transition-colors duration-200 hover:text-white"
              >
                {item.label}
                {"dropdown" in item && item.dropdown ? (
                  <ChevronDown
                    className="h-3.5 w-3.5 text-dim transition-transform duration-200 group-hover:rotate-180"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
              {"dropdown" in item && item.dropdown ? (
                <div className="invisible absolute left-0 top-full z-50 w-60 translate-y-2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="glass-panel rounded-xl p-2">
                    {item.dropdown.map((sub) => (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        className="block rounded-lg px-3 py-2 text-[13px] text-mist transition-colors hover:bg-pix/10 hover:text-white"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        {/* Right — actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="hidden h-9 items-center whitespace-nowrap rounded-full border border-white/15 px-5 text-[13px] font-medium text-cream transition-all duration-200 hover:border-pix/50 hover:bg-pix/10 sm:flex"
          >
            Entrar
          </Link>

          <Link
            href="/early-access"
            className="btn-cta hidden h-9 items-center whitespace-nowrap rounded-full px-5 text-[13px] font-semibold sm:flex"
          >
            Criar conta
          </Link>

          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-white/12 xl:block"
          />

          <button
            type="button"
            aria-label="Idioma: português do Brasil"
            className="hidden items-center gap-2 rounded-full px-1 py-1 transition-colors hover:bg-white/5 xl:flex"
          >
            <BrazilFlag />
            <span className="text-[12.5px] font-medium text-cream">BR</span>
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-cream transition-colors hover:bg-white/5 xl:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-x-0 top-16 z-40 origin-top border-b border-[rgba(51,207,177,0.16)] bg-[rgba(1,10,12,0.96)] backdrop-blur-2xl transition-all duration-300 xl:hidden",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-3 opacity-0"
        )}
      >
        <nav
          aria-label="Navegação móvel"
          className="mx-auto flex max-w-[1640px] flex-col gap-1 px-6 py-5"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={close}
              className="rounded-xl px-4 py-3 text-[15px] font-medium text-cream transition-colors hover:bg-pix/10"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={close}
              className="btn-outline-green flex h-11 items-center justify-center rounded-full text-[14px] font-medium"
            >
              Entrar
            </Link>
            <Link
              href="/early-access"
              onClick={close}
              className="btn-cta flex h-11 items-center justify-center rounded-full text-[14px] font-semibold"
            >
              Criar conta
            </Link>
          </div>
          <div className="mt-5 flex items-center gap-2 px-1">
            <BrazilFlag />
            <span className="text-[12.5px] font-medium text-mist">PT-BR</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
