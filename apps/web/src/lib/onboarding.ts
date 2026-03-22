const STORAGE_KEY = "quesera_onboarding_pending";
const CURRENT_VERSION = 1;

interface PendingOnboarding {
  version: number;
  slugs: string[];
  savedAt: string;
}

/** Check if there are pending onboarding follows in localStorage */
export function hasPendingOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as Partial<PendingOnboarding>;
    return data.version === CURRENT_VERSION && Array.isArray(data.slugs) && data.slugs.length > 0;
  } catch {
    return false;
  }
}

/** Save pending onboarding selections to localStorage */
export function savePendingOnboarding(slugs: string[]): void {
  const payload: PendingOnboarding = {
    version: CURRENT_VERSION,
    slugs,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Clear all pending onboarding state */
export function clearPendingOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Read pending slugs from localStorage. Returns empty array if none or stale. */
function readPendingSlugs(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<PendingOnboarding>;
    if (data.version !== CURRENT_VERSION || !Array.isArray(data.slugs)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return data.slugs;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

/**
 * Replay pending onboarding follows. Removes each slug from pending state
 * immediately after a successful follow to prevent duplicates.
 * Returns summary of results.
 */
export async function applyPendingOnboarding(): Promise<{
  ok: boolean;
  applied: number;
  failed: string[];
}> {
  const slugs = readPendingSlugs();
  if (slugs.length === 0) {
    return { ok: true, applied: 0, failed: [] };
  }

  let applied = 0;
  const failed: string[] = [];

  for (const slug of slugs) {
    try {
      const res = await fetch(`/api/topics/${encodeURIComponent(slug)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow" }),
      });

      if (res.ok) {
        applied++;
        // Remove this slug from pending immediately
        const remaining = readPendingSlugs().filter((s) => s !== slug);
        if (remaining.length === 0) {
          clearPendingOnboarding();
        } else {
          savePendingOnboarding(remaining);
        }
      } else {
        failed.push(slug);
      }
    } catch {
      failed.push(slug);
    }
  }

  // If all succeeded, ensure clean state
  if (failed.length === 0) {
    clearPendingOnboarding();
  }

  return { ok: failed.length === 0, applied, failed };
}
