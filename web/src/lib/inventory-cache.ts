/**
 * Inventory snapshot cache: Redis when REDIS_URL is set (shared across instances),
 * otherwise in-memory Map. Per-user refresh cooldowns use the same store.
 */

import type { NormalizedItem } from "./steam-inventory";
import { OWNER_REFRESH_COOLDOWN_MS, USER_REFRESH_COOLDOWN_MS } from "./inventory-refresh-limits";
import { getRedis } from "./redis-client";

interface CacheEntry {
  items: NormalizedItem[];
  fetchedAt: number;
}

const SNAPSHOT_PREFIX = "csmoney:inv:snapshot:";
const RL_OWNER_PREFIX = "csmoney:inv:rl:owner:";
const RL_USER_PREFIX = "csmoney:inv:rl:user:";

/** 7d TTL on snapshot keys (owner entries are refreshed by job; guests expire logically at 3m). */
const SNAPSHOT_MAX_TTL_SEC = 7 * 24 * 3600;

const memoryCache = new Map<string, CacheEntry>();
const lastOwnerRefresh = new Map<string, number>();
const lastUserRefresh = new Map<string, number>();

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes (guest / strict)

/** Owner store: after this age, snapshot is "stale" (triggers background revalidation in API). */
const OWNER_FRESH_TTL_MS = 3 * 60 * 1000;

function snapshotKey(steamId: string) {
  return `${SNAPSHOT_PREFIX}${steamId}`;
}

async function readSnapshot(steamId: string): Promise<CacheEntry | null> {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(snapshotKey(steamId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry;
      if (!parsed || !Array.isArray(parsed.items) || typeof parsed.fetchedAt !== "number") {
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn("[inventory-cache] redis GET failed, trying memory", e);
      return memoryCache.get(steamId) ?? null;
    }
  }
  return memoryCache.get(steamId) ?? null;
}

async function writeSnapshot(steamId: string, entry: CacheEntry): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(snapshotKey(steamId), JSON.stringify(entry), "EX", SNAPSHOT_MAX_TTL_SEC);
      return;
    } catch (e) {
      console.warn("[inventory-cache] redis SET failed, using memory only", e);
    }
  }
  memoryCache.set(steamId, entry);
}

async function removeSnapshot(steamId: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(snapshotKey(steamId));
    } catch (e) {
      console.warn("[inventory-cache] redis DEL failed", e);
    }
  }
  memoryCache.delete(steamId);
}

export async function getCached(steamId: string): Promise<NormalizedItem[] | null> {
  const entry = await readSnapshot(steamId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > DEFAULT_TTL_MS) {
    await removeSnapshot(steamId);
    return null;
  }
  return entry.items;
}

/**
 * Owner store inventory: serve until replaced by a successful Steam fetch.
 * Stale flag drives background revalidation only; we do not evict by age (SWR + hourly job).
 */
export async function getOwnerCachedStaleWhileRevalidate(steamId: string): Promise<{
  items: NormalizedItem[];
  isStale: boolean;
} | null> {
  const entry = await readSnapshot(steamId);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  return {
    items: entry.items,
    isStale: age > OWNER_FRESH_TTL_MS,
  };
}

export async function setCache(steamId: string, items: NormalizedItem[]) {
  await writeSnapshot(steamId, { items, fetchedAt: Date.now() });
}

export async function invalidateCache(steamId: string) {
  await removeSnapshot(steamId);
}

function remainingCooldown(
  map: Map<string, number>,
  steamId: string,
  windowMs: number,
): number {
  const last = map.get(steamId);
  if (!last) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, windowMs - elapsed);
}

/** Owner/store inventory refresh (key = owner Steam ID). */
export async function refreshCooldownRemainingOwner(steamId: string): Promise<number> {
  const r = getRedis();
  if (r) {
    try {
      const pttl = await r.pttl(`${RL_OWNER_PREFIX}${steamId}`);
      if (pttl > 0) return pttl;
      return 0;
    } catch (e) {
      console.warn("[inventory-cache] redis PTTL owner failed", e);
    }
  }
  return remainingCooldown(lastOwnerRefresh, steamId, OWNER_REFRESH_COOLDOWN_MS);
}

/** Logged-in user's "my inventory" refresh (key = user's Steam ID). */
export async function refreshCooldownRemainingUser(steamId: string): Promise<number> {
  const r = getRedis();
  if (r) {
    try {
      const pttl = await r.pttl(`${RL_USER_PREFIX}${steamId}`);
      if (pttl > 0) return pttl;
      return 0;
    } catch (e) {
      console.warn("[inventory-cache] redis PTTL user failed", e);
    }
  }
  return remainingCooldown(lastUserRefresh, steamId, USER_REFRESH_COOLDOWN_MS);
}

export async function markOwnerRefreshed(steamId: string) {
  const r = getRedis();
  if (r) {
    try {
      await r.set(`${RL_OWNER_PREFIX}${steamId}`, "1", "PX", OWNER_REFRESH_COOLDOWN_MS);
    } catch (e) {
      console.warn("[inventory-cache] redis SET owner rl failed", e);
    }
  }
  lastOwnerRefresh.set(steamId, Date.now());
}

export async function markUserRefreshed(steamId: string) {
  const r = getRedis();
  if (r) {
    try {
      await r.set(`${RL_USER_PREFIX}${steamId}`, "1", "PX", USER_REFRESH_COOLDOWN_MS);
    } catch (e) {
      console.warn("[inventory-cache] redis SET user rl failed", e);
    }
  }
  lastUserRefresh.set(steamId, Date.now());
}
