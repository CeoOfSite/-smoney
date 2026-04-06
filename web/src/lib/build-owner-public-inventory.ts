/**
 * Builds the same owner inventory list as GET /api/inventory/owner (before price enrichment).
 * Used for trade validation so server checks against merged Steam + manual-lock rows.
 */

import { getOwnerCachedStaleWhileRevalidate, setCache } from "@/lib/inventory-cache";
import { filterJunkFromOwnerSteamItems } from "@/lib/owner-inventory-filters";
import {
  filterSteamItemsTradableForTradeTab,
  getOwnerManualLockDisplayItems,
  mergeOwnerSteamAndManualLockJson,
  type OwnerPublicInventoryRow,
} from "@/lib/owner-manual-trade-lock";
import { fetchOwnerInventory, type NormalizedItem } from "@/lib/steam-inventory";

export type BuildOwnerPublicInventoryResult =
  | { ok: true; items: OwnerPublicInventoryRow[]; manualLockCount: number; steamCacheWasStale: boolean }
  | { ok: false; error: string };

export async function buildOwnerPublicInventoryItems(): Promise<BuildOwnerPublicInventoryResult> {
  const ownerSteamId = process.env.OWNER_STEAM_ID;
  if (!ownerSteamId) return { ok: false, error: "missing_owner_steam_id" };

  const swr = getOwnerCachedStaleWhileRevalidate(ownerSteamId);
  let steamCacheWasStale = false;
  let items: NormalizedItem[] | null = null;

  if (swr) {
    items = swr.items;
    steamCacheWasStale = swr.isStale;
  } else {
    const result = await fetchOwnerInventory();
    if (!result.ok) return { ok: false, error: result.error };
    items = filterJunkFromOwnerSteamItems(result.items);
    setCache(ownerSteamId, items);
    const locked = items.filter((i) => !i.tradable).length;
    console.log(
      `[build-owner-public-inventory] loaded ${result.items.length} → ${items.length} (junk filtered; tradable=false: ${locked})`,
    );
  }

  const steamTradable = filterSteamItemsTradableForTradeTab(items);
  const manualLock = await getOwnerManualLockDisplayItems();
  const merged = mergeOwnerSteamAndManualLockJson(steamTradable, manualLock);
  return { ok: true, items: merged, manualLockCount: manualLock.length, steamCacheWasStale };
}
