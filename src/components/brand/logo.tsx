import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  tagline?: boolean;
  taglineClassName?: string;
};

/**
 * PiXBrasil.org wordmark — the "X" carries the emerald→cyan brand gradient.
 */
export function BrandLogo({
  className,
  tagline = false,
  taglineClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="font-bold tracking-[-0.02em] text-cream whitespace-nowrap">
        Pi
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#19F5A4] to-[#28EBD0]">
          X
        </span>
        Brasil
        <span className="text-mist/90">.org</span>
      </span>
      {tagline ? (
        <span
          className={cn(
            "mt-[3px] text-[8px] font-semibold uppercase tracking-[0.24em] text-[#8BA5A0]",
            taglineClassName
          )}
        >
          Seu dinheiro sem fronteiras
        </span>
      ) : null}
    </span>
  );
}

/**
 * Small inline Brazilian flag (rounded, simplified).
 */
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
      <path
        d="M8.2 7.2c1.9-.5 4.2-.3 5.7.8"
        stroke="#F8FAF9"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
