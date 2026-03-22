import { WEIGHT_TRIGRAM, WEIGHT_ENTITY, WEIGHT_CATEGORY } from "../types.js";

/**
 * Compute weighted composite match score.
 * composite = 0.5 * trigram + 0.3 * entity + 0.2 * category_match
 */
export function compositeScore(
  trigramScore: number,
  entityScore: number,
  categoryMatch: boolean,
): number {
  const catScore = categoryMatch ? 1.0 : 0.0;
  return (
    WEIGHT_TRIGRAM * trigramScore +
    WEIGHT_ENTITY * entityScore +
    WEIGHT_CATEGORY * catScore
  );
}
