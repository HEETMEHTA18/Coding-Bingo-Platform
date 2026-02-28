/**
 * Ultra-fast in-memory cache with TTL and LRU eviction.
 * Eliminates repeated DB round-trips for hot data (game state, leaderboard, questions).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    // Periodic cleanup every 30s
    setInterval(() => this.cleanup(), 30_000);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    // Evict oldest entry if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Delete one key or all keys matching a prefix */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
      return;
    }
    // Prefix match
    for (const k of this.store.keys()) {
      if (k.startsWith(keyOrPrefix)) this.store.delete(k);
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }

  get size() { return this.store.size; }
}

export const cache = new MemoryCache(1000);

// TTL constants (milliseconds)
export const TTL = {
  GAME_STATE: 800,    // game state: 800ms (nearly real-time, SSE covers the rest)
  LEADERBOARD: 3_000,  // leaderboard: 3s
  QUESTIONS: 60_000, // questions: 60s (rarely changes)
  ROOM: 10_000, // room metadata: 10s
  TEAM: 2_000,  // team data: 2s
  TTT_BOARD: 500,    // ttt board: 500ms (very hot)
} as const;
