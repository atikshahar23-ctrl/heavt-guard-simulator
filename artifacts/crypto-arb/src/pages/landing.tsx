import { useMemo } from "react";
import { useLocation } from "wouter";

const logoUrl = `${import.meta.env.BASE_URL}brand-logo.png`;

type Star = { top: number; left: number; size: number; opacity: number };

function useStarfield(count: number): Star[] {
  return useMemo(() => {
    let seed = 20260609;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    return Array.from({ length: count }, () => ({
      top: rand() * 100,
      left: rand() * 100,
      size: rand() * 1.5 + 0.5,
      opacity: rand() * 0.4 + 0.12,
    }));
  }, [count]);
}

const FEATURES: { icon: string; title: string; desc: string }[] = [
  {
    icon: "◎",
    title: "סורק שוק חי",
    desc: "קריפטו, מניות ושווקי תחזיות במקום אחד — אותות סקאלפ ומומנטום בזמן אמת.",
  },
  {
    icon: "▦",
    title: "סימולטור מסחר",
    desc: "תיק תרגול עם מספר ארנקים ועקומת הון. כסף וירטואלי בלבד, ללא סיכון.",
  },
  {
    icon: "⬡",
    title: "מרכז פיקוד בוטים",
    desc: "צוות בוטים לתרגול אוטומטי — סקאלפ, פריצות וצבירה, עם בקרת עוצמה אחת.",
  },
  {
    icon: "✦",
    title: "שולחן מחקר",
    desc: "חיפוש חופשי של מניות וקריפטו עם מחירים חיים וקישורי מחקר חיצוניים.",
  },
  {
    icon: "◈",
    title: "עוזר JARVIS",
    desc: "מוח חכם מבוסס כללים, דו-לשוני (עברית/אנגלית) — ללא בינה מלאכותית בתשלום.",
  },
  {
    icon: "◆",
    title: "שווקי תחזיות",
    desc: "הצלבת נתוני בינאנס מול סנטימנט הקהל ב-Polymarket לזיהוי פערים.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const stars = useStarfield(70);

  return (
    <div
      dir="rtl"
      className="entrance-marble-bg relative min-h-[100dvh] w-full overflow-hidden text-white"
    >
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-[#9fb4c7] opacity-[0.05] blur-[120px]" />
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
            }}
          />
        ))}
        <div className="entrance-vignette absolute inset-0" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="HEAVY GUARD"
            className="h-9 w-9 object-contain"
            draggable={false}
          />
          <span
            className="text-sm font-semibold tracking-[0.25em] text-[#e6edf4]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            HEAVY GUARD
          </span>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/sign-in")}
          className="rounded-lg border border-[#9fb4c7]/25 px-4 py-2 text-xs font-medium tracking-wide text-[#cfe0ee] transition-colors hover:border-[#9fb4c7]/50 hover:bg-white/[0.04]"
        >
          כניסת חברים
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-5 pb-12 pt-10 text-center md:pt-16">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#9fb4c7]/70" />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.45em] text-[#9fb4c7]/80">
            Private Members Club
          </span>
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#9fb4c7]/70" />
        </div>

        <h1
          className="text-4xl font-semibold leading-tight tracking-[0.04em] text-[#e6edf4] md:text-6xl"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          מודיעין שוק.
          <br />
          ברמה אחרת.
        </h1>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#cdbfa4]/30 bg-[#cdbfa4]/[0.04] px-4 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.35em] text-[#cdbfa4]/85">
          <span>Obsidian Tier</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#cdbfa4]/80" />
        </div>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#dbe3ec] md:text-lg">
          מצליבים נתוני קריפטו, מניות ושווקי תחזיות לכדי תמונת שוק אחת חדה —
          ומתרגלים מסחר בסביבת הדמיה מלאה, ללא סיכון.
        </p>

        <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setLocation("/sign-up")}
            className="w-full rounded-lg bg-gradient-to-r from-[#c9d6e2] via-[#9fb4c7] to-[#6f8294] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#0b0f14] shadow-[0_8px_24px_-8px_rgba(159,180,199,0.5)] transition-[filter] hover:brightness-110 sm:w-auto"
          >
            בקשת חברות
          </button>
          <button
            type="button"
            onClick={() => setLocation("/sign-in")}
            className="w-full rounded-lg border border-[#9fb4c7]/25 px-8 py-3.5 text-sm font-medium tracking-wide text-[#cfe0ee] transition-colors hover:border-[#9fb4c7]/50 hover:bg-white/[0.04] sm:w-auto"
          >
            כניסת חברים
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[#9fb4c7]/15 bg-white/[0.02] p-5 text-right transition-colors hover:border-[#9fb4c7]/30 hover:bg-white/[0.035]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#9fb4c7]/10 text-xl text-[#9fb4c7]">
                {f.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-[#e6edf4]">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer + footer */}
      <footer className="relative z-10 border-t border-[#9fb4c7]/10 px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
          <p className="max-w-2xl text-xs leading-relaxed text-white/45">
            הדמיה חינוכית בלבד. כל הנתונים והאותות מיועדים ללימוד ולתרגול — אין
            כסף אמיתי, אין הבטחות לרווח ואין ייעוץ פיננסי. ביצועי עבר אינם מעידים
            על העתיד.
          </p>
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.4em] text-[#9fb4c7]/35">
            Heavy Guard · Est. MMXXVI · דמו לימודי בלבד
          </p>
        </div>
      </footer>
    </div>
  );
}
