import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DirectionBadge } from "./direction-badge";
import { FreshnessBadge } from "./freshness-badge";
import { ConfidenceBar } from "./confidence-bar";

interface TopicCardProps {
  slug: string;
  canonicalName: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  oneLiner: string | null;
}

export function TopicCard({
  slug,
  canonicalName,
  category,
  direction,
  confidence,
  freshness,
  oneLiner,
}: TopicCardProps) {
  return (
    <Link href={`/topics/${slug}`}>
      <Card className="group h-full rounded-3xl border-border/40 bg-card p-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-border hover:shadow-sm">
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-tight tracking-tight group-hover:text-navy transition-colors">
              {canonicalName}
            </h3>
            {direction && <DirectionBadge direction={direction} size="sm" />}
          </div>

          {oneLiner && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {oneLiner}
            </p>
          )}

          <div className="flex items-center justify-between mt-auto pt-2">
            {category && (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {category}
              </span>
            )}
            <div className="flex items-center gap-3">
              {confidence !== null && <ConfidenceBar confidence={confidence} />}
              {freshness && <FreshnessBadge freshness={freshness} />}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
