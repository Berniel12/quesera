// Pure function: maps (direction, confidence, category, disagreement) to human-readable answer labels
// Category-aware semantic frames — "Rising" for macro, "Escalating" for geopolitics, "Bullish" for crypto

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

const CATEGORY_FRAMES: Record<string, { up: string; down: string; stable: string }> = {
  macro: { up: "Rising", down: "Easing", stable: "Holding steady" },
  politics: { up: "Likely yes", down: "Likely no", stable: "Too close to call" },
  disasters: { up: "Rising risk", down: "Threat easing", stable: "Situation steady" },
  geopolitics: { up: "Escalating", down: "De-escalating", stable: "No clear shift" },
  sports: { up: "Gaining momentum", down: "Losing ground", stable: "Holding position" },
  crypto: { up: "Bullish", down: "Bearish", stable: "Consolidating" },
  tech: { up: "Accelerating", down: "Slowing down", stable: "Steady state" },
  entertainment: { up: "Trending up", down: "Cooling off", stable: "Holding attention" },
};

const DEFAULT_FRAME = { up: "Moving up", down: "Moving down", stable: "Holding steady" };

// Direction → color: context-aware (rising risk = destructive, easing threat = positive)
const INVERTED_CATEGORIES = new Set(["disasters", "geopolitics"]);

function getDirectionColor(direction: string, category: string | null): string {
  const inverted = category !== null && INVERTED_CATEGORIES.has(category);

  if (direction === "up") return inverted ? "text-destructive" : "text-positive";
  if (direction === "down") return inverted ? "text-positive" : "text-destructive";
  return "text-muted-foreground";
}

export function getAnswerState(input: AnswerStateInput): AnswerState {
  const { direction, confidence, category, disagreement } = input;

  // High disagreement overrides everything
  if (disagreement > 0.6) {
    return {
      label: "Mixed signals",
      colorClass: "text-warning",
      intensity: "weak",
    };
  }

  // Low confidence = not enough data
  if (confidence < 0.4) {
    return {
      label: "Not enough signal yet",
      colorClass: "text-muted-foreground",
      intensity: "weak",
    };
  }

  const frame = (category !== null && CATEGORY_FRAMES[category]) || DEFAULT_FRAME;
  const directionKey = direction === "up" || direction === "down" || direction === "stable"
    ? direction
    : "stable";

  const baseLabel = frame[directionKey];
  const colorClass = getDirectionColor(directionKey, category);

  // Moderate confidence = soften the label
  if (confidence < 0.7) {
    return {
      label: `Leaning toward: ${baseLabel.toLowerCase()}`,
      colorClass,
      intensity: "moderate",
    };
  }

  return {
    label: baseLabel,
    colorClass,
    intensity: "strong",
  };
}
