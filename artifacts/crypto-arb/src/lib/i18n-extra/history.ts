export const historyStrings: Record<string, Record<"he" | "en", string>> = {
  // ── History page ──
  "history.subtitle": {
    he: "מעקב הדמו המלא שלך — כל פוזיציה שנסגרה, אחוז ההצלחה והרווח/הפסד. הדמיה חינוכית בלבד, ללא כסף אמיתי.",
    en: "Your full demo log — every closed position, win rate, and P&L. Educational simulation only, no real money.",
  },
  "history.empty": { he: "עדיין אין עסקאות סגורות.", en: "No closed trades yet." },
  "history.emptyHint": {
    he: "פתח עסקת דמו ממסך סיגנלי הסקאלפ או הסימולטור כדי להתחיל.",
    en: "Open a demo trade from the scalp signals screen or the simulator to get started.",
  },
  "history.noMatch": { he: "אין עסקאות שתואמות את הסינון.", en: "No trades match the filter." },

  // Account stat cards
  "history.stat.balance": { he: "יתרה", en: "Balance" },
  "history.stat.deposited": { he: "הופקדו ${amount}", en: "Deposited ${amount}" },
  "history.stat.realizedPnl": { he: "רווח/הפסד ממומש", en: "Realized P&L" },
  "history.stat.closedTrades": { he: "{n} עסקאות סגורות", en: "{n} closed trades" },
  "history.stat.winRate": { he: "אחוז הצלחה", en: "Win Rate" },
  "history.stat.winsLosses": { he: "{wins} נצחונות · {losses} הפסדים", en: "{wins} wins · {losses} losses" },
  "history.stat.profitFactor": { he: "מקדם רווח", en: "Profit Factor" },
  "history.stat.autoCount": { he: "{n} אוטומטיות", en: "{n} automated" },
  "history.stat.fees": { he: "עמלות מסחר", en: "Trading Fees" },
  "history.stat.feesSub": { he: "סה\"כ עמלות", en: "Total fees" },
  "history.stat.bestTrade": { he: "העסקה הטובה ביותר", en: "Best Trade" },
  "history.stat.worstTrade": { he: "העסקה הגרועה ביותר", en: "Worst Trade" },

  // Filters
  "history.filter.type": { he: "סוג", en: "Type" },
  "history.filter.result": { he: "תוצאה", en: "Result" },
  "history.filter.source": { he: "מקור", en: "Source" },
  "history.filter.bot": { he: "בוט", en: "Bot" },
  "history.filter.all": { he: "הכל", en: "All" },
  "history.filter.wins": { he: "רווחים", en: "Wins" },
  "history.filter.losses": { he: "הפסדים", en: "Losses" },
  "history.filter.auto": { he: "אוטומטי", en: "Auto" },
  "history.filter.manual": { he: "ידני", en: "Manual" },
  "history.botPanelHint": { he: "{title} — לחץ על החץ לפתיחת לוח הבוט", en: "{title} — click the arrow to open the bot panel" },
  "history.openBotPanel": { he: "פתח לוח {title}", en: "Open {title} panel" },

  // Type labels
  "history.type.binance": { he: "פיוצ'רס", en: "Futures" },
  "history.type.stock": { he: "מניות", en: "Stocks" },
  "history.type.polymarket": { he: "הימור", en: "Bet" },
  "history.type.funding": { he: "מימון", en: "Funding" },
  "history.type.option": { he: "אופציות", en: "Options" },

  // Time / duration
  "history.time.now": { he: "עכשיו", en: "now" },
  "history.time.minutesAgo": { he: "לפני {n} ד׳", en: "{n}m ago" },
  "history.time.hoursAgo": { he: "לפני {n} ש׳", en: "{n}h ago" },
  "history.time.daysAgo": { he: "לפני {n} י׳", en: "{n}d ago" },
  "history.dur.minutes": { he: "{m} ד׳", en: "{m}m" },
  "history.dur.hoursMinutes": { he: "{h} ש׳ {m} ד׳", en: "{h}h {m}m" },
  "history.dur.daysHours": { he: "{d} י׳ {h} ש׳", en: "{d}d {h}h" },

  // Equity curve
  "history.equity.title": { he: "עקומת ההון", en: "Equity Curve" },
  "history.tradesCount": { he: "{n} עסקאות", en: "{n} trades" },
  "history.equity.return": { he: "תשואה", en: "Return" },
  "history.equity.peak": { he: "שיא", en: "Peak" },
  "history.equity.maxDD": { he: "DD מקס׳", en: "Max DD" },
  "history.equity.now": { he: "כעת", en: "Now" },
  "history.equity.tradeNum": { he: "עסקה #{n}", en: "Trade #{n}" },
  "history.equity.start": { he: "התחלה · ${amount}", en: "Start · ${amount}" },
  "history.equity.hoverHint": { he: "← רחף לפרטי עסקה →", en: "← hover for trade details →" },
  "history.equity.nowAmount": { he: "כעת · ${amount}", en: "Now · ${amount}" },

  // Open positions
  "history.openPositions": { he: "פוזיציות פתוחות", en: "Open Positions" },
  "history.unit.crypto": { he: "קריפטו", en: "crypto" },
  "history.unit.stocks": { he: "מניות", en: "stocks" },
  "history.unit.bets": { he: "הימורים", en: "bets" },
  "history.predictionMarkets": { he: "שוקי חיזוי", en: "Prediction Markets" },
  "history.viewChart": { he: "צפה בגרף", en: "View chart" },
  "history.viewPredictionMarket": { he: "צפה בשוק החיזוי", en: "View prediction market" },
  "history.entry": { he: "כניסה", en: "Entry" },
  "history.market": { he: "שוק", en: "Market" },
  "history.closeAt": { he: "סגור @ ${price}", en: "Close @ ${price}" },
  "history.close": { he: "סגור", en: "Close" },
  "history.sharesAt": { he: "{shares} מניות @ ${price}", en: "{shares} shares @ ${price}" },
  "history.unitsEntry": { he: "{units} יחידות · כניסה ${price}", en: "{units} units · entry ${price}" },

  // Hover tooltip
  "history.tooltip.auto": { he: "(אוטו)", en: "(auto)" },
  "history.tooltip.entryExit": { he: "כניסה → יציאה", en: "Entry → Exit" },
  "history.tooltip.leverage": { he: "מינוף", en: "Leverage" },
  "history.tooltip.margin": { he: "מרג'ין", en: "Margin" },
  "history.tooltip.proceeds": { he: "תמורה", en: "Proceeds" },
  "history.tooltip.fees": { he: "עמלות", en: "Fees" },
  "history.tooltip.pnlNet": { he: "רווח / הפסד (נטו)", en: "P&L (net)" },
  "history.tooltip.viewDetails": { he: "צפה בפרטי העסקה", en: "View trade details" },

  // Table columns / rows
  "history.col.trade": { he: "עסקה", en: "Trade" },
  "history.col.exit": { he: "יציאה", en: "Exit" },
  "history.col.margin": { he: "מרג'ין", en: "Margin" },
  "history.col.pnl": { he: "רווח/הפסד", en: "P&L" },
  "history.col.when": { he: "מתי", en: "When" },
  "history.tradesInGroup": { he: "{n} חזיוניות באותו הסווג", en: "{n} trades in this group" },
  "history.groupTrades": { he: "{n} טרידים", en: "{n} trades" },
  "history.marginAmount": { he: "מרג'ין ${amount}", en: "Margin ${amount}" },

  // Share
  "history.share.text": {
    he: "🚀 רווח וירטואלי של ${amount} על {symbol} ב-Heavy Guard!\n\nמסחר נייר — הדמיה חינוכית בלבד, ללא כסף אמיתי.",
    en: "🚀 Virtual profit of ${amount} on {symbol} with Heavy Guard!\n\nPaper trading — educational simulation only, no real money.",
  },
  "history.share.title": { he: "Heavy Guard — רווח נייר 🚀", en: "Heavy Guard — Paper Profit 🚀" },
  "history.share.copiedTitle": { he: "הועתק ✓", en: "Copied ✓" },
  "history.share.copiedDesc": { he: "הטקסט הועתק — הדבק אותו בכל מקום שתרצה.", en: "Text copied — paste it anywhere you like." },
  "history.share.btnTitle": { he: "שתף רווח 🚀", en: "Share profit 🚀" },
  "history.share.btnAria": { he: "שתף רווח", en: "Share profit" },
  "history.assetFallback": { he: "נכס", en: "asset" },

  // ── Insights page / engine (shared bot-perf labels used by History too) ──
  "insights.botPerformance": { he: "ביצועי בוטים", en: "Bot Performance" },
  "insights.activeCount": { he: "{n} פעילים", en: "{n} active" },
  "insights.stat.trades": { he: "עסקאות", en: "Trades" },
  "insights.stat.success": { he: "הצלחה", en: "Win %" },
  "insights.stat.avg": { he: "ממוצע", en: "Avg" },

  "insights.title": { he: "ניתוח ותובנות", en: "Analysis & Insights" },
  "insights.subtitle": {
    he: "ביצועים, מסקנות ותובנות מבוססות-חוקים על כל השווקים שהצי נוגע בהם — קריפטו, מניות, הימורים ואופציות. למטרות לימוד בלבד.",
    en: "Rule-based performance, conclusions, and insights across every market the fleet touches — crypto, stocks, bets, and options. For educational purposes only.",
  },
  "insights.noChartData": { he: "אין מספיק נתונים לגרף", en: "Not enough data for a chart" },
  "insights.best": { he: "הטוב ביותר", en: "Best" },
  "insights.worst": { he: "החלש ביותר", en: "Weakest" },
  "insights.openPositionsCount": { he: "{n} פוזיציות פתוחות", en: "{n} open positions" },
  "insights.invested": { he: "${amount} מושקע", en: "${amount} invested" },
  "insights.selectivity": { he: "סלקטיביות ×{x}", en: "Selectivity ×{x}" },
  "insights.summary.totalTrades": { he: "סך עסקאות", en: "Total Trades" },
  "insights.summary.inGreen": { he: "{n} בירוק", en: "{n} in green" },
  "insights.summary.winRate": { he: "אחוז הצלחה", en: "Win Rate" },
  "insights.summary.netPnl": { he: "רווח/הפסד מצטבר", en: "Cumulative P&L" },
  "insights.summary.openPositions": { he: "פוזיציות פתוחות", en: "Open Positions" },
  "insights.byMarket": { he: "פילוח לפי אפיק שוק", en: "Breakdown by Market" },
  "insights.noClassData": { he: "אין עדיין נתונים לפי אפיק.", en: "No market breakdown data yet." },
  "insights.topAssets": { he: "נכסים מובילים (מטבעות / מניות / אופציות)", en: "Top assets (coins / stocks / options)" },
  "insights.challengingAssets": { he: "נכסים מאתגרים", en: "Challenging assets" },
  "insights.tradesAbbr": { he: "עס׳", en: "tr" },
  "insights.noProfitAsset": { he: "אין עדיין נכס ברווח.", en: "No profitable asset yet." },
  "insights.noLossAsset": { he: "אין עדיין נכס בהפסד.", en: "No losing asset yet." },
  "insights.risingCaution": { he: "זהירות עולה לפי נכס", en: "Rising caution by asset" },
  "insights.cautionNote": {
    he: "ככל שהמכפיל גבוה יותר, הסוכן דורש סטאפ חזק יותר לפני כניסה חוזרת לאותו נכס.",
    en: "The higher the multiplier, the stronger the setup the agent requires before re-entering that asset.",
  },
  "insights.conclusionsTitle": { he: "מסקנות (מבוסס-חוקים, ללא AI בתשלום)", en: "Conclusions (rule-based, no paid AI)" },

  // Insights asset-class labels (insights.ts)
  "insights.class.binance": { he: "קריפטו (פיוצ'רס)", en: "Crypto (Futures)" },
  "insights.class.stock": { he: "מניות", en: "Stocks" },
  "insights.class.polymarket": { he: "הימורי שוק", en: "Prediction Bets" },
  "insights.class.option": { he: "אופציות", en: "Options" },
  "insights.class.funding": { he: "מימון דלתא-נייטרל", en: "Delta-Neutral Funding" },

  // Insights bot titles (insights.ts)
  "insights.bot.scalp": { he: "סקאלפ", en: "Scalp" },
  "insights.bot.momentum": { he: "מומנטום", en: "Momentum" },
  "insights.bot.smart": { he: "כסף חכם", en: "Smart Money" },
  "insights.bot.dipbuyer": { he: "קונה ירידות", en: "Dip Buyer" },
  "insights.bot.breakout": { he: "צייד פריצות", en: "Breakout Hunter" },
  "insights.bot.dca": { he: "צבירת בלו-צ'יפ", en: "Blue-Chip DCA" },
  "insights.bot.poly": { he: "הימורי קריפטו", en: "Crypto Bets" },
  "insights.bot.funding": { he: "מימון", en: "Funding" },
  "insights.bot.options": { he: "אופציות", en: "Options" },

  // Insights rule-based conclusions (insights.ts)
  "insights.concl.empty": {
    he: "עדיין אין עסקאות סגורות לניתוח — הפעל את הבוטים וכשייסגרו עסקאות, כאן יופיעו תובנות מבוססות-חוקים על האפיקים והבוטים.",
    en: "No closed trades to analyze yet — start the bots, and as trades close, rule-based insights about your markets and bots will appear here.",
  },
  "insights.concl.overall": {
    he: "סך הכול {trades} עסקאות סגורות, {winRate}% מהן בירוק, רווח/הפסד מצטבר {net}.",
    en: "{trades} closed trades in total, {winRate}% of them in the green, cumulative P&L {net}.",
  },
  "insights.concl.bestClass": {
    he: "האפיק החזק ביותר עד כה: {label} ({net} על {trades} עסקאות, {winRate}% הצלחה).",
    en: "Strongest market so far: {label} ({net} over {trades} trades, {winRate}% win rate).",
  },
  "insights.concl.worstClass": {
    he: "האפיק שמתקשה ביותר: {label} ({net}, {winRate}% הצלחה) — נצפתה חולשה יחסית, מקום לזהירות.",
    en: "Most challenged market: {label} ({net}, {winRate}% win rate) — relative weakness observed, room for caution.",
  },
  "insights.concl.bestSymbol": {
    he: "הנכס הבולט לטובה: {symbol} ({net} על {trades} עסקאות).",
    en: "Standout asset: {symbol} ({net} over {trades} trades).",
  },
  "insights.concl.worstSymbol": {
    he: "הנכס המאתגר ביותר: {symbol} ({net} על {trades} עסקאות).",
    en: "Most challenging asset: {symbol} ({net} over {trades} trades).",
  },
  "insights.concl.bestBot": {
    he: "הבוט המוביל: {title} ({net}, {winRate}% הצלחה).",
    en: "Top bot: {title} ({net}, {winRate}% win rate).",
  },
  "insights.concl.worstBot": {
    he: "הבוט שמתקשה: {title} ({net}, {winRate}% הצלחה).",
    en: "Struggling bot: {title} ({net}, {winRate}% win rate).",
  },
  "insights.concl.caution": {
    he: "הסוכן מעלה זהירות על נכסים שחזרו להפסיד עליהם: {list} — נדרש שם סטאפ חזק יותר לפני כניסה נוספת.",
    en: "The agent is raising caution on assets that returned to losses: {list} — a stronger setup is required there before re-entry.",
  },
  "insights.concl.trendUp": {
    he: "המגמה האחרונה חיובית — העסקאות האחרונות הצטברו ל-{net}.",
    en: "Recent trend is positive — the latest trades added up to {net}.",
  },
  "insights.concl.trendDown": {
    he: "המגמה האחרונה שלילית — העסקאות האחרונות הצטברו ל-{net}; שלב טוב להגביר סלקטיביות.",
    en: "Recent trend is negative — the latest trades added up to {net}; a good time to increase selectivity.",
  },
  "insights.concl.lowWinRate": {
    he: "אחוז ההצלחה הכולל נמוך מ-45% — מבחינה לימודית כדאי לבחון הידוק ספי כניסה והקטנת חשיפה.",
    en: "Overall win rate is below 45% — for learning purposes, consider tightening entry thresholds and reducing exposure.",
  },
  "insights.concl.disclaimer": {
    he: "כל התובנות מבוססות-חוקים ולמטרות לימוד בלבד — אינן ייעוץ פיננסי ואינן הבטחה לתשואה.",
    en: "All insights are rule-based and for educational purposes only — not financial advice and not a return guarantee.",
  },

  // ── Tools page ──
  "tools.title": { he: "כלי סחור", en: "Trading Tools" },
  "tools.subtitle": {
    he: "כל המחשבונים האלה מיועדים לשוק האמיתי — הובה אותם לחינוכיה והדמיה בלבד. אין כאן ייעוץ השקעות או הבטחת תשואות.",
    en: "All these calculators relate to real markets — treat them as educational and for simulation only. No investment advice or return guarantees here.",
  },
  "tools.comingSoon": { he: "כלים נוספים בדרך …", en: "More tools on the way …" },
  "tools.comingSoonSub": { he: "מחשבונים נוספים יובאו בהמשך הדרך.", en: "Additional calculators will be added down the road." },
  "tools.leverage": { he: "מינוף (×)", en: "Leverage (×)" },
  "tools.crypto": { he: "קריפטו", en: "Crypto" },
  "tools.stocks": { he: "מניות", en: "Stocks" },
  "tools.direction": { he: "כיוון", en: "Direction" },
  "tools.long": { he: "לונג", en: "Long" },
  "tools.short": { he: "שורט", en: "Short" },
  "tools.entryPrice": { he: "מחיר כניסה", en: "Entry price" },
  "tools.stopPrice": { he: "מחיר סטופ", en: "Stop price" },
  "tools.targetPrice": { he: "מחיר יעד", en: "Target price" },
  "tools.exitPrice": { he: "מחיר יציאה", en: "Exit price" },
  "tools.qty": { he: "כמות", en: "Quantity" },

  "tools.posSize.title": { he: "מחשבון גודל פוזיציה", en: "Position Size Calculator" },
  "tools.posSize.desc": { he: "חשב כמה להזין כדי להגן על סכום הסיכון שהגדרת.", en: "Calculate how much to enter to protect the risk amount you set." },
  "tools.posSize.capital": { he: "הון הסוחר ($)", en: "Trader capital ($)" },
  "tools.posSize.riskPct": { he: "סיכון באחוז (%)", en: "Risk percentage (%)" },
  "tools.posSize.entry": { he: "מחיר כניסה ($)", en: "Entry price ($)" },
  "tools.posSize.stop": { he: "מחיר סטופ ($)", en: "Stop price ($)" },
  "tools.posSize.riskAmount": { he: "סיכון מוגדר (הפסד מוריד)", en: "Defined risk (max loss)" },
  "tools.posSize.sizePosition": { he: "גודל פוזיציה", en: "Position size" },
  "tools.posSize.sizeShares": { he: "גודל מניות", en: "Shares" },
  "tools.posSize.notional": { he: "שווי פוזיציה", en: "Position value" },
  "tools.posSize.margin": { he: "מארג'ין דרוש", en: "Required margin" },
  "tools.posSize.rSingle": { he: "R בודד", en: "Single R" },

  "tools.rr.title": { he: "מחשבון סיכון / סיכוי", en: "Risk / Reward Calculator" },
  "tools.rr.desc": { he: "בדוק לפני שאתה נכנס: האם התוכנית שווה את הסיכון?", en: "Check before you enter: is the plan worth the risk?" },
  "tools.rr.risk": { he: "סיכון (מחיר היחסי)", en: "Risk (relative price)" },
  "tools.rr.reward": { he: "סיכוי (מחיר היחסי)", en: "Reward (relative price)" },
  "tools.rr.slPctNoLev": { he: "% סטופ בלא מינוף", en: "Stop % without leverage" },
  "tools.rr.tpPctNoLev": { he: "% תוואה בלא מינוף", en: "Target % without leverage" },
  "tools.rr.slPctLev": { he: "% סטופ עם מינוף", en: "Stop % with leverage" },
  "tools.rr.tpPctLev": { he: "% תוואה עם מינוף", en: "Target % with leverage" },
  "tools.rr.minWin": { he: "אחוז הצלחה המינימאלי הדרוש", en: "Minimum required win rate" },

  "tools.pnl.title": { he: "מחשבון רווח / הפסד", en: "Profit / Loss Calculator" },
  "tools.pnl.desc": { he: "הזן עם איזה הייתה עם התוצאות המקויימים.", en: "Enter the trade details to see the resulting outcome." },
  "tools.pnl.gross": { he: "R/P גולי", en: "Gross P&L" },
  "tools.pnl.roi": { he: "ROI על ההון", en: "ROI on capital" },
  "tools.pnl.requiredCapital": { he: "הון נדרש", en: "Required capital" },

  "tools.pip.title": { he: "מחשבון שווי טיק", en: "Tick Value Calculator" },
  "tools.pip.desc": { he: "בדוק כמה שווה כל תזוזה מחיר באוניה שלך.", en: "Check how much each price move is worth for your position." },
  "tools.pip.posSize": { he: "גודל פוזיציה", en: "Position size" },
  "tools.pip.currentPrice": { he: "מחיר נוכחי", en: "Current price" },
  "tools.pip.tickSize": { he: "גודל טיק (מחיר מינימום)", en: "Tick size (minimum price move)" },
  "tools.pip.oneTickValue": { he: "שווי טיק אחד", en: "Value of one tick" },
  "tools.pip.onePctValue": { he: "שווי 1% תזוזה", en: "Value of a 1% move" },

  "tools.compound.title": { he: "תחזית תשואה ויום ימי", en: "Return & Daily Target Forecast" },
  "tools.compound.desc": {
    he: "חינוכי בלבד — החישוב הוא סביב בלבד. בוא הגידול האמיתי הוא בהבדל בין היגונה והיזוז.",
    en: "Educational only — the calculation is an approximation. Real growth depends on discipline and consistency.",
  },
  "tools.compound.startCapital": { he: "הון התחלה", en: "Starting capital" },
  "tools.compound.dailyTargetPct": { he: "% יעד יומי", en: "Daily target %" },
  "tools.compound.days": { he: "מספר ימים", en: "Number of days" },
  "tools.compound.riskPerTrade": { he: "% סיכון לעסקה", en: "Risk per trade %" },
  "tools.compound.winRate": { he: "אחוז הצלחה (%)", en: "Win rate (%)" },
  "tools.compound.dailyTarget": { he: "יעד יומי (הון × %)", en: "Daily target (capital × %)" },
  "tools.compound.evPerTrade": { he: "EV לאוטו (באד האיטה ב-R)", en: "EV per trade (in R)" },
  "tools.compound.expectedResult": { he: "תוצאה חזויה (לא גארוטייה)", en: "Expected result (not guaranteed)" },
  "tools.compound.finalCapital": { he: "הון סופי (חזוי)", en: "Final capital (projected)" },
  "tools.compound.minWin": { he: "אחוז הצלחה המינימאלי דרוש", en: "Minimum required win rate" },

  // ── Auto-analysis summaries (lib/ta.ts) ──
  "analysis.summaryLong": {
    he: "מגמה חזוקה לאחזק יציאה לאורך (אינדיקטורים {n}/{total} בוחרים)",
    en: "Trend favors a long entry ({n}/{total} indicators agree)",
  },
  "analysis.summaryShort": {
    he: "מגמה חזוקה לאחזק יציאה לשוטר (אינדיקטורים {n}/{total} בוחרים)",
    en: "Trend favors a short entry ({n}/{total} indicators agree)",
  },
  "analysis.summaryNeutral": {
    he: "אין מגמה ברורה כרגע — האינדיקטורים מתנגדים",
    en: "No clear trend right now — indicators conflict",
  },
};
