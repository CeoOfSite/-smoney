import { setCache } from "@/lib/inventory-cache";
import { filterJunkFromOwnerSteamItems } from "@/lib/owner-inventory-filters";
import { fetchOwnerInventory } from "@/lib/steam-inventory";

/** Fetches owner inventory from Steam and replaces the in-memory cache entry. */
export async function refreshOwnerSteamItemsInCache(ownerSteamId: string): Promise<boolean> {
  const result = await fetchOwnerInventory();
  if (!result.ok) return false;
  const items = filterJunkFromOwnerSteamItems(result.items);
  setCache(ownerSteamId, items);
  const locked = items.filter((i) => !i.tradable).length;
  console.log(
    `[owner-steam-cache-refresh] refreshed ${result.items.length} → ${items.length} (tradable=false: ${locked})`,
  );
  return true;
}
