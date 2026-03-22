interface DisagreementIndicatorProps {
  disagreement: number; // 0 to 1
}

export function DisagreementIndicator({
  disagreement,
}: DisagreementIndicatorProps) {
  const pct = Math.round(disagreement * 100);

  let label: string;
  let colorClass: string;

  if (pct <= 10) {
    label = "Strong consensus";
    colorClass = "text-positive";
  } else if (pct <= 30) {
    label = "Broad agreement";
    colorClass = "text-muted-foreground";
  } else if (pct <= 60) {
    label = "Mixed signals";
    colorClass = "text-warning";
  } else {
    label = "High disagreement";
    colorClass = "text-destructive";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${colorClass}`}>
      <span aria-hidden="true">
        {pct <= 10 ? "\u2713" : pct <= 30 ? "\u2248" : pct <= 60 ? "\u00B1" : "\u26A0"}
      </span>
      <span>{label}</span>
    </span>
  );
}
