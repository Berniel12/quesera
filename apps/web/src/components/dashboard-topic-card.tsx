import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DirectionBadge } from "./direction-badge";
import { FreshnessBadge } from "./freshness-badge";
import { ConfidenceBar } from "./confidence-bar";
import { Badge } from "@/components/ui/badge";

interface DashboardTopicCardProps {
  slug: string;
  canonicalName: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  oneLiner: string | null;
  hasChanges: boolean;
  priorDirection?: string;
  currentDirection?: string;
}

export function DashboardTopicCard({
  slug,
  canonicalName,
  category,
  direction,
  confidence,
  freshness,
  oneLiner,
  hasChanges,
  priorDirection,
  currentDirection,
}: DashboardTopicCardProps) {
  return (
    <Link href={`/dashboard/topics/${slug}`}>
      <Card className="group h-full rounded-3xl border-border/40 bg-card p-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-border hover:shadow-sm">
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-tight tracking-tight group-hover:text-navy transition-colors">
              {canonicalName}
            </h3>
            {direction && <DirectionBadge direction={direction} size="sm" />}
          </div>

          {hasChanges && (
            <Badge
              variant="outline"
              className="w-fit rounded-full border-warning/30 bg-warning/10 text-warning text-xs"
            >
              {priorDirection && currentDirection && priorDirection !== currentDirection
                ? `Shifted: ${priorDirection} \u2192 ${currentDirection}`
                : "Updated since last visit"}
            </Badge>
          )}

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
