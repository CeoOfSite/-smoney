import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

function userWhereFromSearch(search: string): Prisma.UserWhereInput {
  const q = search.trim();
  if (!q) return {};
  return {
    steamId: { contains: q, mode: "insensitive" },
  };
}

/** Admin-only paginated users (optional partial Steam ID search). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const search = url.searchParams.get("search") ?? "";

  const where = userWhereFromSearch(search);

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        steamId: true,
        displayName: true,
        tradeUrl: true,
        createdAt: true,
        lastLoginAt: true,
        isBanned: true,
        isAdmin: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const data = rows.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    data,
    total,
    page,
    totalPages,
  });
}
