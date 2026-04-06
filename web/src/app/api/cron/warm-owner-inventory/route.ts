import { NextRequest, NextResponse } from "next/server";

import { warmOwnerInventoryCache } from "@/lib/owner-inventory-warm";

export const dynamic = "force-dynamic";

/**
 * Owner inventory warm (same as instrumentation interval). Use on serverless where setInterval
 * does not persist — schedule hourly (or match OWNER_INVENTORY_WARM_MS).
 * GET with header: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await warmOwnerInventoryCache();
  return NextResponse.json({ ok: true });
}
