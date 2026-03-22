import type { Logger } from "@signal-map/logger";

/**
 * Rotating API key manager.
 * Distributes load across multiple keys round-robin.
 * Marks keys as failed temporarily on errors (429, 403).
 */
export class KeyRotator {
  private keys: string[];
  private currentIndex: number;
  private failedKeys: Map<string, number>; // key -> failure timestamp
  private cooldownMs: number;

  constructor(
    envVar: string,
    options: { cooldownMs?: number } = {},
  ) {
    const raw = process.env[envVar] ?? "";
    this.keys = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (this.keys.length === 0) {
      throw new Error(`No API keys found in ${envVar}`);
    }

    this.currentIndex = 0;
    this.failedKeys = new Map();
    this.cooldownMs = options.cooldownMs ?? 60_000; // 1 minute default
  }

  /** Get the next available key (round-robin, skipping recently failed keys). */
  getKey(): string {
    const now = Date.now();
    const startIndex = this.currentIndex;

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (startIndex + i) % this.keys.length;
      const key = this.keys[idx];
      if (!key) continue;

      const failedAt = this.failedKeys.get(key);
      if (failedAt && now - failedAt < this.cooldownMs) {
        continue; // skip keys still in cooldown
      }

      // Clear expired cooldown
      if (failedAt) {
        this.failedKeys.delete(key);
      }

      this.currentIndex = (idx + 1) % this.keys.length;
      return key;
    }

    // All keys in cooldown — use the least recently failed
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return this.keys[this.currentIndex] ?? this.keys[0] ?? "";
  }

  /** Mark a key as temporarily failed (e.g., rate limited). */
  markFailed(key: string, logger?: Logger): void {
    this.failedKeys.set(key, Date.now());
    logger?.warn(
      {
        provider: this.keys.indexOf(key),
        cooldownMs: this.cooldownMs,
        activeKeys: this.keys.length - this.failedKeys.size,
      },
      "API key marked as failed, rotating",
    );
  }

  /** Get count of available (non-failed) keys. */
  get availableCount(): number {
    const now = Date.now();
    let available = 0;
    for (const key of this.keys) {
      const failedAt = this.failedKeys.get(key);
      if (!failedAt || now - failedAt >= this.cooldownMs) {
        available++;
      }
    }
    return available;
  }

  /** Total key count. */
  get totalCount(): number {
    return this.keys.length;
  }
}

// Singleton instances (lazy-initialized)
let tavilyRotator: KeyRotator | null = null;
let firecrawlRotator: KeyRotator | null = null;

export function getTavilyKey(): string {
  if (!tavilyRotator) {
    tavilyRotator = new KeyRotator("TAVILY_API_KEYS");
  }
  return tavilyRotator.getKey();
}

export function markTavilyKeyFailed(key: string, logger?: Logger): void {
  tavilyRotator?.markFailed(key, logger);
}

export function getFirecrawlKey(): string {
  if (!firecrawlRotator) {
    firecrawlRotator = new KeyRotator("FIRECRAWL_API_KEYS");
  }
  return firecrawlRotator.getKey();
}

export function markFirecrawlKeyFailed(key: string, logger?: Logger): void {
  firecrawlRotator?.markFailed(key, logger);
}

let geminiRotator: KeyRotator | null = null;

export function getGeminiKey(): string {
  if (!geminiRotator) {
    geminiRotator = new KeyRotator("GEMINI_API_KEYS");
  }
  return geminiRotator.getKey();
}

export function markGeminiKeyFailed(key: string, logger?: Logger): void {
  geminiRotator?.markFailed(key, logger);
}
