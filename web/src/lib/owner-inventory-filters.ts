import type { NormalizedItem } from "@/lib/steam-inventory";

const JUNK_TYPES = ["Loyalty Badge", "Collectible Coin", "Service Medal", "Season Coin"];

export function filterJunkFromOwnerSteamItems(items: NormalizedItem[]): NormalizedItem[] {
  return items.filter((i) => {
    if (!i.type) return true;
    return !JUNK_TYPES.some((j) => i.type!.includes(j));
  });
}
