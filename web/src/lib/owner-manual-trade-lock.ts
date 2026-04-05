/**
 * Owner/store inventory: manual trade-lock overlay (paste Steam JSON in admin).
 *
 * Steam may return different `assetid` for the same item across contexts (e.g. 730/16 vs 730/2).
 * We match on assetId and on "classid_instanceid" from pasted `assets[]` so locks still apply.
 *
 * Priority: DB row (if present) → file OWNER_MANUAL_TRADE_LOCK_PATH / data/owner-manual-trade-lock.json
 */

import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";

import type { NormalizedItem } from "./steam-inventory";

export type OwnerManualTradeLockRule = {
  assetIds: ReadonlySet<string>;
  classInstanceKeys: ReadonlySet<string>;
};

const EMPTY_RULE: OwnerManualTradeLockRule = {
  assetIds: new Set(),
  classInstanceKeys: new Set(),
};

export function itemMatchesOwnerManualLock(item: NormalizedItem, rule: OwnerManualTradeLockRule): boolean {
  // Steam JSON often has numeric assetid/classid/instanceid; DB stores strings — Set.has is strict.
  const aid = String(item.assetId);
  if (rule.assetIds.has(aid)) return true;
  if (rule.classInstanceKeys.size === 0) return false;
  const key = `${String(item.classId)}_${String(item.instanceId)}`;
  return rule.classInstanceKeys.has(key);
}

/** From pasted JSON: asset ids + classid_instanceid keys (from assets[] entries). */
export function extractManualTradeLockEntries(parsed: unknown): {
  assetIds: string[];
  classInstanceKeys: string[];
} {
  const assetIdSet = new Set<string>();
  const ciSet = new Set<string>();

  const addFromAssetsArray = (assets: unknown[]) => {
    for (const a of assets) {
      if (!a || typeof a !== "object") continue;
      const rec = a as Record<string, unknown>;
      const aid = rec.assetid ?? rec.assetId;
      if (typeof aid === "string" && aid.length > 0) assetIdSet.add(aid);
      else if (typeof aid === "number" && Number.isFinite(aid)) assetIdSet.add(String(aid));
      const cid = rec.classid ?? rec.classId;
      const iid = rec.instanceid ?? rec.instanceId;
      if (cid != null && iid != null) {
        const cs = String(cid);
        const is = String(iid);
        if (cs.length > 0 && is.length > 0) ciSet.add(`${cs}_${is}`);
      }
    }
  };

  if (parsed == null) return { assetIds: [], classInstanceKeys: [] };
  if (Array.isArray(parsed)) {
    for (const x of parsed) {
      if (typeof x === "string" && x.length > 0) assetIdSet.add(x);
    }
    return { assetIds: [...assetIdSet], classInstanceKeys: [...ciSet] };
  }
  if (typeof parsed !== "object") return { assetIds: [], classInstanceKeys: [] };
  const o = parsed as Record<string, unknown>;

  if (Array.isArray(o.assetIds)) {
    for (const x of o.assetIds) {
      if (typeof x === "string" && x.length > 0) assetIdSet.add(x);
    }
  }
  if (Array.isArray(o.assets)) {
    addFromAssetsArray(o.assets);
  }

  return { assetIds: [...assetIdSet], classInstanceKeys: [...ciSet] };
}

/** @deprecated narrow — prefer extractManualTradeLockEntries for full data */
export function extractManualTradeLockAssetIds(parsed: unknown): string[] {
  return extractManualTradeLockEntries(parsed).assetIds;
}

export function resolveOwnerManualTradeLockFilePath(): string | null {
  const fromEnv = process.env.OWNER_MANUAL_TRADE_LOCK_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), fromEnv);
  }

  const def = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "owner-manual-trade-lock.json");
  try {
    if (fs.existsSync(def)) return def;
  } catch {
    /* ignore */
  }
  return null;
}

let cachedMtimeMs = 0;
let cachedPath: string | null = null;
let cachedFileRule: OwnerManualTradeLockRule = EMPTY_RULE;

function reloadRuleFromFile(filePath: string): OwnerManualTradeLockRule {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const { assetIds, classInstanceKeys } = extractManualTradeLockEntries(parsed);
  return {
    assetIds: new Set(assetIds),
    classInstanceKeys: new Set(classInstanceKeys),
  };
}

/** File-based rule only (cached by mtime). */
export function getOwnerManualTradeLockRuleFromFile(): OwnerManualTradeLockRule {
  const filePath = resolveOwnerManualTradeLockFilePath();
  if (!filePath) {
    cachedPath = null;
    cachedMtimeMs = 0;
    cachedFileRule = EMPTY_RULE;
    return cachedFileRule;
  }

  try {
    const st = fs.statSync(filePath);
    if (cachedPath === filePath && st.mtimeMs === cachedMtimeMs) return cachedFileRule;

    cachedFileRule = reloadRuleFromFile(filePath);
    cachedPath = filePath;
    cachedMtimeMs = st.mtimeMs;
    const n = cachedFileRule.assetIds.size + cachedFileRule.classInstanceKeys.size;
    if (n > 0) {
      console.log(
        `[owner-manual-trade-lock] loaded from file ${filePath}: ${cachedFileRule.assetIds.size} asset ids, ${cachedFileRule.classInstanceKeys.size} class+instance keys`,
      );
    }
    return cachedFileRule;
  } catch (e) {
    console.error("[owner-manual-trade-lock] failed to read lock file:", filePath, e);
    cachedFileRule = EMPTY_RULE;
    cachedPath = filePath;
    cachedMtimeMs = 0;
    return cachedFileRule;
  }
}

/** DB row if any, else file. */
export async function getOwnerManualTradeLockRule(): Promise<OwnerManualTradeLockRule> {
  try {
    const row = await prisma.ownerManualTradeLockList.findUnique({
      where: { id: "singleton" },
    });
    if (row) {
      return {
        assetIds: new Set(row.assetIds),
        classInstanceKeys: new Set(row.classInstanceKeys),
      };
    }
  } catch (e) {
    console.error("[owner-manual-trade-lock] db read failed:", e);
  }
  return getOwnerManualTradeLockRuleFromFile();
}

/**
 * @param ruleOverride optional (tests); otherwise DB then file.
 */
export async function applyOwnerManualTradeLock(
  items: NormalizedItem[],
  ruleOverride?: OwnerManualTradeLockRule,
): Promise<NormalizedItem[]> {
  const rule = ruleOverride ?? (await getOwnerManualTradeLockRule());
  if (rule.assetIds.size === 0 && rule.classInstanceKeys.size === 0) return items;
  return items.map((i) =>
    itemMatchesOwnerManualLock(i, rule) ? { ...i, tradable: false } : i,
  );
}
