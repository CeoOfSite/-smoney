import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { CHAT_SENDER } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat — list conversations (admin only). */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const conversations = await prisma.chatConversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      user: {
        select: { steamId: true, displayName: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true, createdAt: true, sender: true },
      },
    },
  });

  const ids = conversations.map((c) => c.id);
  const unreadRows =
    ids.length === 0
      ? []
      : await prisma.chatMessage.groupBy({
          by: ["conversationId"],
          where: {
            conversationId: { in: ids },
            sender: CHAT_SENDER.user,
            isRead: false,
          },
          _count: { id: true },
        });
  const unreadByConv = new Map(unreadRows.map((r) => [r.conversationId, r._count.id]));

  const totalUnreadUserMessages = unreadRows.reduce((a, r) => a + r._count.id, 0);

  const data = conversations.map((c) => {
    const last = c.messages[0];
    return {
      id: c.id,
      userSteamId: c.user.steamId,
      userDisplayName: c.user.displayName,
      userAvatarUrl: c.user.avatarUrl,
      updatedAt: c.updatedAt.toISOString(),
      lastMessagePreview: last ? last.text.slice(0, 200) : null,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
      lastSender: last?.sender ?? null,
      unreadFromUser: unreadByConv.get(c.id) ?? 0,
    };
  });

  return NextResponse.json({ data, totalUnreadUserMessages });
}
