import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Lang } from "@/lib/i18n";

const STORAGE_KEY = "hg.lang";
const DEFAULT_LANG: Lang = "he";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  dir: "rtl",
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "he" || stored === "en") return stored;
    } catch {}
    return DEFAULT_LANG;
  });

  const dir: "rtl" | "ltr" = lang === "he" ? "rtl" : "ltr";

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  // Sync <html> lang + dir attributes
  useEffect(() => {
    const html = document.documentElement;
    if (html) {
      html.lang = lang === "he" ? "he" : "en";
      html.dir = dir;
    }
  }, [lang, dir]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
