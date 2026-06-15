import { Link } from "wouter";
import {
  LifeBuoy, Briefcase, Globe, Target, Bot, BookOpen, ArrowRight, ArrowLeft,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

type GuideGroup = {
  icon: typeof Briefcase;
  titleKey: string;
  descKey: string;
  links: { href: string; labelKey: string }[];
};

const GROUPS: GuideGroup[] = [
  {
    icon: Briefcase,
    titleKey: "nav.privateOffice",
    descKey: "nav.privateOffice.desc",
    links: [
      { href: "/", labelKey: "nav.dashboard" },
      { href: "/simulator", labelKey: "nav.simulator" },
      { href: "/advisor", labelKey: "nav.advisor" },
    ],
  },
  {
    icon: Globe,
    titleKey: "nav.globalMarkets",
    descKey: "nav.globalMarkets.desc",
    links: [
      { href: "/markets", labelKey: "nav.markets" },
      { href: "/stocks", labelKey: "nav.stocks" },
      { href: "/recommendations", labelKey: "nav.recommendations" },
    ],
  },
  {
    icon: Target,
    titleKey: "nav.algorithmics",
    descKey: "nav.algorithmics.desc",
    links: [
      { href: "/scalp", labelKey: "nav.scalp" },
      { href: "/momentum", labelKey: "nav.momentum" },
      { href: "/signals", labelKey: "nav.signals" },
    ],
  },
  {
    icon: Bot,
    titleKey: "nav.autoActivity",
    descKey: "nav.autoActivity.desc",
    links: [
      { href: "/bots", labelKey: "nav.bots" },
      { href: "/trade-desk", labelKey: "nav.tradeDesk" },
    ],
  },
  {
    icon: BookOpen,
    titleKey: "nav.researchAndTools",
    descKey: "nav.researchAndTools.desc",
    links: [
      { href: "/briefing", labelKey: "nav.briefing" },
      { href: "/history", labelKey: "nav.history" },
      { href: "/settings", labelKey: "nav.settings" },
    ],
  },
];

export default function Guide() {
  const { lang, dir } = useLanguage();
  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5" dir={dir}>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-primary" />
          {t("guide.title", lang)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("guide.subtitle", lang)}</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">{t("guide.firstSteps.title", lang)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 font-mono">1</Badge>
            <p>{t("guide.firstSteps.1", lang)}</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 font-mono">2</Badge>
            <p>{t("guide.firstSteps.2", lang)}</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 font-mono">3</Badge>
            <p>{t("guide.firstSteps.3", lang)}</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <Card key={group.titleKey}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(group.titleKey, lang)}
                </CardTitle>
                <CardDescription>{t(group.descKey, lang)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {t(link.labelKey, lang)}
                    <ArrowIcon className="h-3 w-3" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
