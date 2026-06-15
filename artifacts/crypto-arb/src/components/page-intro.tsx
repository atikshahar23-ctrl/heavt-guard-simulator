import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/language-context";

export function PageIntro({ title, description, tip }: { title: string; description: string; tip?: string }) {
  const { dir } = useLanguage();
  return (
    <Alert dir={dir} className="mb-4 border-primary/20 bg-primary/5">
      <div className={`flex items-start gap-2.5 ${dir === "rtl" ? "flex-row-reverse text-right" : "text-left"}`}>
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
        <AlertDescription className="flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-muted-foreground">{description}</p>
          {tip && <p className="mt-1 text-xs text-primary/80">{tip}</p>}
        </AlertDescription>
      </div>
    </Alert>
  );
}
