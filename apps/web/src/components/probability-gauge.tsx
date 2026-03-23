// Circular SVG probability gauge — matches stitch5 design reference
// Full circle track + fill with glow in dark mode

interface ProbabilityGaugeProps {
  confidence: number; // 0-1
  label: string; // "Probably yes", "Signs point to no", etc.
  size?: "lg" | "md" | "sm";
}

export function ProbabilityGauge({ confidence, label, size = "lg" }: ProbabilityGaugeProps) {
  const pct = Math.round(confidence * 100);

  const dimensions = {
    lg: { svgSize: 192, r: 80, stroke: 8, textSize: "text-5xl", labelSize: "text-[10px]" },
    md: { svgSize: 120, r: 48, stroke: 6, textSize: "text-3xl", labelSize: "text-[9px]" },
    sm: { svgSize: 80, r: 32, stroke: 4, textSize: "text-xl", labelSize: "text-[8px]" },
  };

  const d = dimensions[size];
  const circumference = 2 * Math.PI * d.r;
  const offset = circumference * (1 - confidence);
  const center = d.svgSize / 2;

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg
        width={d.svgSize}
        height={d.svgSize}
        viewBox={`0 0 ${d.svgSize} ${d.svgSize}`}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={d.r}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={d.stroke}
          className="text-secondary"
        />
        {/* Glow layer (dark mode only) */}
        <circle
          cx={center}
          cy={center}
          r={d.r}
          fill="transparent"
          stroke="hsl(var(--primary))"
          strokeWidth={d.stroke + 4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="opacity-0 dark:opacity-20 blur-[2px]"
          style={{ filter: "blur(4px)" }}
        />
        {/* Fill */}
        <circle
          cx={center}
          cy={center}
          r={d.r}
          fill="transparent"
          stroke="hsl(var(--primary))"
          strokeWidth={d.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="animate-bar-fill drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
          style={{ transformOrigin: "center" }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${d.textSize} font-black tracking-tighter text-foreground dark:text-primary animate-number-reveal delay-600`} style={{ opacity: 0 }}>
          {pct}%
        </span>
        <span className={`${d.labelSize} uppercase tracking-[0.15em] text-muted-foreground font-bold mt-1 animate-fade-in delay-700`} style={{ opacity: 0 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
