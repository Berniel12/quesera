import { Badge } from "@/components/ui/badge";

interface DirectionBadgeProps {
  direction: string;
  size?: "sm" | "md" | "lg";
}

const config: Record<string, { label: string; icon: string; className: string }> = {
  up: {
    label: "Rising",
    icon: "\u2191",
    className: "bg-positive/10 text-positive border-positive/20",
  },
  down: {
    label: "Falling",
    icon: "\u2193",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  stable: {
    label: "Stable",
    icon: "\u2192",
    className: "bg-muted text-muted-foreground border-border",
  },
  unknown: {
    label: "Unknown",
    icon: "?",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function DirectionBadge({ direction, size = "md" }: DirectionBadgeProps) {
  const { label, icon, className } = config[direction] ?? config.unknown;

  const sizeClass =
    size === "lg"
      ? "text-base px-4 py-1.5"
      : size === "sm"
        ? "text-xs px-2 py-0.5"
        : "text-sm px-3 py-1";

  return (
    <Badge
      variant="outline"
      className={`${className} ${sizeClass} rounded-full font-medium gap-1`}
    >
      <span className="font-mono" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </Badge>
  );
}
