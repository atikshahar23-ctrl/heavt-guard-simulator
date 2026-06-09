export const tradesStrings: Record<string, Record<"he" | "en", string>> = {
  // ─── Trade Detail Modal: type labels ───
  "td.typeBinance": { he: "פיוצ'רס קריפטו", en: "Crypto Futures" },
  "td.typeStock": { he: "מניות", en: "Stocks" },
  "td.typePolymarket": { he: "שוק חיזוי", en: "Prediction Market" },
  "td.typeFunding": { he: "מימון דלתא-נייטרל", en: "Delta-Neutral Funding" },
  "td.typeOption": { he: "אופציות", en: "Options" },

  // ─── Trade Detail Modal: direction labels ───
  "td.dirLong": { he: "לונג (LONG)", en: "Long (LONG)" },
  "td.dirShort": { he: "שורט (SHORT)", en: "Short (SHORT)" },
  "td.dirYes": { he: "כן (YES)", en: "Yes (YES)" },
  "td.dirNo": { he: "לא (NO)", en: "No (NO)" },

  // ─── Trade Detail Modal: exit reasons ───
  "td.exitTp": { he: "יעד רווח (TP)", en: "Take Profit (TP)" },
  "td.exitSl": { he: "סטופ לוס (SL)", en: "Stop Loss (SL)" },
  "td.exitLiq": { he: "יציאת חירום (LIQ)", en: "Emergency Exit (LIQ)" },
  "td.exitManual": { he: "סגירה ידנית", en: "Manual Close" },

  // ─── Trade Detail Modal: bot / manual ───
  "td.botAuto": { he: "אוטו-טריידר", en: "Auto-Trader" },
  "td.botManual": { he: "ידני", en: "Manual" },

  // ─── Trade Detail Modal: source reasons ───
  "td.reasonDipBuyer": { he: "הבוט זיהה ירידה חדה במחיר וקנה את ה״דיפ״ בציפייה לתיקון כלפי מעלה", en: "The bot detected a sharp price drop and bought the dip expecting an upward correction" },
  "td.reasonBreakoutHunter": { he: "הבוט זיהה פריצה של התנגדות עם מומנטום וביקש לרכוב על התנועה", en: "The bot detected a resistance breakout with momentum and aimed to ride the move" },
  "td.reasonBlueChipDca": { he: "רכישה מדורגת (DCA) של נכס איכותי לטווח ארוך, ללא תזמון שוק", en: "Staged purchase (DCA) of a quality long-term asset, without market timing" },
  "td.reasonScalpSignal": { he: "סיגנל סקאלפ זיהה התכנסות של RSI/EMA/ATR לכיוון ברור בטווח קצר", en: "A scalp signal detected RSI/EMA/ATR converging into a clear short-term direction" },
  "td.reasonMomentumSurge": { he: "סורק המומנטום זיהה זינוק בנפח ובקצב העלייה (RVol/ROC)", en: "The momentum scanner detected a surge in volume and rate of change (RVol/ROC)" },
  "td.reasonSmartMoney": { he: "הסוכן החכם זיהה הצטברות סיגנלים טכניים ומשפיענים לאותו כיוון", en: "The smart agent detected an accumulation of technical and influencer signals in the same direction" },
  "td.reasonSmartMoneyTech": { he: "הסוכן החכם שילב איתות טכני עם סנטימנט משפיענים לאותו כיוון", en: "The smart agent combined a technical signal with influencer sentiment in the same direction" },
  "td.reasonQuickTrade": { he: "כניסה מהירה ידנית מתוך מסך ההימורים/הסיגנלים", en: "A quick manual entry from the bets/signals screen" },

  // ─── Trade Detail Modal: narrative direction words ───
  "td.dirwordLong": { he: "עלייה (לונג)", en: "Up (Long)" },
  "td.dirwordShort": { he: "ירידה (שורט)", en: "Down (Short)" },
  "td.dirwordYes": { he: "כן (YES)", en: "Yes (YES)" },
  "td.dirwordNo": { he: "לא (NO)", en: "No (NO)" },
  "td.dirwordDefault": { he: "כיוון", en: "Direction" },

  // ─── Trade Detail Modal: "why we entered" ───
  "td.whyAuto": { he: "האוטו-טריידר זיהה סטאפ שעמד בקריטריונים של הצי ופתח את הפוזיציה אוטומטית", en: "The auto-trader identified a setup that met the fleet's criteria and opened the position automatically" },
  "td.whyManual": { he: "החלטת כניסה ידנית של הסוחר", en: "A manual entry decision by the trader" },
  "td.whyDirectionChosen": { he: "הכיוון שנבחר", en: "Chosen direction" },
  "td.whyLeverage": { he: "במינוף", en: "at leverage" },

  // ─── Trade Detail Modal: plan items ───
  "td.planEntry": { he: "מחיר כניסה מתוכנן", en: "Planned entry price" },
  "td.planTp": { he: "יעד רווח (TP)", en: "Profit target (TP)" },
  "td.planSl": { he: "סטופ לוס (SL)", en: "Stop loss (SL)" },
  "td.planRr": { he: "יחס סיכון/סיכוי מתוכנן", en: "Planned risk/reward ratio" },
  "td.planNone": { he: "לא נשמרה תוכנית מובנית של יעד/סטופ לעסקה זו (עסקה ישנה או כניסה ידנית).", en: "No structured target/stop plan was saved for this trade (old trade or manual entry)." },

  // ─── Trade Detail Modal: outcome items ───
  "td.outcomeExitReason": { he: "סיבת היציאה", en: "Exit reason" },
  "td.outcomeExitPrice": { he: "מחיר יציאה בפועל", en: "Actual exit price" },
  "td.outcomeFees": { he: "עמלות", en: "Fees" },
  "td.outcomeResult": { he: "תוצאה", en: "Result" },
  "td.outcomeOnMargin": { he: "על המרג׳ין", en: "on margin" },

  // ─── Trade Detail Modal: lessons ───
  "td.lessonTp": { he: "העסקה הגיעה ליעד הרווח לפי התוכנית — ביצוע ממושמע של אסטרטגיית היציאה. כך נראית עסקה ״לפי הספר״.", en: "The trade reached its profit target per plan — a disciplined execution of the exit strategy. This is what a 'by the book' trade looks like." },
  "td.lessonSl": { he: "העסקה נקטעה בסטופ לפי התוכנית — ההפסד הוגבל מראש וזה בדיוק תפקיד הסטופ. ניהול סיכון נכון, גם כשמפסידים.", en: "The trade was stopped out per plan — the loss was capped in advance, which is exactly the stop's job. Sound risk management, even when losing." },
  "td.lessonLiq": { he: "יציאת חירום של מנהל הסיכונים (לפני סיכון מסוכן) — בדוק אם המינוף היה גבוה מדי או הסטופ רחוק מדי.", en: "An emergency exit by the risk manager (before dangerous risk) — check whether leverage was too high or the stop too far." },
  "td.lessonWonManual": { he: "נסגרה ידנית ברווח — שקול אם כדאי היה לתת לרווח לרוץ עד היעד, או שהסגירה המוקדמת נכונה לסטאפ הזה.", en: "Closed manually in profit — consider whether it was worth letting the profit run to target, or whether the early close was right for this setup." },
  "td.lessonLostManual": { he: "נסגרה ידנית בהפסד לפני הסטופ — שים לב לסגירות רגשיות; לרוב עדיף לתת לתוכנית (SL/TP) לעבוד.", en: "Closed manually at a loss before the stop — watch out for emotional closes; it is usually better to let the plan (SL/TP) work." },

  // ─── Trade Detail Modal: analysis headings ───
  "td.analysisTitle": { he: "ניתוח מלא של העסקה", en: "Full trade analysis" },
  "td.analysisWhy": { he: "למה נכנסנו", en: "Why we entered" },
  "td.analysisPlan": { he: "התוכנית והיעדים", en: "Plan & targets" },
  "td.analysisOutcome": { he: "מה קרה בסוף", en: "What happened in the end" },
  "td.analysisLesson": { he: "מסקנה ולקח", en: "Takeaway & lesson" },

  // ─── Trade Detail Modal: detail rows ───
  "td.rowEntryPrice": { he: "מחיר כניסה", en: "Entry price" },
  "td.rowExitPrice": { he: "מחיר יציאה", en: "Exit price" },
  "td.rowDirection": { he: "כיוון", en: "Direction" },
  "td.rowLeverage": { he: "מינוף", en: "Leverage" },
  "td.rowNoLeverage": { he: "ללא", en: "None" },
  "td.rowPositionSize": { he: "גודל פוזיציה", en: "Position size" },
  "td.rowMargin": { he: "מרג'ין / עלות", en: "Margin / cost" },
  "td.rowExitReason": { he: "סיבת יציאה", en: "Exit reason" },
  "td.rowSource": { he: "מקור / בוט", en: "Source / bot" },
  "td.rowHolding": { he: "משך החזקה", en: "Holding time" },
  "td.rowOpened": { he: "נפתחה", en: "Opened" },
  "td.rowClosed": { he: "נסגרה", en: "Closed" },
  "td.rowProceeds": { he: "תקבול", en: "Proceeds" },
  "td.rowFees": { he: "עמלות מסחר", en: "Trading fees" },
  "td.rowCost": { he: "עלות", en: "Cost" },
  "td.rowTradeDetails": { he: "פרטי העסקה", en: "Trade details" },

  // ─── Trade Detail Modal: quantity labels ───
  "td.qtyShares": { he: "מניות", en: "shares" },
  "td.qtyUnits": { he: "יחידות", en: "units" },
  "td.qtyNotional": { he: "נומינלי", en: "notional" },

  // ─── Trade Detail Modal: misc ───
  "td.closeBtn": { he: "סגור", en: "Close" },
  "td.pnlLabel": { he: "רווח/הפסד", en: "Profit / Loss" },
  "td.disclaimer": { he: "הדמיה חינוכית בלבד — ללא כסף אמיתי וללא הבטחת תשואות.", en: "Educational simulation only — no real money and no return guarantees." },

  // ─── Trade Detail Modal: holding-duration units ───
  "td.durMinutes": { he: "דקות", en: "min" },
  "td.durHr": { he: "ש׳", en: "h" },
  "td.durMinAbbr": { he: "ד׳", en: "m" },
  "td.durDays": { he: "ימים", en: "d" },

  // ─── Trade Detail Chart ───
  "tdc.entry": { he: "כניסה", en: "Entry" },
  "tdc.exit": { he: "יציאה", en: "Exit" },
  "tdc.loading": { he: "טוען גרף…", en: "Loading chart…" },
  "tdc.unavailable": { he: "הגרף לא זמין כרגע.", en: "Chart unavailable right now." },

  // ─── Polymarket Probability Chart ───
  "pp.loadingProb": { he: "טוען גרף הסתברות…", en: "Loading probability chart…" },
  "pp.noHistory": { he: "אין נתוני היסטוריה זמינים", en: "No history data available" },

  // ─── Candlestick / Stock Chart toolbar ───
  "cc.liveTitle": { he: "גרף חי משולב עם הדמו", en: "Live chart integrated with the demo" },
  "cc.live": { he: "חי", en: "Live" },
  "cc.proTitle": { he: "מצב מקצועי — כלי ציור, אינדיקטורים וניתוח טכני אוטומטי", en: "Pro mode — drawing tools, indicators, and automatic technical analysis" },
  "cc.taTitle": { he: "ניתוח טכני: EMA, תמיכה/התנגדות, איתות קנייה/מכירה", en: "Technical analysis: EMA, support/resistance, buy/sell signal" },
  "cc.analyzeTitle": { he: "ניתוח אוטומטי מוקש: מאגד מגמה חזוקה מכל האינדיקטורים", en: "Automatic analysis: aggregates the dominant trend across all indicators" },
  "cc.analyze": { he: "ניתח", en: "Analyze" },
  "cc.closePosition": { he: "סגור פוזיציה", en: "Close position" },

  // ─── Quick Trade Button ───
  "qt.noRec": { he: "אין כרגע המלצה זמינה לביצוע", en: "No recommendation available to execute right now" },
  "qt.noCash": { he: "אין מספיק מזומן בארנק", en: "Not enough cash in the wallet" },
  "qt.sell": { he: "מכירה", en: "Sell" },
  "qt.forUsd": { he: "ב-$", en: "for $" },
  "qt.quickTradeTitle": { he: "מסחר מהיר", en: "Quick Trade" },
  "qt.noRecShort": { he: "אין המלצה זמינה", en: "No recommendation available" },
  "qt.fast": { he: "מהיר", en: "Fast" },
  "qt.executeTop": { he: "מסחר מהיר — בצע את ההמלצה המובילה", en: "Quick Trade — execute the top recommendation" },
  "qt.sellShort": { he: "מכירה (SHORT)", en: "Sell (SHORT)" },
  "qt.buyLong": { he: "קנייה (LONG)", en: "Buy (LONG)" },
  "qt.tenPctCash": { he: "10% מהמזומן", en: "10% of cash" },
  "qt.autoSlTp": { he: "SL/TP אוטומטי 3%/6%", en: "Auto SL/TP 3%/6%" },

  // ─── Simulator: misc ───
  "sim.viewChart": { he: "לחץ לצפייה בגרף", en: "Click to view chart" },
  "sim.viewChartFor": { he: "צפה בגרף", en: "View chart" },
  "sim.botsPausedTitle": { he: "הבוטים מושהים — לחץ לביטול ההשהיה", en: "Bots are paused — click to resume" },
  "sim.botsPaused": { he: "בוטים מושהים", en: "Bots Paused" },

  // ─── Simulator: Options tab ───
  "opt.agentTitle": { he: "סוכן האופציות — פוזיציות פתוחות", en: "Options Agent — Open Positions" },
  "opt.agentDesc": { he: "אופציות CALL/PUT לונג בלבד. ההפסד המרבי הוא הפרמיה ששולמה. השווי מסומן לפי מודל בלאק-שולס מפושט ויורד עם התקרבות התפוגה (דעיכת זמן). מדומה ולימודי בלבד — ללא הבטחת תשואה.", en: "Long CALL/PUT options only. The maximum loss is the premium paid. Value is marked using a simplified Black-Scholes model and decays as expiry approaches (time decay). Simulated and educational only — no return guarantee." },
  "opt.positions": { he: "פוזיציות", en: "Positions" },
  "opt.noOpen": { he: "אין פוזיציות אופציה פתוחות", en: "No open option positions" },
  "opt.noMatch": { he: "אין פוזיציות התואמות לסינון", en: "No positions match the filter" },
  "opt.crypto": { he: "קריפטו", en: "Crypto" },
  "opt.stock": { he: "מניה", en: "Stock" },
  "opt.strike": { he: "סטרייק", en: "Strike" },
  "opt.contracts": { he: "חוזים", en: "Contracts" },
  "opt.premium": { he: "פרמיה", en: "Premium" },
  "opt.currentValue": { he: "שווי נוכחי", en: "Current value" },
  "opt.underlyingPrice": { he: "מחיר נכס בסיס", en: "Underlying price" },
  "opt.timeToExpiry": { he: "זמן לתפוגה", en: "Time to expiry" },
  "opt.expired": { he: "פג תוקף", en: "Expired" },
  "opt.minShort": { he: "דק'", en: "min" },

  // ─── Portfolio context: wallet toasts / validation ───
  "pc.nameRequired": { he: "יש להזין שם ארנק", en: "Please enter a wallet name" },
  "pc.nameTooLong": { he: "שם הארנק ארוך מדי", en: "Wallet name is too long" },
  "pc.newWalletTitle": { he: "ארנק חדש נפתח", en: "New wallet opened" },
  "pc.newWalletDesc": { he: "כל הבוטים הוחזו אוטומטית — הגדרות המינוף והסטייק נשמרו. הדליק הבוט שבו ייטב החזיר אותם לפעולה.", en: "All bots were reset automatically — leverage and stake settings were saved. Toggle the desired bot back on to resume." },
  "pc.cannotDeleteLast": { he: "לא ניתן למחוק את הארנק האחרון", en: "Cannot delete the last wallet" },
  "pc.defaultWalletName": { he: "ראשי", en: "Main" },
  "pc.fallbackWalletName": { he: "ארנק", en: "Wallet" },
};
