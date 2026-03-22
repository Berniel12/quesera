import { createHash } from "node:crypto";

/**
 * Produces a deterministic SHA-256 hash of a JSON-serializable object.
 * Keys are sorted to ensure consistent hashing regardless of insertion order.
 */
export function hashContent(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(sorted).digest("hex");
}
