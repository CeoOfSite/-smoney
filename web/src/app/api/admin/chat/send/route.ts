import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  assertAdminCanSend,
  CHAT_SENDER,
  normalizeChatText,
  serializeChatMessage,
} from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/admin/chat/send — body: { conversationId, text } */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const conversationId =
    typeof (body as { conversationId?: unknown }).conversationId === "string"
      ? (body as { conversationId: string }).conversationId.trim()
      : "";
  const text = normalizeChatText((body as { text?: unknown }).text);

  if (!conversationId || !text) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rate = await assertAdminCanSend(conversationId);
  if (!rate.ok) {
    return NextResponse.json({ error: rate.error }, { status: rate.status });
  }

  const msg = await prisma.chatMessage.create({
    data: {
      conversationId,
      sender: CHAT_SENDER.admin,
      text,
      isRead: false,
    },
  });

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message: serializeChatMessage(msg) });
}
