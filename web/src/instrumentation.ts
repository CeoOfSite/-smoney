/**
 * Long-running Node (e.g. Render): owner store inventory — warm cache on boot + every hour.
 * Set OWNER_INVENTORY_WARM_MS=0 to disable. Override interval in ms (min 60s).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const raw = process.env.OWNER_INVENTORY_WARM_MS;
  if (raw === "0" || raw === "false") return;
  const oneHour = 60 * 60 * 1000;
  const ms = raw ? parseInt(raw, 10) : oneHour;
  if (!Number.isFinite(ms) || ms < 60_000) return;

  const { warmOwnerInventoryCache } = await import("@/lib/owner-inventory-warm");
  void warmOwnerInventoryCache();
  setInterval(() => {
    void warmOwnerInventoryCache();
  }, ms);
}
