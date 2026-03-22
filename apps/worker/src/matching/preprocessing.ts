/**
 * Deterministic text normalization for matching.
 * Same input always yields the same output.
 */
export function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // strip punctuation except hyphens
    .replace(/\s+/g, " ")     // collapse repeated spaces
    .trim();
}

/**
 * Generate a slug from text for candidate dedupe.
 */
export function generateSlug(text: string): string {
  return preprocessText(text)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
