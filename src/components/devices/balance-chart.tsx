/**
 * Small emerald area chart used on the dashboard balance card.
 * Server-rendered SVG with a soft gradient fill.
 */
export function BalanceChart({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 56"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,229,160,0.38)" />
          <stop offset="100%" stopColor="rgba(34,229,160,0)" />
        </linearGradient>
      </defs>
      <path
        d="M0 46 C 18 42, 30 47, 46 39 C 62 31, 74 22, 92 27 C 110 32, 122 15, 142 18 C 162 21, 174 9, 196 11 C 208 12, 214 8, 220 6 L 220 56 L 0 56 Z"
        fill="url(#chart-fill)"
      />
      <path
        d="M0 46 C 18 42, 30 47, 46 39 C 62 31, 74 22, 92 27 C 110 32, 122 15, 142 18 C 162 21, 174 9, 196 11 C 208 12, 214 8, 220 6"
        stroke="#22E5A0"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="196" cy="11" r="2.4" fill="#25FFA6" />
      <circle
        cx="196"
        cy="11"
        r="4.6"
        fill="none"
        stroke="rgba(37,255,166,0.4)"
        strokeWidth="1"
      />
    </svg>
  );
}
