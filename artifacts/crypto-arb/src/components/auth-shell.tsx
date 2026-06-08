import { useMemo, type ReactNode } from "react";

type Star = {
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

function useStarfield(count: number): Star[] {
  return useMemo(() => {
    // Deterministic-ish pseudo-random so the starlight headliner doesn't
    // re-shuffle on every render but still feels organic.
    let seed = 20260608;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    return Array.from({ length: count }, () => ({
      top: rand() * 100,
      left: rand() * 100,
      size: rand() * 1.6 + 0.6,
      delay: rand() * 6,
      duration: rand() * 4 + 3,
      opacity: rand() * 0.5 + 0.25,
    }));
  }, [count]);
}

const logoUrl = `${import.meta.env.BASE_URL}brand-logo.png`;

function Medallion() {
  return (
    <div className="auth-float relative flex h-56 w-56 items-center justify-center md:h-64 md:w-64">
      {/* Pulsing gold aura — now visible through the cut-out emblem */}
      <div className="auth-medallion-glow absolute h-44 w-44 rounded-full md:h-52 md:w-52" />
      {/* Two counter-rotating hairline halos orbiting the crest */}
      <div className="auth-halo absolute inset-0 rounded-full" />
      <div className="auth-halo-rev absolute inset-[10%] rounded-full" />
      {/* The brand emblem — transparent cut-out, shown whole and centered */}
      <img
        src={logoUrl}
        alt="HEAVY GUARD"
        className="relative h-40 w-40 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.75)] md:h-44 md:w-44"
        draggable={false}
      />
    </div>
  );
}

function LuxuryFrame() {
  // Thin passe-partout border with gold corner brackets — couture detailing.
  const corner = "absolute h-6 w-6 border-[#cdab68]/45";
  return (
    <div className="pointer-events-none absolute inset-3 md:inset-5">
      <div className="absolute inset-0 rounded-[2px] border border-[#cdab68]/12" />
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

function Grille() {
  // Faint Pantheon-style vertical fluting watermark behind the brand lockup.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 h-[clamp(220px,40vh,420px)] w-[clamp(140px,18vw,220px)] -translate-x-1/2 -translate-y-[58%] opacity-[0.07]"
      style={{
        background:
          "repeating-linear-gradient(90deg, #cdab68 0px, #cdab68 1px, transparent 1px, transparent 11px)",
        maskImage:
          "radial-gradient(ellipse at center, black 35%, transparent 78%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 35%, transparent 78%)",
      }}
    />
  );
}

export function AuthShell({
  children,
  kicker,
  title,
  subtitle,
}: {
  children: ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
}) {
  const stars = useStarfield(70);

  return (
    <div
      dir="rtl"
      className="auth-shell auth-sweep relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#050505] text-white lg:flex-row"
    >
      {/* Cinematic backdrop spanning the whole viewport */}
      <div className="pointer-events-none absolute inset-0">
        {/* Deep base wash */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,#1a1408_0%,#0a0a0a_38%,#040404_100%)]" />
        {/* Champagne aura */}
        <div className="absolute left-1/2 top-[-18%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-[#caa867] opacity-[0.06] blur-[120px]" />
        {/* Starlight headliner */}
        {stars.map((s, i) => (
          <span
            key={i}
            className="auth-star absolute rounded-full bg-[#f6e8c2]"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
        {/* Cinematic vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* Couture passe-partout frame */}
      <LuxuryFrame />

      {/* Bottom maison signature (desktop) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-10 hidden items-center justify-center gap-4 font-mono text-[0.55rem] uppercase tracking-[0.4em] text-[#cdab68]/40 lg:flex">
        <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#cdab68]/30" />
        Heavy Guard · Est. MMXXVI
        <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#cdab68]/30" />
      </div>

      {/* Brand panel */}
      <section className="auth-rise relative flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-12 text-center lg:px-12 lg:pb-12 lg:pt-12">
        <Grille />
        <div className="relative flex flex-col items-center">
          <Medallion />

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#cdab68]/70" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.45em] text-[#cdab68]/80">
              {kicker}
            </span>
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#cdab68]/70" />
          </div>

          <h1
            className="auth-shine mt-5 font-serif text-4xl font-bold tracking-[0.18em] md:text-6xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            HEAVY&nbsp;GUARD
          </h1>

          <p className="mt-5 max-w-md font-serif text-lg leading-relaxed text-[#e8dcc4] md:text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            {title}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            {subtitle}
          </p>

          <div className="mt-8 flex items-center gap-3 font-mono text-[0.58rem] uppercase tracking-[0.4em] text-white/35">
            <span>Members Only</span>
            <span className="text-[#cdab68]/60">·</span>
            <span>By Invitation</span>
          </div>
        </div>
      </section>

      {/* Vertical divider on desktop */}
      <div className="relative hidden lg:flex lg:items-center">
        <span className="h-[58%] w-px bg-gradient-to-b from-transparent via-[#cdab68]/30 to-transparent" />
      </div>

      {/* Form panel */}
      <section className="auth-rise-late relative flex flex-1 items-center justify-center px-5 pb-14 pt-2 lg:px-12 lg:py-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </div>
  );
}
