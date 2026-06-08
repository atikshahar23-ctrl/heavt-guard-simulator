import type { Lang } from "@/lib/research-store";

export interface ResearchStrings {
  dir: "rtl" | "ltr";
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchBtn: string;
  quickLinks: string;
  emptyHint: string;
  noResultsTitle: (q: string) => string;
  crypto: string;
  stocks: string;
  relatedNews: string;
  generalResearch: string;
  recentSearches: string;
  clear: string;
  disclaimer: string;
  openAnalysis: string;
  addToPlan: string;
  fullAnalysisHint: string;
  /* journal */
  journalTitle: string;
  journalSubtitle: string;
  newPlan: string;
  editPlan: string;
  symbol: string;
  assetName: string;
  notes: string;
  notesPlaceholder: string;
  plan: string;
  planPlaceholder: string;
  target: string;
  targetPlaceholder: string;
  status: string;
  statusWatching: string;
  statusActive: string;
  statusClosed: string;
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  emptyJournal: string;
  created: string;
  updated: string;
  langLabel: string;
  /* searched stock panel */
  panelLoading: (sym: string) => string;
  panelNotFound: (sym: string) => string;
}

const he: ResearchStrings = {
  dir: "rtl",
  title: "חדר מחקר",
  subtitle: "חיפוש מידע על מניות וקריפטו — מחירים חיים, גרפים, חדשות ודוחות. כל המקורות חינמיים.",
  searchPlaceholder: "חפש סימבול או שם חברה — לדוגמה NVDA, Tesla, BTC",
  searchBtn: "חפש",
  quickLinks: "קישורים מהירים",
  emptyHint: "הקלד סימבול או שם חברה כדי לקבל מחיר חי, גרפים, חדשות ודוחות.",
  noResultsTitle: (q) => `לא נמצאו תוצאות עבור "${q}". נסה סימבול אחר (למשל AAPL) או חיפוש כללי בקישורים המהירים.`,
  crypto: "קריפטו",
  stocks: "מניות",
  relatedNews: "כותרות כסף חכם רלוונטיות",
  generalResearch: "מחקר כללי",
  recentSearches: "חיפושים אחרונים",
  clear: "נקה",
  disclaimer: "כל הנתונים והקישורים חינמיים לחלוטין. מידע לצורכי לימוד בלבד — לא ייעוץ השקעות.",
  openAnalysis: "ניתוח מלא",
  addToPlan: "הוסף לתכנון",
  fullAnalysisHint: "לחץ על מניה לפתיחת ניתוח מלא — גרף, מדדים, טווחים והערכת מגמה.",
  journalTitle: "המחקר והתכנון שלי",
  journalSubtitle: "רשום מידע על מניה, בנה תכנית מעקב ועקוב אחר הסטטוס שלה.",
  newPlan: "תכנון חדש",
  editPlan: "עריכת תכנון",
  symbol: "סימבול",
  assetName: "שם",
  notes: "מידע ותובנות",
  notesPlaceholder: "מה למדת על המניה? נתונים, קטליזטורים, סיכונים…",
  plan: "תכנית פעולה",
  planPlaceholder: "מתי להיכנס, באיזה מחיר, כמה, מתי לצאת…",
  target: "יעד / מחיר מטרה",
  targetPlaceholder: "לדוגמה $250 או +15%",
  status: "סטטוס",
  statusWatching: "במעקב",
  statusActive: "פעיל",
  statusClosed: "סגור",
  save: "שמור",
  cancel: "ביטול",
  edit: "ערוך",
  delete: "מחק",
  emptyJournal: "עדיין אין תכנונים שמורים. חפש מניה והוסף לה תכנון מעקב.",
  created: "נוצר",
  updated: "עודכן",
  langLabel: "EN",
  panelLoading: (sym) => `טוען נתוני ${sym}…`,
  panelNotFound: (sym) => `לא נמצאו נתוני מסחר עבור ${sym}.`,
};

const en: ResearchStrings = {
  dir: "ltr",
  title: "Research Desk",
  subtitle: "Look up stocks and crypto — live prices, charts, news and filings. All sources are free.",
  searchPlaceholder: "Search a symbol or company — e.g. NVDA, Tesla, BTC",
  searchBtn: "Search",
  quickLinks: "Quick links",
  emptyHint: "Type a symbol or company name to get a live price, charts, news and filings.",
  noResultsTitle: (q) => `No results for "${q}". Try another symbol (e.g. AAPL) or a general search in the quick links.`,
  crypto: "Crypto",
  stocks: "Stocks",
  relatedNews: "Relevant smart-money headlines",
  generalResearch: "General research",
  recentSearches: "Recent searches",
  clear: "Clear",
  disclaimer: "All data and links are completely free. Educational information only — not investment advice.",
  openAnalysis: "Full analysis",
  addToPlan: "Add to plan",
  fullAnalysisHint: "Click a stock to open the full analysis — chart, metrics, ranges and trend outlook.",
  journalTitle: "My research & plans",
  journalSubtitle: "Write notes on a stock, build a tracking plan and follow its status.",
  newPlan: "New plan",
  editPlan: "Edit plan",
  symbol: "Symbol",
  assetName: "Name",
  notes: "Notes & insights",
  notesPlaceholder: "What did you learn? Data, catalysts, risks…",
  plan: "Action plan",
  planPlaceholder: "When to enter, at what price, how much, when to exit…",
  target: "Target / price goal",
  targetPlaceholder: "e.g. $250 or +15%",
  status: "Status",
  statusWatching: "Watching",
  statusActive: "Active",
  statusClosed: "Closed",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  emptyJournal: "No saved plans yet. Search a stock and add a tracking plan.",
  created: "Created",
  updated: "Updated",
  langLabel: "עב",
  panelLoading: (sym) => `Loading ${sym} data…`,
  panelNotFound: (sym) => `No trading data found for ${sym}.`,
};

export function strings(lang: Lang): ResearchStrings {
  return lang === "en" ? en : he;
}
