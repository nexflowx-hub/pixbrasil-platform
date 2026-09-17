import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

const LINKS = [
  "Sobre nós",
  "Carreiras",
  "Blog",
  "Central de Ajuda",
  "Termos de Uso",
  "Política de Privacidade",
  "Compliance",
];

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM.24 8.16h4.52V23H.24V8.16Zm7.44 0h4.33v2.03h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.43 3.01 5.43 6.93V23h-4.52v-6.5c0-1.55-.03-3.55-2.16-3.55-2.17 0-2.5 1.69-2.5 3.44V23H7.68V8.16Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.5 7.2a3 3 0 0 0-2.12-2.12C19.5 4.55 12 4.55 12 4.55s-7.5 0-9.38.53A3 3 0 0 0 .5 7.2 31.3 31.3 0 0 0 0 12c0 1.62.17 3.23.5 4.8a3 3 0 0 0 2.12 2.12c1.88.53 9.38.53 9.38.53s7.5 0 9.38-.53a3 3 0 0 0 2.12-2.12c.33-1.57.5-3.18.5-4.8s-.17-3.23-.5-4.8ZM9.6 15.6V8.4l6.27 3.6-6.27 3.6Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.4Z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "LinkedIn", icon: LinkedInIcon },
  { label: "Instagram", icon: InstagramIcon },
  { label: "YouTube", icon: YouTubeIcon },
  { label: "X", icon: XIcon },
];

/**
 * Site footer — single-row premium layout on desktop.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[rgba(54,213,180,0.18)] bg-[#020B0D]">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 xl:px-12">
        {/* Brand */}
        <Link href="/" aria-label="PiXBrasil.org — página inicial" className="shrink-0">
          <BrandLogo tagline className="text-[19px]" />
        </Link>

        {/* Links */}
        <nav aria-label="Links do rodapé">
          <ul className="flex flex-wrap items-center gap-x-0 gap-y-2 text-[12px] text-mist">
            {LINKS.map((link, i) => (
              <li key={link} className="flex items-center">
                {i > 0 && (
                  <span aria-hidden="true" className="mx-3 h-3 w-px bg-white/12" />
                )}
                <Link
                  href="#"
                  className="transition-colors duration-200 hover:text-white"
                >
                  {link}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right cluster */}
        <div className="flex flex-wrap items-center gap-5">
          <ul className="flex items-center gap-4" aria-label="Redes sociais">
            {SOCIALS.map((social) => (
              <li key={social.label}>
                <a
                  href="#"
                  aria-label={social.label}
                  className="flex h-7 w-7 items-center justify-center text-mist transition-all duration-200 hover:-translate-y-0.5 hover:text-white"
                >
                  <social.icon className="h-[15px] w-[15px]" />
                </a>
              </li>
            ))}
          </ul>

          <span
            aria-hidden="true"
            className="hidden h-[2px] w-14 rounded-full bg-gradient-to-r from-[#20F29A] via-[#28EBD0] to-[#D2A34E] lg:block"
          />

          <p className="text-[12px] font-medium text-cream">
            Brasil para o mundo.
          </p>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-mist transition-colors hover:border-pix/40 hover:text-white"
            aria-label="Selecionar idioma. Idioma atual: português do Brasil"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            PT-BR
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
