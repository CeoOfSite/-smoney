/**
 * POST /api/inventory/refresh — force-refresh inventory.
 * Owner/store: admins only; on success replaces cache (on failure old cache kept). Cooldown 2 min.
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
import { filterJunkFromOwnerSteamItems } from "@/lib/owner-inventory-filters";
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
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const ownerSteamId = process.env.OWNER_STEAM_ID;
    if (!ownerSteamId) {
      return NextResponse.json({ error: "owner_not_configured" }, { status: 500 });
    }

    const cooldown = await refreshCooldownRemainingOwner(ownerSteamId);
    if (cooldown > 0) {
      return NextResponse.json(rateLimitBody(cooldown), { status: 429 });
    }

    const result = await fetchOwnerInventory();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    await setCache(ownerSteamId, filterJunkFromOwnerSteamItems(result.items));
    await markOwnerRefreshed(ownerSteamId);
    return NextResponse.json({
      ok: true,
      count: result.items.length,
      refreshCooldownRemainingMs: await refreshCooldownRemainingOwner(ownerSteamId),
      refreshCooldownTotalMs: OWNER_REFRESH_COOLDOWN_MS,
    });
  }

  // side === "my"
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cooldown = await refreshCooldownRemainingUser(user.steamId);
  if (cooldown > 0) {
    return NextResponse.json(rateLimitBody(cooldown), { status: 429 });
  }

  await invalidateCache(user.steamId);
  await markUserRefreshed(user.steamId);

  const isOwner = user.steamId === process.env.OWNER_STEAM_ID;
  if (isOwner) {
    const result = await fetchOwnerInventory();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    await setCache(user.steamId, filterJunkFromOwnerSteamItems(result.items));
    return NextResponse.json({
      ok: true,
      count: result.items.length,
      refreshCooldownRemainingMs: await refreshCooldownRemainingUser(user.steamId),
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
  await setCache(user.steamId, result.items);
  return NextResponse.json({
    ok: true,
    count: result.items.length,
    refreshCooldownRemainingMs: await refreshCooldownRemainingUser(user.steamId),
    refreshCooldownTotalMs: USER_REFRESH_COOLDOWN_MS,
  });
}
