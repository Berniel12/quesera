import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FreshnessBadge } from "@/components/freshness-badge";
import { getAnswerState } from "@/lib/answer-state";

interface QuestionCardProps {
  questionText: string;
  slug: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  oneLiner: string | null;
  snapshotPublishedAt: string | null;
  variant?: "hero" | "compact";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// SVG arc meter — semicircle confidence gauge
function ConfidenceMeter({ confidence, colorClass, size }: { confidence: number; colorClass: string; size: "lg" | "sm" }) {
  const pct = Math.round(confidence * 100);
  const r = size === "lg" ? 40 : 20;
  const stroke = size === "lg" ? 5 : 3;
  const circumference = Math.PI * r; // half circle
  const offset = circumference * (1 - confidence);
  const cx = r + stroke;
  const cy = r + stroke;
  const svgW = (r + stroke) * 2;
  const svgH = r + stroke * 2;

  // Map answer color class to stroke color
  const strokeColor = colorClass.includes("positive")
    ? "hsl(var(--positive))"
    : colorClass.includes("destructive")
      ? "hsl(var(--destructive))"
      : colorClass.includes("warning")
        ? "hsl(var(--warning))"
        : "hsl(var(--navy))";

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
        {/* Glow effect behind the meter */}
        <defs>
          <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track */}
        <path
          d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${svgW - stroke} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* Glow layer */}
        <path
          d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${svgW - stroke} ${cy}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke + 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity="0.15"
          className="animate-glow-pulse"
          filter={`url(#glow-${size})`}
        />

        {/* Fill arc */}
        <path
          d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${svgW - stroke} ${cy}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
          className="animate-meter-fill"
        />
      </svg>

      {/* Percentage inside the arc */}
      <span
        className={`absolute font-mono font-bold animate-count-up ${
          size === "lg" ? "text-lg -bottom-1" : "text-xs -bottom-0.5"
        }`}
        style={{ color: strokeColor }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function QuestionCard({
  questionText,
  slug,
  category,
  direction,
  confidence,
  freshness,
  oneLiner,
  snapshotPublishedAt,
  variant = "hero",
}: QuestionCardProps) {
  const answerState = direction && confidence !== null
    ? getAnswerState({
        direction,
        confidence,
        category,
        disagreement: 0,
      })
    : null;

  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <Card className="group rounded-3xl border-0 bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {/* Top row: category + time + freshness */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {category && (
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {category}
                  </span>
                )}
                {snapshotPublishedAt && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {timeAgo(snapshotPublishedAt)}
                  </span>
                )}
              </div>
              {freshness && <FreshnessBadge freshness={freshness} />}
            </div>

            {/* Question + meter side by side */}
            <div className="flex items-start gap-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl leading-tight group-hover:text-navy/80 transition-colors">
                  {questionText}
                </h2>

                {/* Answer state label */}
                {answerState && (
                  <p className={`mt-3 text-lg font-semibold ${answerState.colorClass} animate-fade-in delay-150`}>
                    {answerState.label}
                  </p>
                )}

                {oneLiner && (
                  <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed max-w-xl line-clamp-2">
                    {oneLiner}
                  </p>
                )}
              </div>

              {/* Confidence meter */}
              {confidence !== null && answerState && (
                <div className="hidden sm:flex flex-shrink-0 pt-2">
                  <ConfidenceMeter
                    confidence={confidence}
                    colorClass={answerState.colorClass}
                    size="lg"
                  />
                </div>
              )}
            </div>

            {/* Bottom strip: mobile meter + view signals */}
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/30">
              {confidence !== null && answerState && (
                <div className="sm:hidden">
                  <ConfidenceMeter
                    confidence={confidence}
                    colorClass={answerState.colorClass}
                    size="sm"
                  />
                </div>
              )}
              <span className="text-xs text-muted-foreground ml-auto group-hover:text-navy transition-colors">
                View live answer
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Compact variant for category lanes
  return (
    <Link href={`/topics/${slug}`}>
      <Card className="group rounded-2xl border-0 bg-card shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 h-full overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Answer state as colored dot + label */}
              {answerState && (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: answerState.colorClass.includes("positive")
                        ? "hsl(var(--positive))"
                        : answerState.colorClass.includes("destructive")
                          ? "hsl(var(--destructive))"
                          : answerState.colorClass.includes("warning")
                            ? "hsl(var(--warning))"
                            : "hsl(var(--muted-foreground))",
                    }}
                  />
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${answerState.colorClass}`}>
                    {answerState.label}
                  </span>
                </div>
              )}

              <p className="font-bold text-sm text-navy leading-snug group-hover:text-navy/80 transition-colors">
                {questionText}
              </p>

              {oneLiner && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {oneLiner}
                </p>
              )}
            </div>

            {/* Mini meter */}
            {confidence !== null && answerState && (
              <div className="flex-shrink-0 pt-1">
                <ConfidenceMeter
                  confidence={confidence}
                  colorClass={answerState.colorClass}
                  size="sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
