interface FreshnessBadgeProps {
  freshness: string;
}

const config: Record<string, { label: string; dotClass: string; show: boolean }> = {
  fresh: { label: "Live", dotClass: "bg-positive", show: true },
  aging: { label: "Recent", dotClass: "bg-[#FFB84D]", show: true },
  stale: { label: "Updating", dotClass: "bg-warning", show: false },
  dead: { label: "Updating", dotClass: "bg-muted-foreground", show: false },
  unknown: { label: "", dotClass: "bg-muted-foreground", show: false },
};

export function FreshnessBadge({ freshness }: FreshnessBadgeProps) {
  const entry = config[freshness] ?? config.unknown;

  // Don't show badge for stale/dead/unknown — if it's not fresh, hide it
  if (!entry.show) return null;

  const isFresh = freshness === "fresh";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {isFresh ? (
        <span className="relative h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-positive animate-pulse-live" />
          <span className="relative block h-1.5 w-1.5 rounded-full bg-positive" />
        </span>
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${entry.dotClass}`}
          aria-hidden="true"
        />
      )}
      <span>{entry.label}</span>
    </span>
  );
}
