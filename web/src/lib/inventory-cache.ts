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

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function getCached(steamId: string): NormalizedItem[] | null {
  const entry = cache.get(steamId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > DEFAULT_TTL_MS) {
    cache.delete(steamId);
    return null;
  }
  return entry.items;
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
