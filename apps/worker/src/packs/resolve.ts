/**
 * Pack Resolution
 *
 * Given a question's type and category, resolves which source pack applies.
 * Returns null if no pack matches (question cannot be featured).
 */

import { SOURCE_PACKS, type SourcePack, type QuestionType } from "./index.js";

/**
 * Resolve the source pack for a question.
 * Matches by question_type first, then category.
 * Returns null if no pack covers this question family.
 */
export function resolvePack(
  questionType: QuestionType,
  category: string | null,
): SourcePack | null {
  const cat = category ?? "";

  for (const pack of SOURCE_PACKS) {
    if (
      pack.questionTypes.includes(questionType) &&
      pack.categories.includes(cat)
    ) {
      return pack;
    }
  }

  // No pack covers this question family -- cannot be featured
  return null;
}

/**
 * Check if a set of signals passes a pack's synthesis gate.
 * Returns whether the question is synthesis-ready for homepage featuring.
 */
export function checkSynthesisGate(
  pack: SourcePack,
  signals: Array<{ source_family: string; source_name: string }>,
): boolean {
  // Count distinct families
  const familyCounts = new Map<string, number>();
  for (const signal of signals) {
    familyCounts.set(
      signal.source_family,
      (familyCounts.get(signal.source_family) ?? 0) + 1,
    );
  }
  const sourceFamilies = [...familyCounts.keys()];

  // Count predictive spine: families or distinct platforms
  const predictivePresent = pack.predictiveSpine.filter((f) =>
    familyCounts.has(f),
  );
  const predictivePlatforms = new Set(
    signals
      .filter((s) => pack.predictiveSpine.includes(s.source_family))
      .map((s) => s.source_name),
  );
  const predictiveCount = Math.max(
    predictivePresent.length,
    predictivePlatforms.size,
  );

  // Check strengthening layer
  const hasStrengthening = sourceFamilies.some((f) =>
    pack.strengtheningLayer.includes(f),
  );

  // Basic gate
  const passesBasic =
    predictiveCount >= pack.minPredictiveSources &&
    signals.length >= pack.minTotalSignals &&
    (!pack.requireStrengthening || hasStrengthening);

  if (!passesBasic) return false;

  // Extra gate for packs requiring platform diversity:
  // Must have strengthening OR predictive spine from 2+ distinct platforms
  if (pack.requirePlatformDiversity) {
    if (!hasStrengthening && predictivePlatforms.size < 2) {
      return false;
    }
  }

  return true;
}
