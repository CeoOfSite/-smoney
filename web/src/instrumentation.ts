/**
 * Long-running Node (e.g. Render): periodic owner Steam snapshot warm.
 * Set OWNER_INVENTORY_WARM_MS=0 to disable. Default 4 minutes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const raw = process.env.OWNER_INVENTORY_WARM_MS;
  if (raw === "0" || raw === "false") return;
  const ms = raw ? parseInt(raw, 10) : 4 * 60 * 1000;
  if (!Number.isFinite(ms) || ms < 60_000) return;

  const { warmOwnerInventoryCache } = await import("@/lib/owner-inventory-warm");
  setInterval(() => {
    void warmOwnerInventoryCache();
  }, ms);
}
