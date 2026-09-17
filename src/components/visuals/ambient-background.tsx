const PARTICLES: Array<{
  left: string;
  top: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
}> = [
  { left: "6%", top: "18%", size: 2.5, color: "#20F29A", delay: "0s", duration: "5.2s" },
  { left: "12%", top: "64%", size: 2, color: "#28EBD0", delay: "1.1s", duration: "6s" },
  { left: "21%", top: "34%", size: 2, color: "#D2A34E", delay: "2.3s", duration: "5.6s" },
  { left: "31%", top: "78%", size: 2.5, color: "#20F29A", delay: "0.6s", duration: "6.4s" },
  { left: "44%", top: "12%", size: 2, color: "#28EBD0", delay: "1.8s", duration: "5s" },
  { left: "52%", top: "58%", size: 2, color: "#20F29A", delay: "2.8s", duration: "6.8s" },
  { left: "63%", top: "24%", size: 2.5, color: "#28EBD0", delay: "0.9s", duration: "5.4s" },
  { left: "71%", top: "70%", size: 2, color: "#D2A34E", delay: "1.5s", duration: "6.2s" },
  { left: "82%", top: "38%", size: 2.5, color: "#20F29A", delay: "2s", duration: "5.8s" },
  { left: "90%", top: "16%", size: 2, color: "#28EBD0", delay: "0.4s", duration: "5.2s" },
  { left: "95%", top: "60%", size: 2, color: "#20F29A", delay: "1.2s", duration: "6.6s" },
  { left: "38%", top: "42%", size: 2, color: "#2ACFE5", delay: "2.6s", duration: "7s" },
];

/**
 * Global ambient layer: gradient mesh, emerald arcs, faint grid,
 * floating particles and film-grain noise. Purely decorative.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base radial glows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 620px at 12% 22%, rgba(9,54,44,0.5) 0%, rgba(2,9,11,0) 62%)," +
            "radial-gradient(1100px 760px at 86% 14%, rgba(7,48,40,0.55) 0%, rgba(2,9,11,0) 60%)," +
            "radial-gradient(1000px 700px at 78% 88%, rgba(5,42,46,0.4) 0%, rgba(2,9,11,0) 58%)",
        }}
      />

      {/* Slow-moving mesh blob (emerald) */}
      <div
        className="absolute -left-[240px] top-[8%] h-[720px] w-[720px] rounded-full opacity-45 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(24,239,169,0.16) 0%, rgba(5,24,26,0) 68%)",
          animation: "mesh-move 26s ease-in-out infinite",
        }}
      />
      {/* Slow-moving mesh blob (cyan, right) */}
      <div
        className="absolute -right-[200px] top-[34%] h-[640px] w-[640px] rounded-full opacity-40 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(40,235,208,0.14) 0%, rgba(5,24,26,0) 66%)",
          animation: "mesh-move 32s ease-in-out 4s infinite reverse",
        }}
      />

      {/* Large emerald arc sweeping from top-center to the right */}
      <div
        className="absolute left-[22%] top-[-1450px] h-[1900px] w-[1900px] rounded-full border-t-[1.5px]"
        style={{
          borderColor: "rgba(31,242,154,0.22)",
          boxShadow:
            "0 -6px 60px -8px rgba(31,242,154,0.28), inset 0 22px 60px -18px rgba(31,242,154,0.18)",
          maskImage:
            "linear-gradient(115deg, transparent 30%, black 55%, transparent 78%)",
          WebkitMaskImage:
            "linear-gradient(115deg, transparent 30%, black 55%, transparent 78%)",
          animation: "arc-drift 24s ease-in-out infinite",
        }}
      />

      {/* Cyan arc near top-right */}
      <div
        className="absolute right-[4%] top-[-1620px] h-[2100px] w-[2100px] rounded-full border-t-[1px]"
        style={{
          borderColor: "rgba(40,235,208,0.16)",
          boxShadow: "0 -4px 46px -6px rgba(40,235,208,0.2)",
          maskImage:
            "linear-gradient(245deg, transparent 34%, black 56%, transparent 76%)",
          WebkitMaskImage:
            "linear-gradient(245deg, transparent 34%, black 56%, transparent 76%)",
          animation: "arc-drift 30s ease-in-out 2s infinite reverse",
        }}
      />

      {/* Faint network grid, fading to edges */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(64,233,200,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(64,233,200,0.5) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(1100px 640px at 62% 20%, black 0%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(1100px 640px at 62% 20%, black 0%, transparent 78%)",
        }}
      />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}

      {/* Film grain */}
      <div className="noise-overlay absolute inset-0 opacity-[0.05] mix-blend-overlay" />
    </div>
  );
}
