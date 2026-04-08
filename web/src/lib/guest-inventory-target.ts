import type { User } from "@prisma/client";

import { parseTradeUrl, trySteamId64FromPartner } from "@/lib/steam-inventory";

export type GuestInventoryActor = Pick<User, "steamId" | "tradeUrl" | "isAdmin">;

/**
 * SteamID64 used as cache key and inventory-owner context for the saved trade URL.
 * - Admin: owner encoded in the URL (`derivedSteamId` from `partner`).
 * - Regular user: signed-in account; URL is validated to match that account on save.
 */
export function resolveGuestInventoryTargetSteamId(user: GuestInventoryActor): string | null {
  if (!user.tradeUrl?.trim()) return null;
  const parsed = parseTradeUrl(user.tradeUrl.trim());
  if (!parsed) return null;
  const derivedSteamId = trySteamId64FromPartner(parsed.partner);
  if (!derivedSteamId) return null;
  const targetSteamId = user.isAdmin ? derivedSteamId : user.steamId;
  return targetSteamId;
}
