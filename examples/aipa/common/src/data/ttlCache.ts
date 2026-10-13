type Entry<T> = { value: T; expiresAt: number };

/** Simple process-local TTL cache with in-flight request coalescing. */
export class TtlCache {
  private readonly store = new Map<string, Entry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly defaultTtlMs: number) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Return cached value, or run `load` once per key while concurrent callers await the same promise. */
  async getOrLoad<T>(key: string, load: () => Promise<T>, ttlMs: number = this.defaultTtlMs): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await load();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }
}

/** Shared market-data cache: quotes ~2m, OHLC ~10m (daily bars change slowly). */
export const marketDataCache = new TtlCache(10 * 60 * 1000);

/** Research / filings cache (same process). */
export const researchDataCache = new TtlCache(5 * 60 * 1000);

export const QUOTE_TTL_MS = 2 * 60 * 1000;
export const OHLC_TTL_MS = 10 * 60 * 1000;
export const NEWS_TTL_MS = 5 * 60 * 1000;
export const FILINGS_TTL_MS = 15 * 60 * 1000;
export const RESEARCH_BUNDLE_TTL_MS = 5 * 60 * 1000;
