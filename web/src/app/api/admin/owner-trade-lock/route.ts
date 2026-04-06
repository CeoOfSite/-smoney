/**
 * GET    /api/admin/owner-trade-lock — current list meta (admin).
 * PUT    /api/admin/owner-trade-lock — replace list from JSON text or assetIds[].
 * DELETE /api/admin/owner-trade-lock — remove DB row → fall back to file/env again.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  computeOwnerManualTradeLockDiagnostics,
  extractManualTradeLockEntries,
  getOwnerManualTradeLockRule,
  resolveOwnerManualTradeLockFilePath,
} from "@/lib/owner-manual-trade-lock";
import { prisma } from "@/lib/prisma";
import { fetchOwnerInventory } from "@/lib/steam-inventory";

export const dynamic = "force-dynamic";

const MAX_JSON_CHARS = 25_000_000;

async function assertAdmin() {
  const user = await getSessionUser();
  if (!user?.isAdmin) return null;
  return user;
}

export async function GET(request: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const row = await prisma.ownerManualTradeLockList.findUnique({
    where: { id: "singleton" },
  });

  const base = {
    loadedFromDb: !!row,
    assetIdCount: row?.assetIds.length ?? 0,
    classInstanceKeyCount: row?.classInstanceKeys.length ?? 0,
    /** @deprecated use assetIdCount */
    count: row?.assetIds.length ?? 0,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    sampleAssetIds: row ? row.assetIds.slice(0, 12) : [],
    sampleClassInstanceKeys: row ? row.classInstanceKeys.slice(0, 12) : [],
    fileFallbackPath: resolveOwnerManualTradeLockFilePath(),
    classInstanceOnlyEnv: process.env.OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY ?? "",
  };

  if (request.nextUrl.searchParams.get("diagnose") === "1") {
    const inv = await fetchOwnerInventory();
    if (!inv.ok) {
      return NextResponse.json(
        { ...base, diagnoseError: inv.error, diagnose: null },
        { status: 502 },
      );
    }
    const rule = await getOwnerManualTradeLockRule();
    const diagnose = computeOwnerManualTradeLockDiagnostics(inv.items, rule);
    return NextResponse.json({ ...base, diagnose });
  }

  return NextResponse.json(base);
}

export async function PUT(request: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { jsonText?: unknown; assetIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let assetIds: string[] = [];
  let classInstanceKeys: string[] = [];

  if (typeof body.jsonText === "string") {
    const text = body.jsonText;
    if (text.length > MAX_JSON_CHARS) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      const ex = extractManualTradeLockEntries(parsed);
      assetIds = ex.assetIds;
      classInstanceKeys = ex.classInstanceKeys;
    } catch {
      return NextResponse.json({ error: "invalid_json_text" }, { status: 400 });
    }
  } else if (Array.isArray(body.assetIds)) {
    assetIds = body.assetIds.filter((x): x is string => typeof x === "string" && x.length > 0);
  } else {
    return NextResponse.json(
      { error: "expected_jsonText_or_assetIds", message: "Передайте jsonText (строка JSON) или assetIds (массив строк)" },
      { status: 400 },
    );
  }

  const uniqueAssetIds = [...new Set(assetIds)];
  const uniqueCi = [...new Set(classInstanceKeys)];

  const row = await prisma.ownerManualTradeLockList.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", assetIds: uniqueAssetIds, classInstanceKeys: uniqueCi },
    update: { assetIds: uniqueAssetIds, classInstanceKeys: uniqueCi },
  });

  return NextResponse.json({
    ok: true,
    assetIdCount: row.assetIds.length,
    classInstanceKeyCount: row.classInstanceKeys.length,
    count: row.assetIds.length,
    updatedAt: row.updatedAt.toISOString(),
    message: `Сохранено: ${row.assetIds.length} asset id, ${row.classInstanceKeys.length} пар classid+instanceid`,
  });
}

export async function DELETE() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.ownerManualTradeLockList.deleteMany({ where: { id: "singleton" } });

  return NextResponse.json({ ok: true, message: "Список в БД удалён; при наличии файла используется он" });
}
