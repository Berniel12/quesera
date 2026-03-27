// Maps signal data to bold, entertaining verdicts.
// Two fields: `label` (canonical: "Probably yes") and `headline` (category-flavored: "Lock it in")
// The headline is the clickbait -- displayed huge on topic pages and cards.
// The label stays for data consistency and fallback.

interface AnswerStateInput {
  direction: string;
  confidence: number;
  category: string | null;
  disagreement: number;
}

export interface AnswerState {
  label: string;
  headline: string;
  colorClass: string;
  intensity: "strong" | "moderate" | "weak";
}

const INVERTED_CATEGORIES = new Set(["disasters", "geopolitics"]);

// Category-specific verdict headlines -- the fun, shareable version
const HEADLINES: Record<string, { up: string; down: string; stable: string; unknown: string }> = {
  sports:        { up: "Lock it in",          down: "Don't bet on it",       stable: "Still wide open",    unknown: "Still wide open" },
  crypto:        { up: "To the moon",         down: "Not this cycle",        stable: "Not yet",            unknown: "Hard to say" },
  entertainment: { up: "Count on it",         down: "Don't hold your breath", stable: "Not yet",           unknown: "Drama incoming" },
  geopolitics:   { up: "Brace yourself",      down: "Cooler heads prevail",  stable: "Uneasy calm",        unknown: "Situation developing" },
  disasters:     { up: "Brace yourself",      down: "All clear for now",     stable: "All clear for now",   unknown: "Situation developing" },
  macro:         { up: "Probably yes",         down: "Probably not",          stable: "Holding steady",     unknown: "Hard to say" },
  politics:      { up: "Probably yes",         down: "Probably not",          stable: "Probably not",       unknown: "Hard to say" },
  tech:          { up: "Probably yes",         down: "Probably not",          stable: "Probably not",       unknown: "Hard to say" },
};

const DEFAULT_HEADLINES = { up: "Probably yes", down: "Probably not", stable: "Probably not", unknown: "Hard to say" };

function getHeadline(direction: string, category: string | null): string {
  const map = (category ? HEADLINES[category] : undefined) ?? DEFAULT_HEADLINES;
  if (direction === "up") return map.up;
  if (direction === "down") return map.down;
  if (direction === "stable") return map.stable;
  return map.unknown;
}

function getDirectionColor(direction: string, category: string | null): string {
  const inverted = category !== null && INVERTED_CATEGORIES.has(category);
  if (direction === "up") return inverted ? "text-destructive" : "text-positive dark:text-[#4EDEA3]";
  if (direction === "down") return inverted ? "text-positive dark:text-[#4EDEA3]" : "text-destructive";
  return "text-foreground";
}

export function getAnswerState(input: AnswerStateInput): AnswerState {
  const { direction, confidence, category } = input;
  const colorClass = getDirectionColor(direction, category);
  const headline = getHeadline(direction, category);

  // No signals / 0 confidence edge case
  if (confidence === 0 && direction === "unknown") {
    return { label: "No active markets", headline: "No active markets", colorClass: "text-muted-foreground", intensity: "weak" };
  }

  // HIGH confidence (>= 0.6)
  if (confidence >= 0.6) {
    if (direction === "up") return { label: "Probably yes", headline, colorClass, intensity: "strong" };
    if (direction === "down") return { label: "Probably not", headline, colorClass, intensity: "strong" };
    return { label: "Probably not", headline, colorClass: "text-foreground", intensity: "strong" };
  }

  // MODERATE confidence (0.35 - 0.6)
  if (confidence >= 0.35) {
    if (direction === "up") return { label: "Probably yes", headline, colorClass, intensity: "moderate" };
    if (direction === "down") return { label: "Probably not", headline, colorClass, intensity: "moderate" };
    if (direction === "stable") return { label: "Probably not", headline, colorClass: "text-foreground", intensity: "moderate" };
    return { label: "Hard to say", headline, colorClass: "text-muted-foreground", intensity: "moderate" };
  }

  // LOW confidence (< 0.35)
  if (direction === "up") return { label: "Probably yes", headline, colorClass, intensity: "weak" };
  if (direction === "down") return { label: "Probably not", headline, colorClass: "text-destructive", intensity: "weak" };
  if (direction === "stable") return { label: "Probably not", headline, colorClass: "text-foreground", intensity: "weak" };

  // Unknown direction -- label stays canonical, headline is category-flavored
  return { label: "Hard to say", headline, colorClass: category === "disasters" || category === "geopolitics" ? "text-warning" : category === "sports" ? "text-foreground" : "text-muted-foreground", intensity: "weak" };
}
