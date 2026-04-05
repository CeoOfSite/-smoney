import { describe, it, expect } from "vitest";
import { applyOwnerManualTradeLock, extractManualTradeLockAssetIds } from "../owner-manual-trade-lock";
import type { NormalizedItem } from "../steam-inventory";

const baseItem = (assetId: string, tradable: boolean): NormalizedItem => ({
  assetId,
  classId: "c",
  instanceId: "i",
  marketHashName: "AK-47 | Redline (Field-Tested)",
  name: "AK-47 | Redline",
  iconUrl: "",
  rarity: null,
  rarityColor: null,
  type: null,
  wear: null,
  floatValue: null,
  phaseLabel: null,
  stickers: [],
  tradeLockUntil: null,
  tradable,
  marketable: true,
  inspectLink: null,
});

describe("extractManualTradeLockAssetIds", () => {
  it("reads myskins-style assets[].assetid", () => {
    const ids = extractManualTradeLockAssetIds({
      assets: [
        { assetid: "111", classid: "a" },
        { assetid: 222, classid: "b" },
      ],
    });
    expect(ids).toEqual(["111", "222"]);
  });

  it("reads assetIds array", () => {
    expect(extractManualTradeLockAssetIds({ assetIds: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("reads plain string array", () => {
    expect(extractManualTradeLockAssetIds(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns empty for unknown shape", () => {
    expect(extractManualTradeLockAssetIds({})).toEqual([]);
    expect(extractManualTradeLockAssetIds(null)).toEqual([]);
  });
});

describe("applyOwnerManualTradeLock", () => {
  it("with explicit empty set is no-op", async () => {
    const items = [baseItem("1", true), baseItem("2", false)];
    const out = await applyOwnerManualTradeLock(items, new Set());
    expect(out[0].tradable).toBe(true);
    expect(out[1].tradable).toBe(false);
  });

  it("forces tradable false only for ids in lock set", async () => {
    const lock = new Set(["1"]);
    const out = await applyOwnerManualTradeLock([baseItem("1", true), baseItem("2", true)], lock);
    expect(out[0].tradable).toBe(false);
    expect(out[1].tradable).toBe(true);
  });

  it("keeps already-untradable items untradable", async () => {
    const lock = new Set(["1"]);
    const out = await applyOwnerManualTradeLock([baseItem("1", false)], lock);
    expect(out[0].tradable).toBe(false);
  });
});
