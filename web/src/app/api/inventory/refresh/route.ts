/**
 * POST /api/inventory/refresh — force-refresh inventory.
 * Owner/store: 1 refresh per 2 minutes (OWNER_STEAM_ID).
 * User "my" inventory: 1 refresh per 2 hours per Steam account.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  invalidateCache,
  markOwnerRefreshed,
  markUserRefreshed,
  refreshCooldownRemainingOwner,
  refreshCooldownRemainingUser,
  setCache,
} from "@/lib/inventory-cache";
import { formatRefreshCooldownRu, OWNER_REFRESH_COOLDOWN_MS, USER_REFRESH_COOLDOWN_MS } from "@/lib/inventory-refresh-limits";
import { fetchGuestInventory, fetchOwnerInventory } from "@/lib/steam-inventory";

export const dynamic = "force-dynamic";

function rateLimitBody(cooldownMs: number) {
  const sec = Math.ceil(cooldownMs / 1000);
  return {
    error: "rate_limited" as const,
    retryAfterMs: cooldownMs,
    message: `Следующее обновление через ${formatRefreshCooldownRu(sec)}`,
  };
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  let body: { side?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const side = body.side ?? "owner";

  if (side === "owner") {
    const ownerSteamId = process.env.OWNER_STEAM_ID;
    if (!ownerSteamId) {
      return NextResponse.json({ error: "owner_not_configured" }, { status: 500 });
    }

    const cooldown = refreshCooldownRemainingOwner(ownerSteamId);
    if (cooldown > 0) {
      return NextResponse.json(rateLimitBody(cooldown), { status: 429 });
    }

    invalidateCache(ownerSteamId);
    markOwnerRefreshed(ownerSteamId);

    const result = await fetchOwnerInventory();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    setCache(ownerSteamId, result.items);
    return NextResponse.json({
      ok: true,
      count: result.items.length,
      refreshCooldownRemainingMs: refreshCooldownRemainingOwner(ownerSteamId),
      refreshCooldownTotalMs: OWNER_REFRESH_COOLDOWN_MS,
    });
  }

  // side === "my"
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cooldown = refreshCooldownRemainingUser(user.steamId);
  if (cooldown > 0) {
    return NextResponse.json(rateLimitBody(cooldown), { status: 429 });
  }

  invalidateCache(user.steamId);
  markUserRefreshed(user.steamId);

  const isOwner = user.steamId === process.env.OWNER_STEAM_ID;
  if (isOwner) {
    const result = await fetchOwnerInventory();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    setCache(user.steamId, result.items);
    return NextResponse.json({
      ok: true,
      count: result.items.length,
      refreshCooldownRemainingMs: refreshCooldownRemainingUser(user.steamId),
      refreshCooldownTotalMs: USER_REFRESH_COOLDOWN_MS,
    });
  }

  if (!user.tradeUrl) {
    return NextResponse.json({ error: "trade_url_required" }, { status: 400 });
  }

  const result = await fetchGuestInventory(user.tradeUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  setCache(user.steamId, result.items);
  return NextResponse.json({
    ok: true,
    count: result.items.length,
    refreshCooldownRemainingMs: refreshCooldownRemainingUser(user.steamId),
    refreshCooldownTotalMs: USER_REFRESH_COOLDOWN_MS,
  });
}
