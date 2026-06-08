/**
 * Ambient "global money flow" backdrop: a slowly rotating wireframe Earth with
 * glowing capital arcs and coins traveling between locations. Purely decorative —
 * fixed, low-opacity, and pointer-events-none so it never interferes with the UI.
 */

const GOLD = "hsl(207 30% 70%)";
const CYAN = "hsl(39 28% 72%)";

// Curved capital-flow arcs across the globe (money moving place to place).
// Each path is a quadratic curve; a coin animates along it with a stagger.
const ARCS: { d: string; color: string; dur: number; delay: number }[] = [
  { d: "M 90 230 Q 250 60 410 200", color: GOLD, dur: 6.5, delay: 0 },
  { d: "M 120 330 Q 250 480 400 320", color: CYAN, dur: 7.5, delay: 1.2 },
  { d: "M 70 180 Q 250 280 430 150", color: GOLD, dur: 8, delay: 2.4 },
  { d: "M 150 110 Q 250 380 360 380", color: CYAN, dur: 7, delay: 0.8 },
  { d: "M 110 280 Q 320 200 420 280", color: GOLD, dur: 6.8, delay: 3.1 },
  { d: "M 80 150 Q 200 420 370 330", color: CYAN, dur: 8.5, delay: 1.8 },
];

// Latitude rings (parallels) — ellipses flattened toward the poles.
const PARALLELS = [-90, -55, -25, 0, 25, 55, 90];

export function EarthBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Deep-space wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 65% 55%, hsl(207 30% 70% / 0.05) 0%, transparent 55%), radial-gradient(ellipse at 30% 80%, hsl(39 28% 72% / 0.04) 0%, transparent 50%)",
        }}
      />

      {/* The globe, anchored bottom-right, oversized and faint */}
      <div className="absolute -bottom-[18%] -right-[8%] w-[min(70vw,640px)] aspect-square opacity-[0.5]">
        <svg viewBox="0 0 500 500" className="h-full w-full">
          <defs>
            <radialGradient id="earth-core" cx="42%" cy="38%" r="68%">
              <stop offset="0%" stopColor="hsl(207 30% 70% / 0.16)" />
              <stop offset="55%" stopColor="hsl(200 60% 30% / 0.10)" />
              <stop offset="100%" stopColor="hsl(0 0% 4% / 0)" />
            </radialGradient>
            <radialGradient id="earth-rim" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="hsl(39 28% 72% / 0)" />
              <stop offset="97%" stopColor="hsl(39 28% 72% / 0.35)" />
              <stop offset="100%" stopColor="hsl(39 28% 72% / 0)" />
            </radialGradient>
          </defs>

          {/* Atmosphere + sphere fill */}
          <circle cx="250" cy="250" r="200" fill="url(#earth-core)" />
          <circle cx="250" cy="250" r="200" fill="url(#earth-rim)" />
          <circle
            cx="250"
            cy="250"
            r="200"
            fill="none"
            stroke="hsl(39 28% 72% / 0.30)"
            strokeWidth="1"
          />

          {/* Rotating meridian/parallel wireframe */}
          <g className="earth-spin" style={{ transformOrigin: "250px 250px" }}>
            {/* Meridians (longitude) — ellipses with shrinking width */}
            {[200, 150, 95, 35].map((rx) => (
              <ellipse
                key={`m${rx}`}
                cx="250"
                cy="250"
                rx={rx}
                ry="200"
                fill="none"
                stroke="hsl(207 30% 70% / 0.22)"
                strokeWidth="0.8"
              />
            ))}
            {/* Parallels (latitude) */}
            {PARALLELS.map((lat) => {
              const ry = 200 * Math.cos((lat * Math.PI) / 180);
              const cy = 250 + 200 * Math.sin((lat * Math.PI) / 180) * 0;
              return (
                <ellipse
                  key={`p${lat}`}
                  cx="250"
                  cy={cy + lat * 1.9}
                  rx={200 * Math.cos((lat * Math.PI) / 180)}
                  ry={Math.max(2, ry * 0.16)}
                  fill="none"
                  stroke="hsl(39 28% 72% / 0.16)"
                  strokeWidth="0.8"
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Capital-flow arcs + traveling coins (overlaid, centered on the globe) */}
      <div className="absolute -bottom-[18%] -right-[8%] w-[min(70vw,640px)] aspect-square opacity-[0.6]">
        <svg viewBox="0 0 500 500" className="h-full w-full">
          {ARCS.map((a, i) => (
            <g key={i}>
              <path
                d={a.d}
                fill="none"
                stroke={a.color}
                strokeOpacity={0.22}
                strokeWidth="1"
                strokeDasharray="3 7"
                className="flow-dash"
                style={{ animationDelay: `${a.delay}s` }}
              />
              {/* Glowing coin riding the arc */}
              <circle r="3.4" fill={a.color} className="coin-glow">
                <animateMotion
                  dur={`${a.dur}s`}
                  begin={`${a.delay}s`}
                  repeatCount="indefinite"
                  path={a.d}
                  keyPoints="0;1"
                  keyTimes="0;1"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1"
                />
              </circle>
              {/* Origin + destination nodes */}
              <circle r="2" fill={a.color} fillOpacity="0.5">
                <animateMotion dur="0.01s" fill="freeze" path={a.d} keyPoints="0;0" keyTimes="0;1" />
              </circle>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
