import { FreshnessBadge } from "./freshness-badge";

interface SignalRowProps {
  sourceName: string;
  signalType: string;
  currentValue: number;
  delta: number | null;
  direction: string;
  freshness: string;
}

export function SignalRow({
  sourceName,
  signalType,
  currentValue,
  delta,
  direction,
  freshness,
}: SignalRowProps) {
  const deltaColor =
    direction === "up"
      ? "text-positive"
      : direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{sourceName}</span>
        <span className="text-xs text-muted-foreground">{signalType}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm">{currentValue.toLocaleString()}</span>
        {delta !== null && (
          <span className={`font-mono text-xs ${deltaColor}`}>
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString()}
          </span>
        )}
        <FreshnessBadge freshness={freshness} />
      </div>
    </div>
  );
}
