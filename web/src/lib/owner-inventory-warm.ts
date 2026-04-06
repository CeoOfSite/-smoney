import { refreshOwnerSteamItemsInCache } from "@/lib/owner-steam-cache-refresh";

/** Proactively refresh owner Steam snapshot (cron / instrumentation). */
export async function warmOwnerInventoryCache(): Promise<void> {
  const ownerSteamId = process.env.OWNER_STEAM_ID;
  if (!ownerSteamId) return;
  try {
    await refreshOwnerSteamItemsInCache(ownerSteamId);
  } catch (e) {
    console.warn("[warmOwnerInventoryCache]", e);
  }
}
