/**
 * GET    /api/admin/owner-trade-lock — current list meta (admin).
 * PUT    /api/admin/owner-trade-lock — replace list from JSON text or assetIds[].
 * DELETE /api/admin/owner-trade-lock — remove DB row → fall back to file/env again.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  extractManualTradeLockAssetIds,
  resolveOwnerManualTradeLockFilePath,
} from "@/lib/owner-manual-trade-lock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_JSON_CHARS = 25_000_000;

async function assertAdmin() {
  const user = await getSessionUser();
  if (!user?.isAdmin) return null;
  return user;
}

export async function GET() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const row = await prisma.ownerManualTradeLockList.findUnique({
    where: { id: "singleton" },
  });

  return NextResponse.json({
    loadedFromDb: !!row,
    count: row?.assetIds.length ?? 0,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    sampleIds: row ? row.assetIds.slice(0, 15) : [],
    fileFallbackPath: resolveOwnerManualTradeLockFilePath(),
  });
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

  let ids: string[] = [];

  if (typeof body.jsonText === "string") {
    const text = body.jsonText;
    if (text.length > MAX_JSON_CHARS) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      ids = extractManualTradeLockAssetIds(parsed);
    } catch {
      return NextResponse.json({ error: "invalid_json_text" }, { status: 400 });
    }
  } else if (Array.isArray(body.assetIds)) {
    ids = body.assetIds.filter((x): x is string => typeof x === "string" && x.length > 0);
  } else {
    return NextResponse.json(
      { error: "expected_jsonText_or_assetIds", message: "Передайте jsonText (строка JSON) или assetIds (массив строк)" },
      { status: 400 },
    );
  }

  const unique = [...new Set(ids)];

  const row = await prisma.ownerManualTradeLockList.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", assetIds: unique },
    update: { assetIds: unique },
  });

  return NextResponse.json({
    ok: true,
    count: row.assetIds.length,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function DELETE() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.ownerManualTradeLockList.deleteMany({ where: { id: "singleton" } });

  return NextResponse.json({ ok: true, message: "Список в БД удалён; при наличии файла используется он" });
}
