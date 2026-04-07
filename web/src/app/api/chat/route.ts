import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAT_SENDER, serializeChatMessage } from "@/lib/chat";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat — current user's conversation + messages (marks admin messages as read).
 * GET /api/chat?counts=1 — lightweight { unreadFromAdmin, conversationId } for badge polling.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const countsOnly = request.nextUrl.searchParams.get("counts") === "1";

  const conv = await prisma.chatConversation.findUnique({
    where: { userSteamId: user.steamId },
    select: { id: true },
  });

  if (countsOnly) {
    if (!conv) {
      return NextResponse.json({ unreadFromAdmin: 0, conversationId: null });
    }
    const unreadFromAdmin = await prisma.chatMessage.count({
      where: {
        conversationId: conv.id,
        sender: CHAT_SENDER.admin,
        isRead: false,
      },
    });
    return NextResponse.json({ unreadFromAdmin, conversationId: conv.id });
  }

  if (!conv) {
    return NextResponse.json({ conversationId: null, messages: [] });
  }

  await prisma.chatMessage.updateMany({
    where: {
      conversationId: conv.id,
      sender: CHAT_SENDER.admin,
      isRead: false,
    },
    data: { isRead: true },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    conversationId: conv.id,
    messages: messages.map(serializeChatMessage),
  });
}
