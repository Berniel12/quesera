// Pure function: maps (direction, confidence, disagreement) to conversational answer labels
// Universal voice — no jargon, sounds like a smart friend answering your question

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

// Inverted categories: "up" = bad (rising risk), "down" = good (threat easing)
const INVERTED_CATEGORIES = new Set(["disasters", "geopolitics"]);

function getDirectionColor(direction: string, category: string | null): string {
  const inverted = category !== null && INVERTED_CATEGORIES.has(category);

  if (direction === "up") return inverted ? "text-destructive" : "text-positive";
  if (direction === "down") return inverted ? "text-positive" : "text-destructive";
  return "text-muted-foreground";
}

export function getAnswerState(input: AnswerStateInput): AnswerState {
  const { direction, confidence, category, disagreement } = input;

  // Experts disagree
  if (disagreement > 0.6) {
    return {
      label: "Experts disagree",
      colorClass: "text-warning",
      intensity: "weak",
    };
  }

  // Too early to tell
  if (confidence < 0.4) {
    return {
      label: "Too early to tell",
      colorClass: "text-muted-foreground",
      intensity: "weak",
    };
  }

  const colorClass = getDirectionColor(direction, category);

  // Strong confidence
  if (confidence >= 0.7) {
    if (direction === "up") return { label: "Probably yes", colorClass, intensity: "strong" };
    if (direction === "down") return { label: "Probably not", colorClass, intensity: "strong" };
    return { label: "Hard to say", colorClass: "text-muted-foreground", intensity: "moderate" };
  }

  // Moderate confidence
  if (direction === "up") return { label: "Looks like it", colorClass, intensity: "moderate" };
  if (direction === "down") return { label: "Doesn't look like it", colorClass, intensity: "moderate" };
  return { label: "Hard to say", colorClass: "text-muted-foreground", intensity: "moderate" };
}
