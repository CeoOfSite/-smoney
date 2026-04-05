import { describe, it, expect } from "vitest";
import {
  applyOwnerManualTradeLock,
  extractManualTradeLockAssetIds,
  extractManualTradeLockEntries,
  itemMatchesOwnerManualLock,
  type OwnerManualTradeLockRule,
} from "../owner-manual-trade-lock";
import type { NormalizedItem } from "../steam-inventory";

const baseItem = (assetId: string, tradable: boolean, classId = "c", instanceId = "i"): NormalizedItem => ({
  assetId,
  classId,
  instanceId,
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

const emptyRule = (): OwnerManualTradeLockRule => ({
  assetIds: new Set(),
  classInstanceKeys: new Set(),
});

describe("extractManualTradeLockEntries", () => {
  it("reads asset ids and classid_instanceid from Steam assets[]", () => {
    const r = extractManualTradeLockEntries({
      assets: [
        { assetid: "50881305496", classid: "7993039468", instanceid: "8347147322", amount: "1" },
      ],
    });
    expect(r.assetIds).toContain("50881305496");
    expect(r.classInstanceKeys).toContain("7993039468_8347147322");
  });
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

describe("itemMatchesOwnerManualLock", () => {
  it("matches by class+instance when assetId differs", () => {
    const rule: OwnerManualTradeLockRule = {
      assetIds: new Set(),
      classInstanceKeys: new Set(["7993039468_8347147322"]),
    };
    const item = baseItem("different-asset-id", true, "7993039468", "8347147322");
    expect(itemMatchesOwnerManualLock(item, rule)).toBe(true);
  });
});

describe("applyOwnerManualTradeLock", () => {
  it("with explicit empty rule is no-op", async () => {
    const items = [baseItem("1", true), baseItem("2", false)];
    const out = await applyOwnerManualTradeLock(items, emptyRule());
    expect(out[0].tradable).toBe(true);
    expect(out[1].tradable).toBe(false);
  });

  it("forces tradable false for asset id in rule", async () => {
    const rule: OwnerManualTradeLockRule = { assetIds: new Set(["1"]), classInstanceKeys: new Set() };
    const out = await applyOwnerManualTradeLock([baseItem("1", true), baseItem("2", true)], rule);
    expect(out[0].tradable).toBe(false);
    expect(out[1].tradable).toBe(true);
  });

  it("forces tradable false for classid_instanceid in rule", async () => {
    const rule: OwnerManualTradeLockRule = {
      assetIds: new Set<string>(),
      classInstanceKeys: new Set(["cx_ix"]),
    };
    const out = await applyOwnerManualTradeLock([baseItem("999", true, "cx", "ix")], rule);
    expect(out[0].tradable).toBe(false);
  });

  it("keeps already-untradable items untradable", async () => {
    const rule: OwnerManualTradeLockRule = { assetIds: new Set(["1"]), classInstanceKeys: new Set() };
    const out = await applyOwnerManualTradeLock([baseItem("1", false)], rule);
    expect(out[0].tradable).toBe(false);
  });
});
