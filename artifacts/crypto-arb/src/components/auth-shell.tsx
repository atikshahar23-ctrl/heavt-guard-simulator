import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

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
    // Deterministic-ish pseudo-random so the platinum dust doesn't
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
      opacity: rand() * 0.45 + 0.15,
    }));
  }, [count]);
}

const logoUrl = `${import.meta.env.BASE_URL}brand-logo.png`;

function Medallion() {
  return (
    <div className="auth-float relative flex h-56 w-56 items-center justify-center md:h-64 md:w-64">
      {/* Platinum aura — visible through the cut-out emblem */}
      <div className="auth-medallion-glow absolute h-44 w-44 rounded-full md:h-52 md:w-52" />
      {/* Two counter-rotating hairline halos orbiting the crest */}
      <div className="auth-halo absolute inset-0 rounded-full" />
      <div className="auth-halo-rev absolute inset-[10%] rounded-full" />
      {/* The brand emblem — colours preserved exactly as the source artwork */}
      <img
        src={logoUrl}
        alt="HEAVY GUARD"
        className="relative h-40 w-40 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)] md:h-44 md:w-44"
        draggable={false}
      />
    </div>
  );
}

function LuxuryFrame() {
  // Thin passe-partout border with platinum corner brackets — couture detailing.
  const corner = "absolute h-7 w-7 border-[#9fb4c7]/40";
  return (
    <div className="pointer-events-none absolute inset-3 md:inset-5">
      <div className="absolute inset-0 rounded-[2px] border border-[#9fb4c7]/10" />
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

function Grille() {
  // Faint vertical fluting watermark behind the brand lockup.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 h-[clamp(220px,40vh,420px)] w-[clamp(140px,18vw,220px)] -translate-x-1/2 -translate-y-[58%] opacity-[0.06]"
      style={{
        background:
          "repeating-linear-gradient(90deg, #9fb4c7 0px, #9fb4c7 1px, transparent 1px, transparent 11px)",
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
  const stars = useStarfield(64);
  const { lang, dir } = useLanguage();

  return (
    <div
      dir={dir}
      className="auth-shell auth-sweep entrance-marble-bg relative flex min-h-[100dvh] w-full flex-col overflow-hidden text-white lg:flex-row"
    >
      {/* Cinematic backdrop spanning the whole viewport */}
      <div className="pointer-events-none absolute inset-0">
        {/* Cool top spotlight */}
        <div className="entrance-spotlight absolute inset-0" />
        {/* Platinum aura */}
        <div className="absolute left-1/2 top-[-18%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-[#9fb4c7] opacity-[0.05] blur-[120px]" />
        {/* Platinum dust */}
        {stars.map((s, i) => (
          <span
            key={i}
            className="auth-star absolute rounded-full bg-[#dbe7f2]"
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
        <div className="entrance-vignette absolute inset-0" />
      </div>

      {/* Couture passe-partout frame */}
      <LuxuryFrame />

      {/* Top private-client tag (desktop) */}
      <div className="pointer-events-none absolute inset-x-0 top-8 z-10 hidden items-center justify-center gap-3 font-mono text-[0.55rem] uppercase tracking-[0.4em] text-[#9fb4c7]/55 lg:flex">
        <span>{t("auth.privateClub", lang)}</span>
        <span className="h-[3px] w-[3px] rounded-full bg-[#cdbfa4]/70" />
        <span>Private Client</span>
      </div>

      {/* Bottom maison signature (desktop) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-10 hidden items-center justify-center gap-4 font-mono text-[0.55rem] uppercase tracking-[0.4em] text-[#9fb4c7]/35 lg:flex">
        <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#9fb4c7]/30" />
        Heavy Guard · Est. MMXXVI · {t("landing.demoOnly", lang)}
        <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#9fb4c7]/30" />
      </div>

      {/* Brand panel */}
      <section className="auth-rise relative flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-16 text-center lg:px-12 lg:pb-12 lg:pt-12">
        <Grille />
        <div className="relative flex flex-col items-center">
          <Medallion />

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#9fb4c7]/70" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.45em] text-[#9fb4c7]/80">
              {kicker}
            </span>
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#9fb4c7]/70" />
          </div>

          <h1
            className="auth-shine mt-5 text-4xl font-semibold tracking-[0.18em] md:text-6xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            HEAVY&nbsp;GUARD
          </h1>

          {/* Member tier chip */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#cdbfa4]/30 bg-[#cdbfa4]/[0.04] px-4 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.35em] text-[#cdbfa4]/85">
            <span>Obsidian Tier</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#cdbfa4]/80" />
          </div>

          <p
            className="mt-6 max-w-md text-lg leading-relaxed text-[#dbe3ec] md:text-xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {title}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            {subtitle}
          </p>

          <div className="mt-8 flex items-center gap-3 font-mono text-[0.58rem] uppercase tracking-[0.4em] text-white/35">
            <span>Members Only</span>
            <span className="text-[#9fb4c7]/60">·</span>
            <span>By Invitation</span>
          </div>
        </div>
      </section>

      {/* Vertical divider on desktop */}
      <div className="relative hidden lg:flex lg:items-center">
        <span className="h-[58%] w-px bg-gradient-to-b from-transparent via-[#9fb4c7]/30 to-transparent" />
      </div>

      {/* Form panel */}
      <section className="auth-rise-late relative flex flex-1 items-center justify-center px-5 pb-14 pt-2 lg:px-12 lg:py-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </div>
  );
}
