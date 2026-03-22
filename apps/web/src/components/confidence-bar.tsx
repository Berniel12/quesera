interface ConfidenceBarProps {
  confidence: number; // 0 to 1
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 max-w-24 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-navy transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}
