import { cn } from "@/lib/utils";

/**
 * Original mech / robot-head emblem for the Alpha Convergence Coordinator.
 *
 * This is a bespoke geometric design — NOT the Transformers / Autobots mark or
 * any other trademarked logo. It evokes a coordinating "command" robot: a
 * faceted head, a single scanning visor and an upward convergence chevron that
 * nods to the bots moving in formation.
 */
export function AlphaBotEmblem({
  className,
  active = false,
}: {
  className?: string;
  /** When true the visor + core pulse with the live "scanning" animation. */
  active?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-10 w-10", className)}
      role="img"
      aria-label="Alpha Coordinator emblem"
      fill="none"
    >
      <defs>
        <linearGradient id="alpha-emblem-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(43 90% 62%)" />
          <stop offset="100%" stopColor="hsl(38 74% 44%)" />
        </linearGradient>
        <radialGradient id="alpha-core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(48 100% 75%)" />
          <stop offset="100%" stopColor="hsl(43 90% 50%)" />
        </radialGradient>
      </defs>

      {/* Convergence chevrons — the fleet pointing one way, in formation. */}
      <path
        d="M32 3 L48 13 L42 13 L32 7 L22 13 L16 13 Z"
        fill="url(#alpha-emblem-grad)"
        opacity={0.85}
      />

      {/* Faceted robot head / helmet. */}
      <path
        d="M16 17 L48 17 L52 27 L46 51 L32 60 L18 51 L12 27 Z"
        fill="hsl(0 0% 8%)"
        stroke="url(#alpha-emblem-grad)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />

      {/* Cheek plates. */}
      <path d="M18 30 L24 33 L22 45 L18 42 Z" fill="url(#alpha-emblem-grad)" opacity={0.55} />
      <path d="M46 30 L40 33 L42 45 L46 42 Z" fill="url(#alpha-emblem-grad)" opacity={0.55} />

      {/* Scanning visor. */}
      <rect
        x={20}
        y={28}
        width={24}
        height={7}
        rx={2}
        fill="url(#alpha-emblem-grad)"
        className={active ? "alpha-emblem-visor" : undefined}
      />
      {/* Visor split (two eyes). */}
      <rect x={30.4} y={28} width={3.2} height={7} fill="hsl(0 0% 8%)" />

      {/* Jaw / mouth grille. */}
      <path d="M26 41 L38 41 L35 48 L29 48 Z" fill="hsl(0 0% 8%)" stroke="url(#alpha-emblem-grad)" strokeWidth={1.4} strokeLinejoin="round" />
      <line x1={29} y1={43.5} x2={35} y2={43.5} stroke="url(#alpha-emblem-grad)" strokeWidth={1} opacity={0.7} />
      <line x1={29.6} y1={45.6} x2={34.4} y2={45.6} stroke="url(#alpha-emblem-grad)" strokeWidth={1} opacity={0.5} />

      {/* Forehead core. */}
      <circle
        cx={32}
        cy={23}
        r={2.6}
        fill="url(#alpha-core-grad)"
        className={active ? "alpha-emblem-core" : undefined}
      />
    </svg>
  );
}
