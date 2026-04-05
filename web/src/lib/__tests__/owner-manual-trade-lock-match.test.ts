import { describe, it, expect } from "vitest";
import { applyOwnerManualTradeLock, extractManualTradeLockEntries, itemMatchesOwnerManualLock } from "../owner-manual-trade-lock";
import { normalizeInventory } from "../steam-inventory";
import type { NormalizedItem } from "../steam-inventory";

/**
 * Regression: Steam community JSON often uses numeric assetid/classid/instanceid in `assets[]`,
 * while pasted admin JSON uses strings. Set.has() must not miss because of number vs string.
 */
describe("manual trade lock matches normalized inventory (realistic types)", () => {
  it("itemMatchesOwnerManualLock: numeric-like item fields + string rule Set", () => {
    const item = {
      assetId: 50881305496,
      classId: 7993039468,
      instanceId: 8347147322,
    } as unknown as NormalizedItem;
    const rule = {
      assetIds: new Set(["50881305496"]),
      classInstanceKeys: new Set<string>(),
    };
    expect(itemMatchesOwnerManualLock(item, rule)).toBe(true);
  });

  it("itemMatchesOwnerManualLock: class+instance string rule + numeric-like item fields", () => {
    const item = {
      assetId: "other",
      classId: 7993039468,
      instanceId: 8347147322,
    } as unknown as NormalizedItem;
    const rule = {
      assetIds: new Set<string>(),
      classInstanceKeys: new Set(["7993039468_8347147322"]),
    };
    expect(itemMatchesOwnerManualLock(item, rule)).toBe(true);
  });

  it("end-to-end: numeric assets[] + string pasted extract → applyOwnerManualTradeLock", async () => {
    const pasted = {
      assets: [
        {
          assetid: "50881305496",
          classid: "7993039468",
          instanceid: "8347147322",
          amount: "1",
        },
      ],
    };
    const ex = extractManualTradeLockEntries(pasted);
    const rule = {
      assetIds: new Set(ex.assetIds),
      classInstanceKeys: new Set(ex.classInstanceKeys),
    };

    const rawInventory = {
      assets: [
        {
          assetid: 50881305496,
          classid: 7993039468,
          instanceid: 8347147322,
          amount: "1",
        },
      ],
      descriptions: [
        {
          classid: 7993039468,
          instanceid: 8347147322,
          market_hash_name: "AK-47 | Redline (Field-Tested)",
          name: "AK-47 | Redline",
          icon_url: "icon",
          tradable: 1,
          marketable: 1,
          tags: [],
        },
      ],
    };

    const items = normalizeInventory(rawInventory);
    expect(items).toHaveLength(1);
    expect(items[0].tradable).toBe(true);

    const out = await applyOwnerManualTradeLock(items, rule);
    expect(out[0].tradable).toBe(false);
  });
});
