// Maps signal data to bold, entertaining verdicts.
// The verdict MUST make sense when placed directly after the question:
//   "Will Bitcoin keep going up?" -> "Probably yes"
//   "Who will win the NBA title?" -> "Probably yes" (with named answer in one-liner)
//   "Is NATO getting stronger?" -> "Probably yes"
//   "Will the war end soon?" -> "Probably not"
//
// NEVER return "Not yet" -- it was causing nonsensical answers for most question types.

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

  // HIGH confidence (>= 0.6)
  if (confidence >= 0.6) {
    if (direction === "up") return { label: "Probably yes", colorClass, intensity: "strong" };
    if (direction === "down") return { label: "Probably not", colorClass, intensity: "strong" };
    // Stable + high confidence = things are steady, lean toward "yes it's stable" / "probably not changing"
    return { label: "Probably not", colorClass: "text-foreground", intensity: "strong" };
  }

  // MODERATE confidence (0.35 - 0.6)
  if (confidence >= 0.35) {
    if (direction === "up") return { label: "Probably yes", colorClass, intensity: "moderate" };
    if (direction === "down") return { label: "Probably not", colorClass, intensity: "moderate" };
    if (direction === "stable") return { label: "Probably not", colorClass: "text-foreground", intensity: "moderate" };
    // Unknown direction
    return { label: "Hard to say", colorClass: "text-muted-foreground", intensity: "moderate" };
  }

  // LOW confidence (< 0.35)
  if (direction === "up") return { label: "Probably yes", colorClass, intensity: "weak" };
  if (direction === "down") return { label: "Probably not", colorClass: "text-destructive", intensity: "weak" };
  if (direction === "stable") return { label: "Probably not", colorClass: "text-foreground", intensity: "weak" };

  // Unknown direction -- category-specific
  if (category === "disasters" || category === "geopolitics") {
    return { label: "Situation developing", colorClass: "text-warning", intensity: "weak" };
  }
  if (category === "sports") {
    return { label: "Still wide open", colorClass: "text-foreground", intensity: "weak" };
  }

  return { label: "Hard to say", colorClass: "text-muted-foreground", intensity: "weak" };
}
