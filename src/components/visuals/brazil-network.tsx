/**
 * Stylized Brazil rendered as a financial digital network:
 * dot-matrix cartography + golden city nodes + flowing connections.
 * Pure SVG, server-rendered, CSS-animated (respects reduced motion).
 */

const BRAZIL_PATH =
  "M222 12 L231 30 L238 46 L241 60 L254 68 L268 64 L277 67 L288 80 L298 81 L323 85 L345 91 L355 94 L386 112 L388 115 L391 126 L392 129 L390 147 L381 163 L363 180 L355 189 L343 214 L349 238 L334 268 L320 290 L307 291 L295 296 L276 301 L254 316 L254 337 L219 382 L206 400 L164 365 L183 345 L194 317 L196 300 L161 281 L158 259 L137 222 L86 173 L1 133 L41 99 L45 66 L67 34 L110 15 L133 4 L151 38 L182 35 L194 32 Z";

type Node = { x: number; y: number; r: number; delay: string };

const GOLD_NODES: Node[] = [
  { x: 140, y: 88, r: 2.6, delay: "0s" },      // Manaus
  { x: 253, y: 70, r: 2.4, delay: "1.2s" },    // Belém
  { x: 354, y: 95, r: 2.5, delay: "2.1s" },    // Fortaleza
  { x: 384, y: 140, r: 2.3, delay: "0.7s" },   // Recife
  { x: 350, y: 192, r: 2.5, delay: "1.7s" },   // Salvador
  { x: 261, y: 217, r: 2.8, delay: "0.4s" },   // Brasília
  { x: 301, y: 259, r: 2.2, delay: "2.6s" },   // Belo Horizonte
  { x: 304, y: 287, r: 2.7, delay: "1.4s" },   // Rio de Janeiro
  { x: 274, y: 296, r: 2.9, delay: "0.9s" },   // São Paulo
  { x: 247, y: 314, r: 2.1, delay: "2.9s" },   // Curitiba
  { x: 228, y: 361, r: 2.2, delay: "1.9s" },   // Porto Alegre
  { x: 180, y: 215, r: 2.3, delay: "3.3s" },   // Cuiabá
];

const MINOR_NODES = [
  { x: 298, y: 82 },  // São Luís
  { x: 388, y: 113 }, // Natal
  { x: 334, y: 265 }, // Vitória
  { x: 315, y: 106 }, // Teresina
  { x: 210, y: 120 }, // Porto Velho region
  { x: 100, y: 120 }, // Acre
  { x: 290, y: 175 }, // Tocantins
  { x: 225, y: 250 }, // Campo Grande
];

const LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 5], [5, 11],
  [11, 0], [5, 6], [6, 7], [7, 8], [8, 6], [8, 9], [9, 10],
  [8, 11], [5, 8], [5, 3], [8, 4],
];

const WORLD_ARCS = [
  { d: "M384 140 Q 424 112 462 84", dot: [462, 84] },
  { d: "M354 95 Q 402 66 448 38", dot: [448, 38] },
  { d: "M274 296 Q 350 342 440 356", dot: [440, 356] },
  { d: "M140 88 Q 96 48 62 20", dot: [62, 20] },
];

export function BrazilNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 440"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <pattern
          id="bz-dots"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="4" cy="4" r="1.2" fill="#1AE8BA" opacity="0.72" />
        </pattern>
        <radialGradient id="bz-halo" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="rgba(20,210,150,0.22)" />
          <stop offset="60%" stopColor="rgba(20,210,150,0.07)" />
          <stop offset="100%" stopColor="rgba(20,210,150,0)" />
        </radialGradient>
      </defs>

      {/* Ambient halo behind the country */}
      <ellipse cx="230" cy="210" rx="235" ry="225" fill="url(#bz-halo)" />

      {/* Dot-matrix landmass */}
      <path
        d={BRAZIL_PATH}
        fill="url(#bz-dots)"
        stroke="rgba(64,233,200,0.45)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />

      {/* Connection mesh */}
      <g stroke="rgba(40,235,208,0.30)" strokeWidth="0.8">
        {LINKS.map(([a, b], i) => (
          <line
            key={i}
            x1={GOLD_NODES[a].x}
            y1={GOLD_NODES[a].y}
            x2={GOLD_NODES[b].x}
            y2={GOLD_NODES[b].y}
            className="dash-flow"
            style={{ animationDelay: `${(i % 5) * 0.9}s` }}
          />
        ))}
      </g>

      {/* Orbital arcs to the world */}
      <g stroke="rgba(231,197,105,0.4)" strokeWidth="0.9">
        {WORLD_ARCS.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            className="dash-flow"
            style={{ animationDelay: `${i * 1.3}s` }}
          />
        ))}
      </g>
      {WORLD_ARCS.map((arc, i) => (
        <circle
          key={i}
          cx={arc.dot[0]}
          cy={arc.dot[1]}
          r="1.8"
          fill="#E7C569"
          className="twinkle"
          style={{ animationDelay: `${i * 1.1}s` }}
        />
      ))}

      {/* Minor green nodes */}
      {MINOR_NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r="1.15"
          fill="#20F29A"
          opacity="0.75"
          className="twinkle"
          style={{ animationDelay: `${i * 0.7}s` }}
        />
      ))}

      {/* Golden city nodes */}
      {GOLD_NODES.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r * 2.6}
            fill="rgba(231,197,105,0.12)"
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="#E7C569"
            className="node-pulse"
            style={{ animationDelay: n.delay }}
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r * 1.9}
            fill="none"
            stroke="rgba(231,197,105,0.35)"
            strokeWidth="0.6"
          />
        </g>
      ))}
    </svg>
  );
}
