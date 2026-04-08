/**
 * GET /api/inventory/me — logged-in user's own CS2 inventory.
 * Requires auth + saved trade URL (for guest users).
 * Owner can also call this but typically uses /owner.
 */
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { resolveGuestInventoryTargetSteamId } from "@/lib/guest-inventory-target";
import { getCached, refreshCooldownRemainingUser, setCache } from "@/lib/inventory-cache";
import { fetchGuestInventory, fetchOwnerInventory } from "@/lib/steam-inventory";
import type { NormalizedItem } from "@/lib/steam-inventory";
import { resolvePricesBatch } from "@/lib/pricempire";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const isOwner = user.steamId === process.env.OWNER_STEAM_ID;

  const guestTargetSteamId = !isOwner ? resolveGuestInventoryTargetSteamId(user) : null;
  const cacheKeySteamId = isOwner ? user.steamId : guestTargetSteamId;

  if (!isOwner && user.tradeUrl && !guestTargetSteamId) {
    return NextResponse.json(
      { error: "invalid_trade_url", message: "Сохранённая trade-ссылка некорректна. Укажите ссылку заново." },
      { status: 400 },
    );
  }

  let items: NormalizedItem[] | null =
    cacheKeySteamId != null ? await getCached(cacheKeySteamId) : null;

  if (!items) {
    if (isOwner) {
      const result = await fetchOwnerInventory();
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      items = result.items;
    } else {
      if (!user.tradeUrl) {
        return NextResponse.json(
          { error: "trade_url_required", message: "Сначала сохраните вашу trade-ссылку" },
          { status: 400 },
        );
      }
      const result = await fetchGuestInventory(user.tradeUrl);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      items = result.items;
    }
    if (cacheKeySteamId != null) {
      await setCache(cacheKeySteamId, items);
    }
  }

  const side = isOwner ? "owner" : "guest";
  const enriched = await enrichWithPrices(items, side);

  return NextResponse.json({
    items: enriched,
    count: enriched.length,
    refreshCooldownRemainingMs: await refreshCooldownRemainingUser(user.steamId),
  });
}

async function enrichWithPrices(items: NormalizedItem[], side: "owner" | "guest") {
  const keys = items.map((item) => ({
    marketHashName: item.marketHashName,
    phaseLabel: item.phaseLabel,
    assetId: item.assetId,
  }));
  const resolved = await resolvePricesBatch(keys, side);
  return items.map((item, i) => {
    const r = resolved[i]!;
    return {
      ...item,
      priceUsd: r.priceUsd,
      priceSource: r.source,
      belowThreshold: r.belowThreshold,
    };
  });
}
