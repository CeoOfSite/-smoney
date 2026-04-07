import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { CHAT_SENDER } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ListFilter = "all" | "unread" | "unanswered";

/** GET /api/admin/chat — list conversations (admin only).
 *  ?filter=all|unread|unanswered — unread: has user message with isRead=false; unanswered: last message is from user.
 *  Sort: conversations with any unread from user first, then updatedAt DESC.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("filter");
  if (raw != null && raw !== "all" && raw !== "unread" && raw !== "unanswered") {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  const filter = (raw === "unread" ? "unread" : raw === "unanswered" ? "unanswered" : "all") as ListFilter;

  const whereUnread =
    filter === "unread"
      ? {
          messages: {
            some: { sender: CHAT_SENDER.user, isRead: false },
          },
        }
      : {};

  let conversations = await prisma.chatConversation.findMany({
    where: whereUnread,
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

  if (filter === "unanswered") {
    conversations = conversations.filter((c) => c.messages[0]?.sender === CHAT_SENDER.user);
  }

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

  const totalUnreadUserMessages = await prisma.chatMessage.count({
    where: { sender: CHAT_SENDER.user, isRead: false },
  });

  conversations.sort((a, b) => {
    const ua = unreadByConv.get(a.id) ?? 0;
    const ub = unreadByConv.get(b.id) ?? 0;
    const aUnread = ua > 0;
    const bUnread = ub > 0;
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

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

  return NextResponse.json({ data, totalUnreadUserMessages, filter });
}
