interface FreshnessBadgeProps {
  freshness: string;
}

const config: Record<string, { label: string; dotClass: string }> = {
  fresh: { label: "Fresh", dotClass: "bg-positive" },
  aging: { label: "Aging", dotClass: "bg-[#FFB84D]" },
  stale: { label: "Stale", dotClass: "bg-warning" },
  dead: { label: "Dead", dotClass: "bg-destructive" },
  unknown: { label: "Unknown", dotClass: "bg-muted-foreground" },
};

export function FreshnessBadge({ freshness }: FreshnessBadgeProps) {
  const { label, dotClass } = config[freshness] ?? config.unknown;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
