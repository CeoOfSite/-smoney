/**
 * Owner/store inventory: optional manual trade-lock overlay by assetId.
 *
 * Priority:
 * 1. DB row (admin pasted Steam JSON) — if present, even empty [] means "no manual locks".
 * 2. File from OWNER_MANUAL_TRADE_LOCK_PATH or data/owner-manual-trade-lock.json
 *
 * Steam browser JSON (e.g. { assets: [{ assetid: "..." }] }) is parsed the same as a minified file.
 */

import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";

import type { NormalizedItem } from "./steam-inventory";

/** Parse myskins-style or simple list JSON into asset id strings. */
export function extractManualTradeLockAssetIds(parsed: unknown): string[] {
  if (parsed == null) return [];
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (typeof parsed !== "object") return [];
  const o = parsed as Record<string, unknown>;

  if (Array.isArray(o.assetIds)) {
    return o.assetIds.filter((x): x is string => typeof x === "string" && x.length > 0);
  }

  if (Array.isArray(o.assets)) {
    const out: string[] = [];
    for (const a of o.assets) {
      if (!a || typeof a !== "object") continue;
      const rec = a as Record<string, unknown>;
      const id = rec.assetid ?? rec.assetId;
      if (typeof id === "string" && id.length > 0) out.push(id);
      else if (typeof id === "number" && Number.isFinite(id)) out.push(String(id));
    }
    return out;
  }

  return [];
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
let cachedFileSet: Set<string> = new Set();

function reloadLockSetFromFile(filePath: string): Set<string> {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const ids = extractManualTradeLockAssetIds(parsed);
  return new Set(ids);
}

/** File-based set only (cached by mtime). */
export function getOwnerManualTradeLockSetFromFile(): Set<string> {
  const filePath = resolveOwnerManualTradeLockFilePath();
  if (!filePath) {
    cachedPath = null;
    cachedMtimeMs = 0;
    cachedFileSet = new Set();
    return cachedFileSet;
  }

  try {
    const st = fs.statSync(filePath);
    if (cachedPath === filePath && st.mtimeMs === cachedMtimeMs) return cachedFileSet;

    cachedFileSet = reloadLockSetFromFile(filePath);
    cachedPath = filePath;
    cachedMtimeMs = st.mtimeMs;
    if (cachedFileSet.size > 0) {
      console.log(`[owner-manual-trade-lock] loaded ${cachedFileSet.size} asset ids from ${filePath}`);
    }
    return cachedFileSet;
  } catch (e) {
    console.error("[owner-manual-trade-lock] failed to read lock file:", filePath, e);
    cachedFileSet = new Set();
    cachedPath = filePath;
    cachedMtimeMs = 0;
    return cachedFileSet;
  }
}

/** DB row if any, else file. */
export async function getOwnerManualTradeLockSet(): Promise<Set<string>> {
  try {
    const row = await prisma.ownerManualTradeLockList.findUnique({
      where: { id: "singleton" },
    });
    if (row) return new Set(row.assetIds);
  } catch (e) {
    console.error("[owner-manual-trade-lock] db read failed:", e);
  }
  return getOwnerManualTradeLockSetFromFile();
}

/**
 * @param lockSet optional override (tests); otherwise DB then file.
 */
export async function applyOwnerManualTradeLock(
  items: NormalizedItem[],
  lockSet?: ReadonlySet<string>,
): Promise<NormalizedItem[]> {
  const lock = lockSet ?? (await getOwnerManualTradeLockSet());
  if (lock.size === 0) return items;
  return items.map((i) => (lock.has(i.assetId) ? { ...i, tradable: false } : i));
}
