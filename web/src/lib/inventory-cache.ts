/**
 * Inventory snapshot cache: Redis when REDIS_URL is set (shared across instances),
 * otherwise in-memory Map. Per-user refresh cooldowns use the same store.
 *
 * Logs: set INVENTORY_CACHE_LOG=1 (or true) on Render to trace GET/SET. In development,
 * logging is on unless INVENTORY_CACHE_LOG=0.
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
export const OWNER_FRESH_TTL_MS = 3 * 60 * 1000;

function snapshotKey(steamId: string) {
  return `${SNAPSHOT_PREFIX}${steamId}`;
}

function inventoryCacheLogEnabled(): boolean {
  const e = process.env.INVENTORY_CACHE_LOG?.trim().toLowerCase();
  if (e === "1" || e === "true" || e === "on" || e === "yes") return true;
  if (e === "0" || e === "false" || e === "off" || e === "no") return false;
  return process.env.NODE_ENV === "development";
}

/** Structured cache trace (HIT/MISS/SET/DEL). Enable with INVENTORY_CACHE_LOG=1. */
export function invCacheLog(message: string): void {
  if (!inventoryCacheLogEnabled()) return;
  console.log(`[inv-cache] ${message}`);
}

async function readSnapshot(steamId: string, op: "guest-ttl" | "owner-swr"): Promise<CacheEntry | null> {
  const key = snapshotKey(steamId);
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(key);
      if (raw == null || raw === "") {
        invCacheLog(`GET MISS op=${op} steamId=${steamId} key=${key} store=redis (nil)`);
        return null;
      }
      const parsed = JSON.parse(raw) as CacheEntry;
      if (!parsed || !Array.isArray(parsed.items) || typeof parsed.fetchedAt !== "number") {
        invCacheLog(
          `GET MISS op=${op} steamId=${steamId} key=${key} store=redis (invalid JSON shape)`,
        );
        return null;
      }
      const ageMs = Date.now() - parsed.fetchedAt;
      invCacheLog(
        `GET HIT op=${op} steamId=${steamId} key=${key} store=redis items=${parsed.items.length} ageMs=${ageMs}`,
      );
      return parsed;
    } catch (e) {
      console.warn("[inventory-cache] redis GET failed, trying memory", e);
      invCacheLog(
        `GET ERROR op=${op} steamId=${steamId} key=${key} store=redis err=${(e as Error).message} → try memory`,
      );
      const mem = memoryCache.get(steamId) ?? null;
      if (!mem) {
        invCacheLog(`GET MISS op=${op} steamId=${steamId} key=${key} store=memory (fallback empty)`);
      } else {
        const ageMs = Date.now() - mem.fetchedAt;
        invCacheLog(
          `GET HIT op=${op} steamId=${steamId} key=${key} store=memory items=${mem.items.length} ageMs=${ageMs}`,
        );
      }
      return mem;
    }
  }
  const mem = memoryCache.get(steamId) ?? null;
  if (!mem) {
    invCacheLog(`GET MISS op=${op} steamId=${steamId} key=${key} store=memory (nil)`);
  } else {
    const ageMs = Date.now() - mem.fetchedAt;
    invCacheLog(
      `GET HIT op=${op} steamId=${steamId} key=${key} store=memory items=${mem.items.length} ageMs=${ageMs}`,
    );
  }
  return mem;
}

async function writeSnapshot(steamId: string, entry: CacheEntry): Promise<void> {
  const key = snapshotKey(steamId);
  const r = getRedis();
  if (r) {
    try {
      const payload = JSON.stringify(entry);
      await r.set(key, payload, "EX", SNAPSHOT_MAX_TTL_SEC);
      invCacheLog(
        `SET OK steamId=${steamId} key=${key} store=redis items=${entry.items.length} bytes=${payload.length}`,
      );
      return;
    } catch (e) {
      console.warn("[inventory-cache] redis SET failed, using memory only", e);
      invCacheLog(`SET FAIL steamId=${steamId} key=${key} store=redis err=${(e as Error).message}`);
    }
  }
  memoryCache.set(steamId, entry);
  invCacheLog(`SET OK steamId=${steamId} key=${key} store=memory items=${entry.items.length}`);
}

async function removeSnapshot(steamId: string, reason: string): Promise<void> {
  const key = snapshotKey(steamId);
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
      invCacheLog(`DEL steamId=${steamId} key=${key} store=redis reason=${reason}`);
    } catch (e) {
      console.warn("[inventory-cache] redis DEL failed", e);
      invCacheLog(`DEL FAIL steamId=${steamId} key=${key} store=redis err=${(e as Error).message}`);
    }
  }
  memoryCache.delete(steamId);
  if (!r) invCacheLog(`DEL steamId=${steamId} key=${key} store=memory reason=${reason}`);
}

export async function getCached(steamId: string): Promise<NormalizedItem[] | null> {
  const entry = await readSnapshot(steamId, "guest-ttl");
  if (!entry) return null;
  const ageMs = Date.now() - entry.fetchedAt;
  if (ageMs > DEFAULT_TTL_MS) {
    invCacheLog(
      `guest-ttl EXPIRED steamId=${steamId} key=${snapshotKey(steamId)} ageMs=${ageMs} ttlMs=${DEFAULT_TTL_MS}`,
    );
    await removeSnapshot(steamId, "guest-ttl-expired");
    return null;
  }
  invCacheLog(`guest-ttl SERVE steamId=${steamId} ageMs=${ageMs}`);
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
  const entry = await readSnapshot(steamId, "owner-swr");
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  const isStale = age > OWNER_FRESH_TTL_MS;
  invCacheLog(
    `owner-swr USE steamId=${steamId} key=${snapshotKey(steamId)} stale=${isStale} ageMs=${age} freshTtlMs=${OWNER_FRESH_TTL_MS}`,
  );
  return {
    items: entry.items,
    isStale,
  };
}

export async function setCache(steamId: string, items: NormalizedItem[]) {
  await writeSnapshot(steamId, { items, fetchedAt: Date.now() });
}

export async function invalidateCache(steamId: string) {
  await removeSnapshot(steamId, "invalidate");
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
