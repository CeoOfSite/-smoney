/**
 * Simple in-memory inventory cache with configurable TTL
 * and per-user refresh rate limiting.
 */

import type { NormalizedItem } from "./steam-inventory";
import { OWNER_REFRESH_COOLDOWN_MS, USER_REFRESH_COOLDOWN_MS } from "./inventory-refresh-limits";

interface CacheEntry {
  items: NormalizedItem[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const lastOwnerRefresh = new Map<string, number>();
const lastUserRefresh = new Map<string, number>();

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes (guest / strict)

/** Owner store: treat as fresh for this long; after that still serve stale until MAX_STALE. */
const OWNER_FRESH_TTL_MS = 3 * 60 * 1000;
/** Owner store: drop cache entirely after this age (must hit Steam again). */
const OWNER_MAX_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

export function getCached(steamId: string): NormalizedItem[] | null {
  const entry = cache.get(steamId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > DEFAULT_TTL_MS) {
    cache.delete(steamId);
    return null;
  }
  return entry.items;
}

/**
 * Owner inventory only: stale-while-revalidate read.
 * Returns null if missing or older than OWNER_MAX_STALE_MS.
 */
export function getOwnerCachedStaleWhileRevalidate(steamId: string): {
  items: NormalizedItem[];
  isStale: boolean;
} | null {
  const entry = cache.get(steamId);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  if (age > OWNER_MAX_STALE_MS) {
    cache.delete(steamId);
    return null;
  }
  return {
    items: entry.items,
    isStale: age > OWNER_FRESH_TTL_MS,
  };
}

export function setCache(steamId: string, items: NormalizedItem[]) {
  cache.set(steamId, { items, fetchedAt: Date.now() });
}

export function invalidateCache(steamId: string) {
  cache.delete(steamId);
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
export function refreshCooldownRemainingOwner(steamId: string): number {
  return remainingCooldown(lastOwnerRefresh, steamId, OWNER_REFRESH_COOLDOWN_MS);
}

/** Logged-in user's "my inventory" refresh (key = user's Steam ID). */
export function refreshCooldownRemainingUser(steamId: string): number {
  return remainingCooldown(lastUserRefresh, steamId, USER_REFRESH_COOLDOWN_MS);
}

export function markOwnerRefreshed(steamId: string) {
  lastOwnerRefresh.set(steamId, Date.now());
}

export function markUserRefreshed(steamId: string) {
  lastUserRefresh.set(steamId, Date.now());
}
