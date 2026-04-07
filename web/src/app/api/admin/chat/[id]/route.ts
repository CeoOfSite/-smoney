import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { CHAT_SENDER, serializeChatMessage } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat/[id] — messages (marks user→admin as read). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      user: { select: { steamId: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.chatMessage.updateMany({
    where: {
      conversationId: conv.id,
      sender: CHAT_SENDER.user,
      isRead: false,
    },
    data: { isRead: true },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    conversation: {
      id: conv.id,
      userSteamId: conv.user.steamId,
      userDisplayName: conv.user.displayName,
      userAvatarUrl: conv.user.avatarUrl,
    },
    messages: messages.map(serializeChatMessage),
  });
}
