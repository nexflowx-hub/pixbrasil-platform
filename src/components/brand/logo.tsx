import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  tagline?: boolean;
  taglineClassName?: string;
  mark?: boolean;
};

/**
 * Original PiXBrasil brand mark.
 * Two continuous rails cross and reconnect, representing entry, settlement and exit.
 * It deliberately avoids reproducing the official PIX symbol.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn("h-8 w-8 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pb-mark-g" x1="7" y1="6" x2="34" y2="34">
          <stop stopColor="#25FFA6" />
          <stop offset="0.55" stopColor="#20F29A" />
          <stop offset="1" stopColor="#28EBD0" />
        </linearGradient>
        <radialGradient id="pb-mark-bg" cx="30%" cy="20%" r="90%">
          <stop stopColor="#0B2B27" />
          <stop offset="1" stopColor="#02090B" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#pb-mark-bg)" />
      <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" stroke="#31F4BB" strokeOpacity=".34" />
      <path
        d="M8 12.5c6.2 0 6.5 15 12 15s5.8-15 12-15"
        stroke="url(#pb-mark-g)"
        strokeWidth="3.3"
        strokeLinecap="round"
      />
      <path
        d="M8 27.5c6.2 0 6.5-15 12-15s5.8 15 12 15"
        stroke="url(#pb-mark-g)"
        strokeWidth="3.3"
        strokeLinecap="round"
        opacity=".88"
      />
      <circle cx="8" cy="12.5" r="1.7" fill="#D2A34E" />
      <circle cx="32" cy="27.5" r="1.7" fill="#28EBD0" />
      <circle cx="20" cy="20" r="1.9" fill="#F4F8F7" />
    </svg>
  );
}

/**
 * PiXBrasil.org wordmark + optional original brand mark.
 */
export function BrandLogo({
  className,
  tagline = false,
  taglineClassName,
  mark = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark ? <BrandMark className="h-[1.65em] w-[1.65em]" /> : null}
      <span className="inline-flex min-w-0 flex-col leading-none">
        <span className="whitespace-nowrap font-bold tracking-[-0.035em] text-cream">
          Pi
          <span className="bg-gradient-to-r from-[#19F5A4] to-[#28EBD0] bg-clip-text text-transparent">
            X
          </span>
          Brasil
          <span className="text-mist/90">.org</span>
        </span>
        {tagline ? (
          <span
            className={cn(
              "mt-[3px] whitespace-nowrap text-[7.5px] font-semibold uppercase tracking-[0.21em] text-[#8BA5A0]",
              taglineClassName
            )}
          >
            Seu dinheiro sem fronteiras
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function BrazilFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 16"
      className={cn("h-[13px] w-[18px] rounded-[2px] shadow-sm", className)}
      aria-hidden="true"
    >
      <rect width="22" height="16" rx="2" fill="#0E9C4E" />
      <path d="M11 2.4 19.6 8 11 13.6 2.4 8Z" fill="#FEDD00" />
      <circle cx="11" cy="8" r="3.1" fill="#01277D" />
      <path d="M8.2 7.2c1.9-.5 4.2-.3 5.7.8" stroke="#F8FAF9" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}
