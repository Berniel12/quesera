// Maps (direction, confidence, disagreement) to bold, sensational answer labels
// ALWAYS pick a side. People want "Probably yes" or "Probably no" -- not hedging.
// Even at 30% confidence, commit to an answer. Be a smart friend who has an opinion.

interface AnswerStateInput {
  direction: string;
  confidence: number;
  category: string | null;
  disagreement: number;
}

export interface AnswerState {
  label: string;
  colorClass: string;
  intensity: "strong" | "moderate" | "weak";
}

const INVERTED_CATEGORIES = new Set(["disasters", "geopolitics"]);

function getDirectionColor(direction: string, category: string | null): string {
  const inverted = category !== null && INVERTED_CATEGORIES.has(category);
  if (direction === "up") return inverted ? "text-destructive" : "text-positive dark:text-[#4EDEA3]";
  if (direction === "down") return inverted ? "text-positive dark:text-[#4EDEA3]" : "text-destructive";
  return "text-foreground";
}

export function getAnswerState(input: AnswerStateInput): AnswerState {
  const { direction, confidence, category } = input;
  const colorClass = getDirectionColor(direction, category);

  // ── HIGH confidence (>= 0.65) — strong commitment ──
  if (confidence >= 0.65) {
    if (direction === "up") return { label: "Probably yes", colorClass, intensity: "strong" };
    if (direction === "down") return { label: "Probably not", colorClass, intensity: "strong" };
    return { label: "Not yet", colorClass: "text-positive dark:text-[#4EDEA3]", intensity: "strong" };
  }

  // ── MODERATE confidence (>= 0.35) — still commit ──
  if (confidence >= 0.35) {
    if (direction === "up") return { label: "Probably yes", colorClass, intensity: "moderate" };
    if (direction === "down") return { label: "Probably not", colorClass, intensity: "moderate" };
    if (direction === "stable") return { label: "Not yet", colorClass: "text-positive dark:text-[#4EDEA3]", intensity: "moderate" };
    return { label: "Probably not", colorClass: "text-muted-foreground", intensity: "moderate" };
  }

  // ── LOW confidence (< 0.35) — still give an answer based on category context ──
  // Most questions with unknown direction and low confidence = "probably not happening"
  if (direction === "up") return { label: "Probably yes", colorClass, intensity: "weak" };
  if (direction === "down") return { label: "Probably not", colorClass: "text-destructive", intensity: "weak" };
  if (direction === "stable") return { label: "Not yet", colorClass: "text-foreground", intensity: "weak" };

  // Unknown direction -- use category to give sensible default
  if (category === "disasters" || category === "geopolitics") {
    return { label: "Situation developing", colorClass: "text-warning", intensity: "weak" };
  }
  if (category === "sports") {
    return { label: "Still wide open", colorClass: "text-foreground", intensity: "weak" };
  }

  // Default: most questions with no data lean toward "probably not" -- it's more useful than "maybe"
  return { label: "Probably not", colorClass: "text-foreground", intensity: "weak" };
}
