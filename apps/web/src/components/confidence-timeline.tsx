// Server-rendered SVG sparkline of historical snapshots
// Shows confidence trajectory over time with direction-colored dots

interface HistoryEntry {
  version: number;
  direction: string;
  confidence: number;
  published_at: string;
}

interface ConfidenceTimelineProps {
  history: HistoryEntry[];
}

const DIRECTION_COLORS: Record<string, string> = {
  up: "hsl(var(--positive))",
  down: "hsl(var(--destructive))",
  stable: "hsl(var(--muted-foreground))",
  unknown: "hsl(var(--muted-foreground))",
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConfidenceTimeline({ history }: ConfidenceTimelineProps) {
  if (history.length < 2) return null;

  // Reverse so oldest is first (left) and newest is last (right)
  const entries = [...history].reverse();
  const count = entries.length;

  const W = 300;
  const H = 80;
  const PAD_X = 16;
  const PAD_Y = 12;
  const PLOT_W = W - PAD_X * 2;
  const PLOT_H = H - PAD_Y * 2;

  const points = entries.map((entry, i) => ({
    x: count === 1 ? W / 2 : PAD_X + (i / (count - 1)) * PLOT_W,
    y: PAD_Y + (1 - entry.confidence) * PLOT_H,
    color: DIRECTION_COLORS[entry.direction] ?? DIRECTION_COLORS.unknown,
    confidence: entry.confidence,
    direction: entry.direction,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const lastPoint = points[points.length - 1];
  const firstDate = formatShortDate(entries[0].published_at);
  const lastDate = formatShortDate(entries[entries.length - 1].published_at);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Confidence timeline showing how this answer has changed over time"
      >
        {/* Subtle grid lines */}
        <line x1={PAD_X} y1={PAD_Y} x2={W - PAD_X} y2={PAD_Y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1={PAD_X} y1={H / 2} x2={W - PAD_X} y2={H / 2} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />

        {/* Confidence labels */}
        <text x={PAD_X - 2} y={PAD_Y + 3} fontSize="6" fill="hsl(var(--muted-foreground))" textAnchor="end" opacity="0.6">100%</text>
        <text x={PAD_X - 2} y={H / 2 + 2} fontSize="6" fill="hsl(var(--muted-foreground))" textAnchor="end" opacity="0.6">50%</text>
        <text x={PAD_X - 2} y={H - PAD_Y + 3} fontSize="6" fill="hsl(var(--muted-foreground))" textAnchor="end" opacity="0.6">0%</text>

        {/* Connecting line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={i}>
              {isLast && (
                <circle cx={p.x} cy={p.y} r="6" fill={p.color} opacity="0.2">
                  <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 4 : 3}
                fill={p.color}
              />
            </g>
          );
        })}
      </svg>

      {/* Date range */}
      <div className="flex justify-between px-4 mt-1">
        <span className="text-[10px] text-muted-foreground font-mono">{firstDate}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{lastDate}</span>
      </div>
    </div>
  );
}
