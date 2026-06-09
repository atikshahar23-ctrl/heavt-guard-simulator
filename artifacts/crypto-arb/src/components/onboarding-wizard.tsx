import { useState } from "react";
import { STARTING_BALANCE } from "@/contexts/portfolio-context";

export type OnboardingFocus = "crypto" | "stocks" | "all";

const balanceLabel = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(STARTING_BALANCE);

const FOCUS_OPTIONS: {
  id: OnboardingFocus;
  title: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: "crypto",
    title: "קריפטו",
    desc: "ביטקוין, מטבעות מובילים, סקאלפ ומומנטום בזמן אמת.",
    icon: "₿",
  },
  {
    id: "stocks",
    title: "מניות",
    desc: "מניות מובילות, כסף חכם וכותרות שוק ההון.",
    icon: "📈",
  },
  {
    id: "all",
    title: "הכול",
    desc: "תמונת שוק מלאה — קריפטו, מניות ושווקי תחזיות יחד.",
    icon: "✦",
  },
];

const TOTAL_STEPS = 3;

export function OnboardingWizard({
  onComplete,
}: {
  onComplete: (focus: OnboardingFocus) => void;
}) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<OnboardingFocus>("all");

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-background/95 px-5 py-10 backdrop-blur-sm"
    >
      {/* Gold ambient aura */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[55vh] w-[55vh] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="page-enter relative w-full max-w-lg rounded-2xl border border-primary/20 bg-card/80 p-7 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] md:p-9">
        {/* Progress dots */}
        <div className="mb-7 flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-7 bg-primary"
                  : i < step
                    ? "w-3 bg-primary/50"
                    : "w-3 bg-border"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col">
            <p className="text-center font-mono text-[0.6rem] uppercase tracking-[0.35em] text-primary/70">
              ברוכים הבאים
            </p>
            <h2
              className="mt-2 text-center text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              במה נתמקד?
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              נכוונן עבורכם את לוח המחוונים. תמיד אפשר לשנות אחר כך.
            </p>

            <div className="mt-6 grid gap-3">
              {FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFocus(o.id)}
                  className={`flex items-center gap-4 rounded-xl border p-4 text-right transition-all ${
                    focus === o.id
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                      : "border-border bg-white/[0.02] hover:border-primary/30 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl text-primary">
                    {o.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-foreground">
                      {o.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {o.desc}
                    </span>
                  </span>
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      focus === o.id
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center text-center">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-primary/70">
              תיק תרגול
            </p>
            <h2
              className="mt-2 text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              יתרת הפתיחה שלכם
            </h2>
            <div className="mt-6 flex h-32 w-full items-center justify-center rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent">
              <span
                className="text-5xl font-bold tracking-tight text-primary md:text-6xl"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {balanceLabel}
              </span>
            </div>
            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              כסף וירטואלי לתרגול בלבד. כל הפעילות היא הדמיה חינוכית — אין כסף
              אמיתי, אין הבטחות לרווח ואין ייעוץ פיננסי.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-3xl text-primary">
              ✓
            </span>
            <h2
              className="mt-4 text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              הכול מוכן
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              לוח המחוונים, הסימולטור והבוטים ממתינים לכם. בואו נתחיל לתרגל.
            </p>
            <ul className="mt-6 w-full space-y-2 text-right">
              {[
                "סורק שוק חי — קריפטו, מניות ושווקי תחזיות",
                "סימולטור מסחר עם תיקים מרובים",
                "מרכז פיקוד בוטים לתרגול אוטומטי",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-4 py-2.5 text-sm text-foreground"
                >
                  <span className="text-primary">◆</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Controls */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              חזרה
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-[filter] hover:brightness-110"
            >
              המשך
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onComplete(focus)}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-[filter] hover:brightness-110"
            >
              כניסה למערכת
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
