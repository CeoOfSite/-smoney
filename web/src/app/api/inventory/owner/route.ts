/**
 * GET /api/inventory/owner — public endpoint for owner's CS2 inventory.
 * Cached server-side; fetches via Steam Web API Key (sees trade-locked items).
 */
import { NextResponse } from "next/server";

import { getCached, setCache } from "@/lib/inventory-cache";
import { fetchOwnerInventory } from "@/lib/steam-inventory";
import type { NormalizedItem } from "@/lib/steam-inventory";
import { resolvePrice } from "@/lib/pricempire";

export const dynamic = "force-dynamic";

export async function GET() {
  const ownerSteamId = process.env.OWNER_STEAM_ID;
  if (!ownerSteamId) {
    return NextResponse.json({ error: "owner_not_configured" }, { status: 500 });
  }

  let items: NormalizedItem[] | null = getCached(ownerSteamId);

  if (!items) {
    const result = await fetchOwnerInventory();
    if (!result.ok) {
      console.error("[/api/inventory/owner] fetch failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    items = result.items;
    console.log(`[/api/inventory/owner] loaded ${items.length} items`);
    setCache(ownerSteamId, items);
  }

  try {
    const enriched = await enrichWithPrices(items, "owner");
    return NextResponse.json({ items: enriched, count: enriched.length });
  } catch (e) {
    console.error("[/api/inventory/owner] enrichWithPrices error:", e);
    return NextResponse.json(
      { items: items.map((i) => ({ ...i, priceUsd: 0, priceSource: "unavailable", belowThreshold: true })), count: items.length },
    );
  }
}

async function enrichWithPrices(
  items: NormalizedItem[],
  side: "owner" | "guest",
) {
  return Promise.all(
    items.map(async (item) => {
      const resolved = await resolvePrice(
        item.marketHashName,
        item.phaseLabel,
        item.assetId,
        side,
      );
      return {
        ...item,
        priceUsd: resolved.priceUsd,
        priceSource: resolved.source,
        belowThreshold: resolved.belowThreshold,
      };
    }),
  );
}
