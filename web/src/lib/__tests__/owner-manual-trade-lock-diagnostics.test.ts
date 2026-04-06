import { afterEach, describe, it, expect } from "vitest";
import {
  computeOwnerManualTradeLockDiagnostics,
  itemMatchesOwnerManualLock,
  type OwnerManualTradeLockRule,
} from "../owner-manual-trade-lock";
import type { NormalizedItem } from "../steam-inventory";

const item = (a: string, c: string, i: string, tradable = true): NormalizedItem => ({
  assetId: a,
  classId: c,
  instanceId: i,
  marketHashName: "x",
  name: "Skin",
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

describe("computeOwnerManualTradeLockDiagnostics", () => {
  it("counts asset vs class matches and union wouldLock", () => {
    const items = [
      item("100", "c1", "i1"),
      item("200", "c2", "i2"),
      item("300", "c3", "i3"),
    ];
    const rule: OwnerManualTradeLockRule = {
      assetIds: new Set(["100", "999"]),
      classInstanceKeys: new Set(["c2_i2", "c9_i9"]),
    };
    const d = computeOwnerManualTradeLockDiagnostics(items, rule);
    expect(d.inventoryItemCount).toBe(3);
    expect(d.matchedByAssetIdCount).toBe(1);
    expect(d.matchedByClassInstanceKeyCount).toBe(1);
    expect(d.matchedClassButNotAssetIdCount).toBe(1);
    expect(d.wouldLockCount).toBe(2);
    expect(d.sampleRuleAssetIdsMissingInInventory).toContain("999");
    expect(d.sampleRuleClassKeysMissingInInventory).toContain("c9_i9");
  });
});

describe("OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY", () => {
  afterEach(() => {
    delete process.env.OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY;
  });

  it("ignores asset id in rule when env is true", () => {
    process.env.OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY = "true";
    const rule: OwnerManualTradeLockRule = {
      assetIds: new Set(["1"]),
      classInstanceKeys: new Set(),
    };
    expect(itemMatchesOwnerManualLock(item("1", "c", "i"), rule)).toBe(false);
  });

  it("still matches by class when env true", () => {
    process.env.OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY = "1";
    const rule: OwnerManualTradeLockRule = {
      assetIds: new Set(["wrong"]),
      classInstanceKeys: new Set(["cx_ix"]),
    };
    expect(itemMatchesOwnerManualLock(item("999", "cx", "ix"), rule)).toBe(true);
  });
});
