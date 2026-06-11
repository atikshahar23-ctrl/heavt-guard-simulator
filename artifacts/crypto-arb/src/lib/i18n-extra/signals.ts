import type { Lang } from "../i18n";

export const signalsStrings: Record<string, Record<Lang, string>> = {
  "nav.signals": { he: "איתותי טלגרם", en: "Telegram Signals" },

  "signals.title": { he: "מרכז איתותים", en: "Signal Center" },
  "signals.subtitle": {
    he: "איתותי סקאלפ ומומנטום בזמן אמת — שלחו ישירות לטלגרם",
    en: "Live scalp & momentum signals — send directly to Telegram",
  },

  "signals.tab.all": { he: "הכל", en: "All" },
  "signals.tab.scalp": { he: "סקאלפ", en: "Scalp" },
  "signals.tab.momentum": { he: "מומנטום", en: "Momentum" },

  "signals.dir.all": { he: "כל הכיוונים", en: "All directions" },
  "signals.dir.long": { he: "לונג", en: "Long" },
  "signals.dir.short": { he: "שורט", en: "Short" },

  "signals.minScore": { he: "ניקוד מינימום", en: "Min score" },
  "signals.autoSend": { he: "שלח אוטומטית", en: "Auto-send" },
  "signals.autoSendDesc": {
    he: "שלח איתותים מעל הסף לטלגרם אוטומטית",
    en: "Auto-send signals above threshold to Telegram",
  },

  "signals.noSignals": { he: "אין איתותים תואמים כרגע.", en: "No matching signals right now." },
  "signals.loading": { he: "טוען איתותים...", en: "Loading signals..." },

  "signals.badge.scalp": { he: "SCALP 15m", en: "SCALP 15m" },
  "signals.badge.momentum": { he: "MOMENTUM 5m", en: "MOMENTUM 5m" },

  "signals.entry": { he: "כניסה", en: "Entry" },
  "signals.tp": { he: "יעד", en: "TP" },
  "signals.sl": { he: "סטופ", en: "SL" },
  "signals.rr": { he: "R:R", en: "R:R" },
  "signals.score": { he: "ניקוד", en: "Score" },
  "signals.stage": { he: "שלב", en: "Stage" },
  "signals.confidence": { he: "בטחון", en: "Confidence" },

  "signals.sendBtn": { he: "שלח לטלגרם", en: "Send to Telegram" },
  "signals.sending": { he: "שולח...", en: "Sending..." },
  "signals.sent": { he: "נשלח ✓", en: "Sent ✓" },
  "signals.sendError": { he: "שגיאה בשליחה", en: "Send error" },

  "signals.reasons": { he: "ניתוח", en: "Analysis" },

  "signals.tg.title": { he: "הגדרות טלגרם", en: "Telegram Settings" },
  "signals.tg.desc": {
    he: "הזינו את הטוקן ומזהה הצ'אט של הבוט שלכם. הפרטים נשמרים רק בדפדפן.",
    en: "Enter your bot token and chat ID. Credentials are stored locally in your browser only.",
  },
  "signals.tg.howTo": { he: "איך יוצרים בוט טלגרם?", en: "How to create a Telegram bot?" },
  "signals.tg.step1": {
    he: "1. פתחו @BotFather בטלגרם → /newbot → קבלו טוקן",
    en: "1. Open @BotFather in Telegram → /newbot → copy the token",
  },
  "signals.tg.step2": {
    he: "2. שלחו הודעה לבוט ואז פתחו @userinfobot כדי לקבל את ה-Chat ID שלכם",
    en: "2. Message your bot, then open @userinfobot to get your Chat ID",
  },
  "signals.tg.tokenLabel": { he: "Bot Token", en: "Bot Token" },
  "signals.tg.tokenPlaceholder": { he: "123456789:AABBcc...", en: "123456789:AABBcc..." },
  "signals.tg.chatIdLabel": { he: "Chat ID", en: "Chat ID" },
  "signals.tg.chatIdPlaceholder": { he: "123456789", en: "123456789" },
  "signals.tg.testBtn": { he: "שלח הודעת בדיקה", en: "Send test message" },
  "signals.tg.notConfigured": {
    he: "הגדירו בוט טלגרם כדי לשלוח איתותים",
    en: "Configure your Telegram bot to send signals",
  },
  "signals.tg.configured": { he: "טלגרם מוגדר", en: "Telegram configured" },
  "signals.tg.save": { he: "שמור", en: "Save" },
  "signals.tg.clear": { he: "נקה", en: "Clear" },
};
