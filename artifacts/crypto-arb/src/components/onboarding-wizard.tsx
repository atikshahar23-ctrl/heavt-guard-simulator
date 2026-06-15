import { useState } from "react";
import { STARTING_BALANCE } from "@/contexts/portfolio-context";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

export type OnboardingFocus = "crypto" | "stocks" | "all";

const balanceLabel = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(STARTING_BALANCE);

const FOCUS_OPTIONS: {
  id: OnboardingFocus;
  titleKey: string;
  descKey: string;
  icon: string;
}[] = [
  {
    id: "crypto",
    titleKey: "ob.focus.crypto.title",
    descKey: "ob.focus.crypto.desc",
    icon: "\u20BF",
  },
  {
    id: "stocks",
    titleKey: "ob.focus.stocks.title",
    descKey: "ob.focus.stocks.desc",
    icon: "\uD83D\uDCC8",
  },
  {
    id: "all",
    titleKey: "ob.focus.all.title",
    descKey: "ob.focus.all.desc",
    icon: "\u2726",
  },
];

const FEATURE_KEYS = ["ob.feature.scanner", "ob.feature.simulator", "ob.feature.bots"];

const TUTORIAL_CARDS = [
  {
    titleKey: "ob.tutorial.scanner.title",
    descKey: "ob.tutorial.scanner.desc",
    icon: "\uD83D\uDD0D",
  },
  {
    titleKey: "ob.tutorial.simulator.title",
    descKey: "ob.tutorial.simulator.desc",
    icon: "\uD83D\uDCC9",
  },
  {
    titleKey: "ob.tutorial.bots.title",
    descKey: "ob.tutorial.bots.desc",
    icon: "\uD83E\uDD16",
  },
  {
    titleKey: "ob.tutorial.research.title",
    descKey: "ob.tutorial.research.desc",
    icon: "\uD83D\uDD17",
  },
  {
    titleKey: "ob.tutorial.advisor.title",
    descKey: "ob.tutorial.advisor.desc",
    icon: "\uD83D\uDCD6",
  },
];

interface QuizQuestion {
  qKey: string;
  options: { labelKey: string; correct: boolean }[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    qKey: "ob.quiz.q1",
    options: [
      { labelKey: "ob.quiz.a1.real", correct: false },
      { labelKey: "ob.quiz.a1.virtual", correct: true },
    ],
  },
  {
    qKey: "ob.quiz.q2",
    options: [
      { labelKey: "ob.quiz.a2.yes", correct: false },
      { labelKey: "ob.quiz.a2.no", correct: true },
    ],
  },
  {
    qKey: "ob.quiz.q3",
    options: [
      { labelKey: "ob.quiz.a3.profit", correct: false },
      { labelKey: "ob.quiz.a3.limit", correct: true },
    ],
  },
  {
    qKey: "ob.quiz.q4",
    options: [
      { labelKey: "ob.quiz.a4.yes", correct: false },
      { labelKey: "ob.quiz.a4.no", correct: true },
    ],
  },
];

const NAV_MAP_GROUPS: { titleKey: string; descKey: string }[] = [
  { titleKey: "nav.privateOffice", descKey: "nav.privateOffice.desc" },
  { titleKey: "nav.globalMarkets", descKey: "nav.globalMarkets.desc" },
  { titleKey: "nav.algorithmics", descKey: "nav.algorithmics.desc" },
  { titleKey: "nav.autoActivity", descKey: "nav.autoActivity.desc" },
  { titleKey: "nav.researchAndTools", descKey: "nav.researchAndTools.desc" },
];

const TOTAL_STEPS = 6;

export function OnboardingWizard({
  onComplete,
}: {
  onComplete: (focus: OnboardingFocus) => void;
}) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<OnboardingFocus>("all");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number | null>>({
    0: null, 1: null, 2: null, 3: null,
  });
  const [quizFeedback, setQuizFeedback] = useState<Record<number, "correct" | "wrong" | null>>({
    0: null, 1: null, 2: null, 3: null,
  });
  const { lang } = useLanguage();

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const quizScore = QUIZ_QUESTIONS.filter((_, i) => quizAnswers[i] !== null && quizFeedback[i] === "correct").length;
  const quizDone = QUIZ_QUESTIONS.every((_, i) => quizAnswers[i] !== null);
  const quizPassed = quizScore >= 3;

  const selectQuizOption = (qIdx: number, optIdx: number) => {
    const isCorrect = QUIZ_QUESTIONS[qIdx].options[optIdx].correct;
    setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
    setQuizFeedback((prev) => ({ ...prev, [qIdx]: isCorrect ? "correct" : "wrong" }));
  };

  const stepLabels = [
    t("ob.welcome", lang),
    t("ob.practicePortfolio", lang),
    t("ob.allReady", lang),
    t("ob.navMap", lang),
    t("ob.tutorial", lang),
    t("ob.quiz", lang),
  ];

  return (
    <div
      dir={lang === "he" ? "rtl" : "ltr"}
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

        {/* Step label */}
        <p className="text-center font-mono text-[0.6rem] uppercase tracking-[0.35em] text-primary/70 mb-4">
          {stepLabels[step]}
        </p>

        {step === 0 && (
          <div className="flex flex-col">
            <h2
              className="mt-2 text-center text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.focusQuestion", lang)}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {t("ob.focusSubtitle", lang)}
            </p>

            <div className="mt-6 grid gap-3">
              {FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFocus(o.id)}
                  className={`flex items-center gap-4 rounded-xl border p-4 ${lang === "he" ? "text-right" : "text-left"} transition-all ${
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
                      {t(o.titleKey, lang)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {t(o.descKey, lang)}
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
            <h2
              className="mt-2 text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.startingBalance", lang)}
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
              {t("ob.virtualMoney", lang)}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-3xl text-primary">
              \u2713
            </span>
            <h2
              className="mt-4 text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.allReady", lang)}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("ob.dashboardReady", lang)}
            </p>
            <ul className={`mt-6 w-full space-y-2 ${lang === "he" ? "text-right" : "text-left"}`}>
              {FEATURE_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-4 py-2.5 text-sm text-foreground"
                >
                  <span className="text-primary">\u25C6</span>
                  {t(key, lang)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col">
            <h2
              className="text-center text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.navMapTitle", lang)}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {t("ob.navMapSubtitle", lang)}
            </p>
            <div className="mt-6 grid gap-3">
              {NAV_MAP_GROUPS.map((g) => (
                <div
                  key={g.titleKey}
                  className={`rounded-xl border border-border bg-white/[0.02] p-4 ${lang === "he" ? "text-right" : "text-left"}`}
                >
                  <span className="block font-semibold text-foreground">
                    {t(g.titleKey, lang)}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {t(g.descKey, lang)}
                  </span>
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 ${lang === "he" ? "text-right" : "text-left"}`}>
              <p className="text-sm font-semibold text-foreground mb-1">{t("guide.firstSteps.title", lang)}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("guide.firstSteps.1", lang)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("guide.firstSteps.2", lang)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("guide.firstSteps.3", lang)}</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col">
            <h2
              className="text-center text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.tutorialTitle", lang)}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {t("ob.tutorialSubtitle", lang)}
            </p>
            <div className="mt-6 grid gap-3">
              {TUTORIAL_CARDS.map((c, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-xl border border-border bg-white/[0.02] p-4 ${lang === "he" ? "text-right" : "text-left"}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl text-primary">
                    {c.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-foreground">
                      {t(c.titleKey, lang)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {t(c.descKey, lang)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col">
            <h2
              className="text-center text-2xl font-semibold tracking-wide text-foreground md:text-3xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("ob.quizTitle", lang)}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {t("ob.quizSubtitle", lang)}
            </p>
            <div className="mt-6 space-y-4">
              {QUIZ_QUESTIONS.map((q, qIdx) => (
                <div key={qIdx} className="rounded-xl border border-border bg-white/[0.02] p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">
                    {qIdx + 1}. {t(q.qKey, lang)}
                  </p>
                  <div className="grid gap-2">
                    {q.options.map((opt, oIdx) => {
                      const selected = quizAnswers[qIdx] === oIdx;
                      const fb = quizFeedback[qIdx];
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => selectQuizOption(qIdx, oIdx)}
                          disabled={quizAnswers[qIdx] !== null}
                          className={`rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                            selected && fb === "correct"
                              ? "border-green-500/60 bg-green-500/10 text-green-400"
                              : selected && fb === "wrong"
                                ? "border-red-500/60 bg-red-500/10 text-red-400"
                                : "border-border bg-white/[0.02] text-foreground hover:border-primary/30"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {selected && fb === "correct" && <span>\u2713</span>}
                            {selected && fb === "wrong" && <span>\u2717</span>}
                            {t(opt.labelKey, lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {quizFeedback[qIdx] === "wrong" && (
                    <p className="mt-2 text-xs text-red-400">{t("ob.quiz.wrong", lang)}</p>
                  )}
                  {quizFeedback[qIdx] === "correct" && (
                    <p className="mt-2 text-xs text-green-400">{t("ob.quiz.correct", lang)}</p>
                  )}
                </div>
              ))}
            </div>
            {quizDone && (
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t("ob.quiz.score", lang).replace("{n}", String(quizScore))}
                </p>
                {quizPassed ? (
                  <p className="mt-1 text-sm text-green-400">{t("ob.quiz.pass", lang)}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuizAnswers({ 0: null, 1: null, 2: null, 3: null });
                      setQuizFeedback({ 0: null, 1: null, 2: null, 3: null });
                    }}
                    className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {t("ob.quiz.retry", lang)}
                  </button>
                )}
              </div>
            )}
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
              {t("ob.back", lang)}
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
              {t(step === 2 ? "ob.next" : "ob.continue", lang)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onComplete(focus)}
              disabled={!quizPassed}
              className={`rounded-lg px-6 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-[filter] ${
                quizPassed
                  ? "bg-primary text-primary-foreground hover:brightness-110"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {t("ob.login", lang)}
            </button>
          )}
        </div>

        {/* Skip option only for tutorial, not for quiz */}
        {step === 4 && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setStep(5)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              {t("ob.skip", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
