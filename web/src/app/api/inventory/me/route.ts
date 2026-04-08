/**
 * GET /api/inventory/me — CS2 инвентарь для левой колонки.
 * При сохранённой trade URL всегда грузим гостевой инвентарь по derivedSteamId из ссылки
 * (в т.ч. для аккаунта OWNER_STEAM_ID при подмене URL), иначе для владельца магазина — owner snapshot.
 */
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  guestTradeUrlHttpRejection,
  resolveGuestInventoryTargetSteamId,
  warnIfGuestSteamIdEqualsOwner,
} from "@/lib/guest-inventory-target";
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

  const ownerSteamId = process.env.OWNER_STEAM_ID ?? "";
  const isPlatformOwner = ownerSteamId !== "" && user.steamId === ownerSteamId;
  const guestTargetSteamId = resolveGuestInventoryTargetSteamId(user);

  if (guestTargetSteamId) {
    warnIfGuestSteamIdEqualsOwner("inventory/me", guestTargetSteamId);

    let items: NormalizedItem[] | null = await getCached(guestTargetSteamId);
    if (!items) {
      const result = await fetchGuestInventory(user.tradeUrl!);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      items = result.items;
      await setCache(guestTargetSteamId, items);
    }

    const enriched = await enrichWithPrices(items, "guest");
    return NextResponse.json({
      items: enriched,
      count: enriched.length,
      refreshCooldownRemainingMs: await refreshCooldownRemainingUser(user.steamId),
    });
  }

  if (isPlatformOwner) {
    const cacheKeySteamId = user.steamId;
    let items: NormalizedItem[] | null = await getCached(cacheKeySteamId);
    if (!items) {
      const result = await fetchOwnerInventory();
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      items = result.items;
      await setCache(cacheKeySteamId, items);
    }
    const enriched = await enrichWithPrices(items, "owner");
    return NextResponse.json({
      items: enriched,
      count: enriched.length,
      refreshCooldownRemainingMs: await refreshCooldownRemainingUser(user.steamId),
    });
  }

  if (user.tradeUrl?.trim()) {
    const rej = guestTradeUrlHttpRejection(user);
    return NextResponse.json(
      rej ?? {
        error: "invalid_trade_url",
        message: "Сохранённая trade-ссылка некорректна. Укажите ссылку заново.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "trade_url_required", message: "Сначала сохраните вашу trade-ссылку" },
    { status: 400 },
  );
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
