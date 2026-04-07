import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getOrCreateConversation, parseSteamId64Input } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/admin/chat/start — body: { steamId } — get or create conversation. */
export async function POST(request: NextRequest) {
  const admin = await getSessionUser();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw =
    typeof body === "object" && body !== null && "steamId" in body
      ? String((body as { steamId: unknown }).steamId ?? "")
      : "";
  const steamId = parseSteamId64Input(raw);
  if (!steamId) {
    return NextResponse.json({ error: "invalid_steam_id" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { steamId },
    select: { steamId: true, displayName: true, avatarUrl: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const conv = await getOrCreateConversation(steamId);

  return NextResponse.json({
    conversationId: conv.id,
    userSteamId: target.steamId,
    userDisplayName: target.displayName,
    userAvatarUrl: target.avatarUrl,
  });
}
