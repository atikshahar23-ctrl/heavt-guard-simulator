export const advisorStrings: Record<string, Record<"he" | "en", string>> = {
  // Event Calendar page
  "calendar.title": { he: "יומן האירועים", en: "Event Calendar" },
  "calendar.autoBot": { he: "בוט אוטומטי", en: "Auto Bot" },
  "calendar.subtitle": {
    he: "הבוט סורק חדשות, מאתר תאריכים ומסמן אירועים — עם התראה יומיים מראש",
    en: "The bot scans news, detects dates and flags events — with a two-day advance alert",
  },
  "calendar.statMacro": { he: "אירועי מאקרו", en: "Macro Events" },
  "calendar.statNews": { he: "מהחדשות", en: "From News" },
  "calendar.statUpcoming": { he: "יומיים הקרובים", en: "Next Two Days" },
  "calendar.statUpdated": { he: "עודכן", en: "Updated" },
  "calendar.alertTitle": {
    he: "התראות הבוט — אירועים חשובים ביומיים הקרובים",
    en: "Bot alerts — important events in the next two days",
  },
  "calendar.prevMonth": { he: "חודש קודם", en: "Previous month" },
  "calendar.nextMonth": { he: "חודש הבא", en: "Next month" },
  "calendar.legendHigh": { he: "גבוהה", en: "High" },
  "calendar.legendMedium": { he: "בינונית", en: "Medium" },
  "calendar.legendLow": { he: "נמוכה", en: "Low" },
  "calendar.eventsCount": { he: "{n} אירועים", en: "{n} events" },
  "calendar.noEventsDay": { he: "אין אירועים מסומנים ביום זה", en: "No events flagged on this day" },
  "calendar.next2weeks": { he: "השבועיים הקרובים", en: "Next Two Weeks" },
  "calendar.noUpcoming": { he: "אין אירועים קרובים", en: "No upcoming events" },
  "calendar.footer": {
    he: "לימודי בלבד · התאריכים נגזרים מלוח אירועים קבוע ומניתוח כותרות חדשות — אינם ייעוץ פיננסי",
    en: "Educational only · Dates are derived from a fixed event calendar and news-headline analysis — not financial advice",
  },
  "calendar.impactHigh": { he: "השפעה גבוהה", en: "High impact" },
  "calendar.impactMedium": { he: "השפעה בינונית", en: "Medium impact" },
  "calendar.impactLow": { he: "השפעה נמוכה", en: "Low impact" },

  // Master Advisor page (chrome)
  "advisor.title": { he: "היועץ הראשי", en: "Master Advisor" },
  "advisor.subtitle": {
    he: "קריאה אחת מסכמת של השוק והתיק, עם מהלכים מדורגים לאישורך — סימולציה בלבד.",
    en: "One synthesized read of the market and your book, with ranked moves for your approval — simulation only.",
  },
  "advisor.langToggle": { he: "English", en: "עברית" },
  "advisor.disclaimer": {
    he: "היועץ הראשי הוא מנוע חוקים חינוכי בלבד — אינו מבטיח רווחים ואינו ייעוץ השקעות. כל מהלך הוא תרחיש ללימוד שמופעל רק לאחר שתאשר אותו, על תיק נייר.",
    en: "The Master Advisor is a rule-based educational engine only — no promised returns, not financial advice. Every move is a learning scenario that runs only after you approve it, on a paper portfolio.",
  },
  "advisor.readTitle": { he: "הקריאה של היועץ", en: "The Advisor's read" },
  "advisor.market": { he: "שוק", en: "Market" },
  "advisor.portfolio": { he: "תיק", en: "Portfolio" },
  "advisor.riskBias": { he: "נטיית סיכון", en: "Risk bias" },
  "advisor.conviction": { he: "ביטחון בקריאה", en: "Read conviction" },
  "advisor.fleetStanding": { he: "מצב הצי", en: "Fleet standing" },
  "advisor.good": { he: "טובים", en: "good" },
  "advisor.weak": { he: "חלשים", en: "weak" },
  "advisor.pausedPlural": { he: "מושהים", en: "paused" },
  "advisor.paused": { he: "מושהה", en: "paused" },
  "advisor.off": { he: "כבוי", en: "off" },
  "advisor.trades": { he: "עסקאות", en: "trades" },
  "advisor.win": { he: "הצלחה", en: "win" },
  "advisor.walletsRanked": { he: "דירוג הארנקים לפי מזומן פנוי", en: "Wallets ranked by free cash" },
  "advisor.active": { he: "פעיל", en: "active" },
  "advisor.openPositions": { he: "פוזיציות", en: "open" },
  "advisor.cash": { he: "מזומן", en: "cash" },
  "advisor.rankedMoves": { he: "מהלכים מדורגים לאישורך", en: "Ranked moves for your approval" },
  "advisor.moves": { he: "מהלכים", en: "moves" },
  "advisor.noMoves": { he: "אין כרגע מהלך שדורש את תשומת ליבך.", en: "Nothing needs your attention right now." },
  "advisor.noMovesSub": {
    he: "היועץ ימשיך לקרוא את השוק והתיק ויציע מהלך כשיזהה הזדמנות או סיכון.",
    en: "The advisor keeps reading the market and your book, and will surface a move when it spots an opportunity or a risk.",
  },
  "advisor.dismiss": { he: "התעלם", en: "Dismiss" },
  "advisor.watching": { he: "מה שאני עוקב אחריו", en: "What I'm watching" },
  "advisor.footer": {
    he: "כל המהלכים פועלים על תיק נייר בלבד — אין כאן כסף אמיתי, הבטחת תשואה או ייעוץ השקעות.",
    en: "All moves run on a paper portfolio only — no real money, no promised returns, no investment advice.",
  },

  // Master Advisor — tone labels
  "advisor.tone.critical": { he: "הגנה", en: "Protect" },
  "advisor.tone.opportunity": { he: "הזדמנות", en: "Opportunity" },
  "advisor.tone.tune": { he: "כוונון", en: "Tune-up" },

  // Master Advisor — bot names
  "advisor.bot.scalp": { he: "בוט סקאלפ", en: "Scalp Bot" },
  "advisor.bot.momentum": { he: "בוט מומנטום", en: "Momentum Bot" },
  "advisor.bot.smart": { he: "כסף חכם", en: "Smart-Money" },
  "advisor.bot.poly": { he: "פולימרקט BTC", en: "Polymarket BTC" },
  "advisor.bot.dipbuyer": { he: "קונה ירידות", en: "Dip Buyer" },
  "advisor.bot.breakout": { he: "צייד פריצות", en: "Breakout Hunter" },
  "advisor.bot.dca": { he: "DCA שבבי-כחול", en: "Blue-Chip DCA" },

  // Master Advisor — direction & mode words
  "advisor.dir.up": { he: "עולה", en: "up" },
  "advisor.dir.down": { he: "יורד", en: "down" },
  "advisor.mode.calculated": { he: "מחושב", en: "Calculated" },
  "advisor.mode.normal": { he: "רגיל", en: "Normal" },

  // Master Advisor — watch list
  "advisor.watch.scalp": {
    he: "סקאלפ: {asset} בכיוון {dir} בביטחון גבוה — נקודה לעקוב אחריה.",
    en: "Scalp: {asset} leaning {dir} at high confidence — one to watch.",
  },
  "advisor.watch.momentum": {
    he: "מומנטום: {asset} עם זינוק נפח חריג — תרחיש לימוד של פריצה.",
    en: "Momentum: {asset} on an unusual volume surge — a breakout to study.",
  },
  "advisor.watch.smart": {
    he: "כסף חכם: {symbol} מסומן לקנייה בביטחון גבוה — שווה מעקב.",
    en: "Smart money: {symbol} flagged BUY at high confidence — worth tracking.",
  },

  // Master Advisor — action toasts
  "advisor.toast.applied": { he: "היועץ ביצע את המהלך", en: "Advisor applied the move" },
  "advisor.action.armAll": { he: "כל הבוטים חומשו.", en: "All bots armed." },
  "advisor.action.disarmAll": { he: "כל הבוטים כובו.", en: "All bots disarmed." },
  "advisor.action.setIntensity": { he: "הילוך המסחר עודכן לדרגה {n}.", en: "Trading gear set to level {n}." },
  "advisor.action.setTradeMode": { he: "מצב המסחר עודכן ל{mode}.", en: "Trade mode set to {mode}." },
  "advisor.action.setCashFloor": { he: "רזרבת המזומן נקבעה ל-{n} אחוז.", en: "Cash reserve set to {n} percent." },
  "advisor.action.autopilot": { he: "מצב אוטומטי מלא הופעל.", en: "Full Auto-Pilot enabled." },
  "advisor.action.alpha": { he: "מתאם ראובן הודלק.", en: "Reuven's Coordinator enabled." },
  "advisor.action.boost": { he: "בוסט הופעל.", en: "Boost started." },
  "advisor.action.riskManager": { he: "מנהל הסיכונים הודלק.", en: "Risk Manager enabled." },
  "advisor.action.smartExit": { he: "סגירה חכמה הודלקה.", en: "Smart Exit enabled." },
  "advisor.action.dailyStop": { he: "עצירת הפסד יומית הודלקה.", en: "Daily loss stop enabled." },
  "advisor.action.closedN": { he: "{n} פוזיציות בוט נסגרו.", en: "{n} bot positions closed." },
  "advisor.action.closedNone": { he: "לא היו פוזיציות בוט פתוחות.", en: "No open bot positions." },

  // Master Advisor — the read (master-advisor.ts)
  "advisor.dirWord.long": { he: "כיוון עולה", en: "an upward lean" },
  "advisor.dirWord.short": { he: "כיוון יורד", en: "a downward lean" },
  "advisor.dirWord.neutral": { he: "ללא הכרעה ברורה", en: "no clear lean" },
  "advisor.tag.riskOn": { he: "סביבת סיכון חיובית", en: "Risk-on backdrop" },
  "advisor.tag.riskOff": { he: "סביבת סיכון שלילית", en: "Risk-off backdrop" },
  "advisor.tag.mixed": { he: "תמונה מעורבת", en: "Mixed picture" },
  "advisor.read.ddHigh": {
    he: "שים לב — ירידת ערך מוערכת של כ-{n} אחוז מההפקדה.",
    en: "Heads up — estimated drawdown of about {n} percent from deposits.",
  },
  "advisor.read.ddLow": { he: "ירידת הערך עדיין מתונה.", en: "Drawdown is still mild." },
  "advisor.read.sigNone": {
    he: "כרגע אין סיגנל בולט שמושך לכיוון אחד.",
    en: "Right now no single signal is pulling hard in one direction.",
  },
  "advisor.read.sigDetail": {
    he: "על פני המקורות אני רואה {scalpLong} סקאלפ בכיוון עולה ו-{scalpShort} בכיוון יורד, {momentum} זינוקי מומנטום, {stockBuy} מניות לקנייה מול {stockSell} למכירה, ו-{poly} שווקי תחזיות עם הכרעה ברורה.",
    en: "Across the feeds I see {scalpLong} scalp setups leaning up and {scalpShort} leaning down, {momentum} momentum surges, {stockBuy} stocks flagged buy versus {stockSell} sell, and {poly} prediction markets pricing a clear outcome.",
  },
  "advisor.read.fleetIdle": { he: "כל הבוטים כבויים כרגע.", en: "All bots are currently idle." },
  "advisor.read.fleetNoRated": {
    he: "הצי פעיל אך עוד אין מספיק עסקאות סגורות כדי לדרג ביצועים.",
    en: "The fleet is live but there aren't enough closed trades yet to rate performance.",
  },
  "advisor.read.fleetPaused": {
    he: ", {n} מושהים על ידי מנהל הסיכונים",
    en: ", {n} paused by the Risk Manager",
  },
  "advisor.read.fleetMain": {
    he: "הצי: {good} בוטים במצב טוב, {weak} זקוקים לתשומת לב{paused}.",
    en: "Fleet: {good} bots in good shape, {weak} needing attention{paused}.",
  },
  "advisor.read.wallet": {
    he: " מבין {n} הארנקים, הכי הרבה מזומן פנוי יש בארנק {strong}, והכי חשוף הוא {exposed}.",
    en: " Across {n} wallets, the most free cash sits in {strong}, and the most exposed is {exposed}.",
  },
  "advisor.read.headline": {
    he: "קראתי את כל הזירה — {tag}.",
    en: "I've read the whole board — {tag}.",
  },
  "advisor.read.market": {
    he: "ביטקוין {btc} ביממה, רוחב השוק {avg}, ומדד הסנטימנט עומד על {fg}. הקונצנזוס של המערכת מצביע על {dir} במתאם של {confluence} אחוז על פני {sources} מקורות סיגנל. {sig}",
    en: "Bitcoin {btc} on the day, market breadth {avg}, and the sentiment gauge sits at {fg}. The system's consensus shows {dir} at {confluence} percent confluence across {sources} signal sources. {sig}",
  },
  "advisor.read.portfolio": {
    he: "בארנק הפעיל יש כ-{cashPct} אחוז מזומן פנוי, {openAuto} פוזיציות בוט פתוחות, ותוצאה יומית ממומשת של {daily}. {fleet}{wallet} {dd}",
    en: "The active wallet holds about {cashPct} percent free cash, {openAuto} open bot positions, and a realized result today of {daily}. {fleet}{wallet} {dd}",
  },

  // Master Advisor — moves
  "advisor.move.close.title": { he: "להקטין חשיפה עכשיו", en: "Reduce exposure now" },
  "advisor.move.close.body": {
    he: "ההפסד היום והירידה בערך מצטברים. תרחיש להגנת הון: לסגור את כל פוזיציות הבוט הפתוחות ({n}) ולחזור למזומן. זו פעולה חינוכית בלבד.",
    en: "Today's loss and the equity dip are adding up. A capital-protection scenario: close every open bot position ({n}) and step back to cash. Educational action only.",
  },
  "advisor.move.close.cta": { he: "סגור את כל פוזיציות הבוט", en: "Close all bot positions" },
  "advisor.move.calc.reasonRed": { he: "אחרי יום אדום", en: "After a red day" },
  "advisor.move.calc.reasonWeak": { he: "{n} מהבוטים שלך מתקשים", en: "{n} of your bots are struggling" },
  "advisor.move.calc.title": { he: "לעבור למצב מחושב", en: "Shift to Calculated mode" },
  "advisor.move.calc.body": {
    he: "{reason}, מצב מחושב הופך את כל הצי לסבלני ובררן הרבה יותר — פחות עסקאות, סף כניסה גבוה יותר, ושמירה על רווחים לאורך זמן.",
    en: "{reason}, Calculated mode makes the whole fleet far more patient and selective — fewer trades, a higher entry bar, and longer holds on winners.",
  },
  "advisor.move.calc.cta": { he: "הפעל מצב מחושב", en: "Enable Calculated mode" },
  "advisor.move.cashFloor.title": { he: "להעלות את רזרבת המזומן", en: "Raise the cash reserve" },
  "advisor.move.cashFloor.body": {
    he: "המזומן הפנוי דק יחסית. תרחיש הגנתי: להעלות את רצפת המזומן ל-{n} אחוז כך שהבוטים לעולם לא ירוצו את החשבון עד הסוף.",
    en: "Free cash is getting thin. A defensive scenario: lift the cash floor to {n} percent so the bots never run the account down to nothing.",
  },
  "advisor.move.cashFloor.cta": { he: "קבע רזרבת מזומן {n} אחוז", en: "Set {n} percent cash reserve" },
  "advisor.move.risk.weakNote": { he: " כבר {n} בוטים מפסידים — ", en: " Already {n} bots are losing — " },
  "advisor.move.risk.title": { he: "להדליק את מנהל הסיכונים", en: "Turn on the Risk Manager" },
  "advisor.move.risk.body": {
    he: "הבוטים פעילים אך מנהל הסיכונים כבוי.{weakNote}הוא משהה אוטומטית בוט שמפסיד ברצף או חוצה גבול הפסד יומי — שכבת הגנה בסיסית.",
    en: "Bots are live but the Risk Manager is off.{weakNote}It auto-pauses a bot on a losing streak or a daily-loss breach — a baseline safety layer.",
  },
  "advisor.move.risk.cta": { he: "הדלק מנהל סיכונים", en: "Enable Risk Manager" },
  "advisor.move.arm.confirmNote": {
    he: " הסיגנלים החיים מאשרים את הכיוון.",
    en: " The live signals confirm the direction.",
  },
  "advisor.move.arm.title": { he: "להפעיל את הצי על ההתכנסות", en: "Arm the fleet on convergence" },
  "advisor.move.arm.body": {
    he: "המקורות מתכנסים ל{dir} במתאם {confluence} אחוז והארנק במצב בריא.{confirm} תרחיש ללימוד: לחמש את כל הבוטים כדי לפעול על ההסכמה.",
    en: "Sources are converging on {dir} at {confluence} percent confluence and the wallet is healthy.{confirm} A learning scenario: arm the bots to act on the agreement.",
  },
  "advisor.move.arm.cta": { he: "הפעל את כל הבוטים", en: "Arm all bots" },
  "advisor.move.intUp.title": { he: "להעלות הילוך מסחר", en: "Raise the trading gear" },
  "advisor.move.intUp.body": {
    he: "ההתכנסות חזקה והתיק בריא. תרחיש: להעלות את הילוך המסחר לדרגה {n} כדי לפעול מעט יותר על ההזדמנות.",
    en: "Convergence is strong and the book is healthy. Scenario: move the trading gear up to level {n} to lean a little more into the opportunity.",
  },
  "advisor.move.intUp.cta": { he: "העלה הילוך לדרגה {n}", en: "Raise gear to level {n}" },
  "advisor.move.intDown.title": { he: "להוריד הילוך בשוק מבולבל", en: "Ease the gear in a choppy tape" },
  "advisor.move.intDown.body": {
    he: "אין כרגע הכרעה בין המקורות. בשוק ללא כיוון ברור, תרחיש שמרני הוא להוריד את הילוך המסחר לדרגה {n} ולסחור פחות.",
    en: "Sources aren't agreeing right now. With no clear direction, a conservative scenario is to drop the trading gear to level {n} and trade less.",
  },
  "advisor.move.intDown.cta": { he: "הורד הילוך לדרגה {n}", en: "Lower gear to level {n}" },
  "advisor.move.cashBase.title": { he: "להגדיר רזרבת מזומן", en: "Set a cash reserve" },
  "advisor.move.cashBase.body": {
    he: "אין כרגע רצפת מזומן מוגדרת. תרחיש בסיסי לניהול הון: לשמור {n} אחוז מהחשבון תמיד פנויים.",
    en: "There's no cash floor set. A basic money-management scenario: always keep {n} percent of the account free.",
  },
  "advisor.move.alpha.title": { he: "להדליק את מתאם ראובן", en: "Turn on Reuven's Coordinator" },
  "advisor.move.alpha.body": {
    he: "מתאם ראובן מאחד את הסיגנלים לכיוון אחד ומאפשר לבוטים לפעול כמערך מתואם — כניסות קלות יותר כשמסכימים, מחמירות יותר כשמתנגדים.",
    en: "Reuven's Coordinator fuses signals into one direction so the bots act as a coordinated formation — easier entries when aligned, stricter when fighting it.",
  },
  "advisor.move.alpha.cta": { he: "הדלק את מתאם ראובן", en: "Enable Reuven's Coordinator" },
  "advisor.move.smartExit.title": { he: "להדליק סגירה חכמה", en: "Turn on Smart Exit" },
  "advisor.move.smartExit.body": {
    he: "סגירה חכמה נועלת רווחים קטנים מהר אך נותנת לעסקאות חזקות לרוץ. שכבת ניהול יציאה בסיסית לכל עסקאות הקריפטו של הבוטים.",
    en: "Smart Exit banks small wins fast but lets strong trades run. A baseline exit-management layer for all the bots' crypto trades.",
  },
  "advisor.move.smartExit.cta": { he: "הדלק סגירה חכמה", en: "Enable Smart Exit" },
  "advisor.move.dailyStop.title": { he: "להדליק עצירת הפסד יומית", en: "Turn on the daily loss stop" },
  "advisor.move.dailyStop.body": {
    he: "עצירת הפסד יומית מפסיקה לפתוח עסקאות חדשות אחרי שההפסד היומי חוצה את הסף — בלם פשוט לימים גרועים.",
    en: "The daily loss stop halts new trades once the day's loss crosses the limit — a simple brake for bad days.",
  },
  "advisor.move.dailyStop.cta": { he: "הדלק עצירה יומית", en: "Enable daily stop" },
  "advisor.move.autopilot.title": { he: "להעביר לטייס אוטומטי", en: "Hand over to Auto-Pilot" },
  "advisor.move.autopilot.body": {
    he: "התנאים יציבים. תרחיש להתנסות: להפעיל טייס אוטומטי — המערכת קובעת לבד גודל עסקה, מינוף, SL/TP וכל שכבות הניהול. סימולציה בלבד.",
    en: "Conditions are steady. A scenario to try: enable Auto-Pilot — the system sizes trades, leverage, SL/TP and runs the full management stack itself. Simulation only.",
  },
  "advisor.move.autopilot.cta": { he: "הפעל טייס אוטומטי", en: "Enable Auto-Pilot" },

  // Briefing — scenario bodies & extras
  "briefing.scenario.btcUp.body": {
    he: "BTC {pct}% ביממה. בשעתיים הקרובות שווה לעקוב אם הוא מחזיק מעל ${price} — אזור שבירה כלפי מטה יבטל את התמונה החיובית. נקודה ללימוד: לזהות מתי מומנטום נחלש.",
    en: "BTC {pct}% in 24h. Watch the next 2 hours: if it holds above ${price}, the bullish picture stays intact. Learning point: identify when momentum starts fading.",
  },
  "briefing.scenario.btcDown.body": {
    he: "BTC {pct}% ביממה. בשעתיים הקרובות שווה לראות אם נוצר ייצוב סביב ${low} (שפל היום). תרחיש ללימוד: ההבדל בין דשדוש לבין המשך ירידה.",
    en: "BTC {pct}% in 24h. Watch for stabilisation near ${low} (today's low). Scenario to study: the difference between consolidation and continued decline.",
  },
  "briefing.scenario.btcFlat.body": {
    he: "BTC זז רק {pct}% ביממה ונע בין ${low} ל-${high}. בשוק צר כדאי ללמוד לזהות פריצה של הטווח לפני שנכנסים.",
    en: "BTC moved only {pct}% in 24h, ranging ${low} – ${high}. In a tight range, the lesson is: wait for a range break before entering.",
  },
  "briefing.scenario.breadthUp.body": {
    he: "הקריפטו רחב — בממוצע {avg}% על המטבעות המובילים. בתרחיש כזה מטבעות חזקים נוטים להוביל; נקודת לימוד: לעקוב מי מוביל ומי מפגר.",
    en: "Crypto breadth is positive — average {avg}% across top coins. In this scenario, strongest coins tend to lead. Learning point: track who leads and who lags.",
  },
  "briefing.scenario.breadthDown.body": {
    he: "ירידה רוחבית, בממוצע {avg}%. כשהכול אדום, סטאפים נגד המגמה מסוכנים יותר — תרגיל טוב לסבלנות ולשמירה על הון.",
    en: "Broad decline, average {avg}%. When everything is red, counter-trend setups are riskier — a good exercise in patience and capital preservation.",
  },
  "briefing.scenario.fg.title": { he: "מדד פחד/חמדנות: {n}", en: "Fear/Greed Index: {n}" },
  "briefing.scenario.fg.body": {
    he: "הסנטימנט הכללי הוא \"{cls}\". מדד קיצוני (פחד או חמדנות) מלמד לרוב על רגש בשוק — הזדמנות ללמוד למה קצוות רגשיים נוטים להתהפך.",
    en: "Overall sentiment: \"{cls}\". An extreme reading (fear or greed) usually reflects elevated emotion — a chance to learn why emotional extremes tend to reverse.",
  },
  "briefing.scenario.specialDay.body": {
    he: "{label}. בימים כאלה התנודתיות גבוהה מהרגיל — שיעור חשוב: אירועי לוח שנה משפיעים על השוק עוד לפני שמשהו \"קורה\".",
    en: "{label}. On days like this, volatility is typically higher than usual — key lesson: calendar events affect the market even before anything \"happens\".",
  },
  "briefing.row.rate15m": { he: "קצב 15ד׳", en: "15m rate" },
  "briefing.opp.scalpTail": {
    he: "לכיוון {dir} (כניסה ${entry}, יעד ${tp}, סטופ ${sl}).",
    en: "{dir} (entry ${entry}, target ${tp}, stop ${sl}).",
  },
  "briefing.opp.momTail": {
    he: "עם נפח יחסי פי {rvol} וקצב עלייה {roc}% ב-15 דק׳.",
    en: "RVol ×{rvol}, rate {roc}% in 15 min.",
  },
};
