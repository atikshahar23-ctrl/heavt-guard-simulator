export const miscStrings: Record<string, Record<"he" | "en", string>> = {
  // --- Landing page ---
  "landing.memberLogin": { he: "כניסת חברים", en: "Member Login" },
  "landing.requestMembership": { he: "בקשת חברות", en: "Request Membership" },
  "landing.heroTitle1": { he: "מודיעין שוק.", en: "Market Intelligence." },
  "landing.heroTitle2": { he: "ברמה אחרת.", en: "On another level." },
  "landing.heroSubtitle": {
    he: "מצליבים נתוני קריפטו, מניות ושווקי תחזיות לכדי תמונת שוק אחת חדה — ומתרגלים מסחר בסביבת הדמיה מלאה, ללא סיכון.",
    en: "Cross-reference crypto, stocks, and prediction markets into one sharp market picture — and practice trading in a full simulation environment, risk-free.",
  },
  "landing.disclaimer": {
    he: "הדמיה חינוכית בלבד. כל הנתונים והאותות מיועדים ללימוד ולתרגול — אין כסף אמיתי, אין הבטחות לרווח ואין ייעוץ פיננסי. ביצועי עבר אינם מעידים על העתיד.",
    en: "Educational simulation only. All data and signals are for learning and practice — no real money, no profit guarantees, and no financial advice. Past performance does not indicate future results.",
  },
  "landing.demoOnly": { he: "דמו לימודי בלבד", en: "Educational demo only" },
  "landing.feat.scanner.title": { he: "סורק שוק חי", en: "Live Market Scanner" },
  "landing.feat.scanner.desc": {
    he: "קריפטו, מניות ושווקי תחזיות במקום אחד — אותות סקאלפ ומומנטום בזמן אמת.",
    en: "Crypto, stocks, and prediction markets in one place — real-time scalp and momentum signals.",
  },
  "landing.feat.simulator.title": { he: "סימולטור מסחר", en: "Trading Simulator" },
  "landing.feat.simulator.desc": {
    he: "תיק תרגול עם מספר ארנקים ועקומת הון. כסף וירטואלי בלבד, ללא סיכון.",
    en: "Practice portfolio with multiple wallets and an equity curve. Virtual money only, risk-free.",
  },
  "landing.feat.bots.title": { he: "מרכז פיקוד בוטים", en: "Bot Command Center" },
  "landing.feat.bots.desc": {
    he: "צוות בוטים לתרגול אוטומטי — סקאלפ, פריצות וצבירה, עם בקרת עוצמה אחת.",
    en: "A bot squad for automated practice — scalping, breakouts, and accumulation, with a single intensity control.",
  },
  "landing.feat.research.title": { he: "שולחן מחקר", en: "Research Desk" },
  "landing.feat.research.desc": {
    he: "חיפוש חופשי של מניות וקריפטו עם מחירים חיים וקישורי מחקר חיצוניים.",
    en: "Free search of stocks and crypto with live prices and external research links.",
  },
  "landing.feat.jarvis.title": { he: "עוזר JARVIS", en: "JARVIS Assistant" },
  "landing.feat.jarvis.desc": {
    he: "מוח חכם מבוסס כללים, דו-לשוני (עברית/אנגלית) — ללא בינה מלאכותית בתשלום.",
    en: "A smart rule-based engine, bilingual (Hebrew/English) — no paid AI.",
  },
  "landing.feat.predictions.title": { he: "שווקי תחזיות", en: "Prediction Markets" },
  "landing.feat.predictions.desc": {
    he: "הצלבת נתוני בינאנס מול סנטימנט הקהל ב-Polymarket לזיהוי פערים.",
    en: "Cross-reference Binance data against Polymarket crowd sentiment to spot gaps.",
  },

  // --- Onboarding wizard (additional ob.* keys; some ob.* already in i18n.ts) ---
  "ob.welcome": { he: "ברוכים הבאים", en: "Welcome" },
  "ob.focusQuestion": { he: "במה נתמקד?", en: "What shall we focus on?" },
  "ob.focusSubtitle": {
    he: "נכוונן עבורכם את לוח המחוונים. תמיד אפשר לשנות אחר כך.",
    en: "We'll tune your dashboard for you. You can always change it later.",
  },
  "ob.practicePortfolio": { he: "תיק תרגול", en: "Practice Portfolio" },
  "ob.startingBalance": { he: "יתרת הפתיחה שלכם", en: "Your Starting Balance" },
  "ob.allReady": { he: "הכול מוכן", en: "All Set" },
  "ob.feature.scanner": {
    he: "סורק שוק חי — קריפטו, מניות ושווקי תחזיות",
    en: "Live market scanner — crypto, stocks, and prediction markets",
  },
  "ob.feature.simulator": {
    he: "סימולטור מסחר עם תיקים מרובים",
    en: "Trading simulator with multiple portfolios",
  },
  "ob.feature.bots": {
    he: "מרכז פיקוד בוטים לתרגול אוטומטי",
    en: "Bot command center for automated practice",
  },
  "ob.focus.crypto.title": { he: "קריפטו", en: "Crypto" },
  "ob.focus.crypto.desc": {
    he: "ביטקוין, מטבעות מובילים, סקאלפ ומומנטום בזמן אמת.",
    en: "Bitcoin, top coins, scalp and momentum in real time.",
  },
  "ob.focus.stocks.title": { he: "מניות", en: "Stocks" },
  "ob.focus.stocks.desc": {
    he: "מניות מובילות, כסף חכם וכותרות שוק ההון.",
    en: "Leading stocks, smart money, and equity-market headlines.",
  },
  "ob.focus.all.title": { he: "הכול", en: "Everything" },
  "ob.focus.all.desc": {
    he: "תמונת שוק מלאה — קריפטו, מניות ושווקי תחזיות יחד.",
    en: "A full market picture — crypto, stocks, and prediction markets together.",
  },
  "ob.back": { he: "חזרה", en: "Back" },
  "ob.continue": { he: "המשך", en: "Continue" },

  // --- Market Clock (additional mc.* keys; mc.noEvents already in i18n.ts) ---
  "mc.kind.holiday": { he: "חג", en: "Holiday" },
  "mc.kind.macro": { he: "FOMC/NFP", en: "FOMC/NFP" },
  "mc.kind.expiry": { he: "תפוגה", en: "Expiry" },
  "mc.kind.weekend": { he: "סוף שבוע", en: "Weekend" },
  "mc.kind.info": { he: "סוף חודש", en: "Month End" },
  "mc.prevYear": { he: "שנה קודמת", en: "Previous year" },
  "mc.prevMonth": { he: "חודש קודם", en: "Previous month" },
  "mc.nextMonth": { he: "חודש הבא", en: "Next month" },
  "mc.nextYear": { he: "שנה הבאה", en: "Next year" },
  "mc.today": { he: "היום", en: "Today" },
  "mc.close": { he: "סגירה", en: "Close" },
  "mc.footer": {
    he: "לוח חינוכי בלבד — תאריכים ידועים מראש, לא נתונים חיים ולא ייעוץ פיננסי.",
    en: "Educational calendar only — known dates in advance, not live data and not financial advice.",
  },

  // --- Social Banners (additional sb.* keys; some sb.* already in i18n.ts) ---
  "sb.rewardAdded": { he: "התגמול היומי נוסף", en: "Daily reward added" },
  "sb.alreadyClaimedTitle": { he: "כבר נאסף היום", en: "Already claimed today" },
  "sb.alreadyClaimedDesc": { he: "אפשר לאסוף שוב מחר.", en: "Come back tomorrow to claim again." },
  "sb.error": { he: "שגיאה", en: "Error" },
  "sb.claimFailDesc": { he: "לא ניתן לאסוף את התגמול כעת.", en: "Couldn't claim the reward right now." },
  "sb.claimedToday": { he: "נאסף היום. חזרו מחר לתגמול נוסף.", en: "Claimed today. Come back tomorrow for another reward." },
  "sb.claiming": { he: "אוסף…", en: "Claiming…" },
  "sb.claim": { he: "אסוף", en: "Claim" },
  "sb.claimed": { he: "נאסף", en: "Claimed" },
  "sb.shareMessage": {
    he: "הצטרפו אליי ל-ARB_SCAN — סימולטור מסחר חינמי (דמו לימודי). שנינו מקבלים $2,000 לתיק! {link}",
    en: "Join me on ARB_SCAN — a free trading simulator (educational demo). We both get $2,000 for our portfolio! {link}",
  },
  "sb.linkCopied": { he: "הקישור הועתק", en: "Link copied" },
  "sb.linkCopiedDesc": { he: "שתפו אותו וקבלו בונוס לכל הצטרפות.", en: "Share it and earn a bonus for every sign-up." },
  "sb.copyFailDesc": { he: "לא ניתן להעתיק את הקישור.", en: "Couldn't copy the link." },
  "sb.shareTitle": { he: "הזמנה ל-ARB_SCAN", en: "Invitation to ARB_SCAN" },
  "sb.inviteFriends": { he: "הזמינו חברים", en: "Invite Friends" },
  "sb.inviteDesc": {
    he: "על כל הצטרפות — שניכם מקבלים $2,000 לתיק (דמו לימודי).",
    en: "For every sign-up — you both get $2,000 to your portfolio (educational demo).",
  },
  "sb.copied": { he: "הועתק", en: "Copied" },
  "sb.copy": { he: "העתק", en: "Copy" },
  "sb.whatsapp": { he: "וואטסאפ", en: "WhatsApp" },
  "sb.telegram": { he: "טלגרם", en: "Telegram" },
  "sb.share": { he: "שתף", en: "Share" },
  "sb.code": { he: "קוד", en: "Code" },
  "sb.successfulInvites": { he: "הזמנות מוצלחות", en: "Successful invites" },
  "sb.dailyRewardTitle": { he: "תגמול כניסה יומי · {amount}", en: "Daily login reward · {amount}" },
  "sb.rewardWaiting": {
    he: "התגמול ממתין לך — לחיצה אחת והוא בארנק.",
    en: "Your reward is waiting — one click and it's in your wallet.",
  },
  "sb.rewardAddedDesc": {
    he: "נוספו {amount} לארנק הפעיל (דמו לימודי).",
    en: "Added {amount} to your active wallet (educational demo).",
  },

  // --- AutoTrader Engine (additional ate.* keys; some ate.* already in i18n.ts) ---
  "ate.peak": { he: "שיא", en: "peak" },
  "ate.recycle": { he: "מִחזוּר", en: "Recycle" },
  "ate.after": { he: "אחרי", en: "after" },
  "ate.secAbbr": { he: "ש'", en: "s" },
  "ate.noSlSet": { he: "אין SL מוגדר", en: "no SL set" },
  "ate.squadName": { he: "הצוות", en: "The Squad" },
  "ate.coordination": { he: "תיאום", en: "Coordination" },
  "ate.dirLong": { he: "לונג", en: "long" },
  "ate.dirShort": { he: "שורט", en: "short" },
  "ate.backupCall": {
    he: "קונצנזוס {dir} חזק ({conf}) — הצוות מתכנס לכיוון, גיבוי מוכן",
    en: "Strong {dir} consensus ({conf}) — squad converging, backup ready",
  },
  "ate.squadBackup": {
    he: "{name} מצטרף לגיבוי {dir} על {asset} — קונצנזוס גבוה",
    en: "{name} joins backup {dir} on {asset} — high consensus",
  },
  "ate.squadEntry": {
    he: "{name} פתח {dir} על {asset}",
    en: "{name} opened {dir} on {asset}",
  },

  // --- Ticker Tape ---
  "tt.play": { he: "הפעל", en: "Play" },
  "tt.pause": { he: "השהה", en: "Pause" },
  "tt.playScroll": { he: "הפעל גלילת מחירים", en: "Resume price scroll" },
  "tt.pauseScroll": { he: "השהה גלילת מחירים", en: "Pause price scroll" },

  // --- Auth Shell ---
  "auth.privateClub": { he: "מועדון פרטי", en: "Private Club" },

  // --- Wallet Progress ---
  "wp.title": { he: "התקדמות הארנק", en: "Wallet Progress" },
  "wp.noTrades": { he: "אין עדיין עסקאות סגורות", en: "No closed trades yet" },
  "wp.willUpdate": {
    he: "הגרף יתעדכן ככל שתסגור פוזיציות",
    en: "The chart updates as you close positions",
  },

  // --- Social context toasts ---
  "social.referralBonusTitle": { he: "בונוס הזמנה התקבל", en: "Referral bonus received" },
  "social.referralBonusDesc": {
    he: "נוספו {n} לארנק הפעיל שלך (דמו לימודי).",
    en: "Added {n} to your active wallet (educational demo).",
  },
  "social.referralCodeTitle": { he: "קוד הזמנה", en: "Referral code" },
};
