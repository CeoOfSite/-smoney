/** Cooldowns for POST /api/inventory/refresh (server + client must match). */

/** Store (owner) inventory — short window so ops can recover quickly. */
export const OWNER_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

/** Logged-in user's own inventory — stricter to limit Steam/scraping abuse. */
export const USER_REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Russian countdown for UI tooltips (seconds remaining). */
export function formatRefreshCooldownRu(totalSeconds: number): string {
  const sec = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h >= 1) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  if (m >= 1) return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
  return `${s} с`;
}
