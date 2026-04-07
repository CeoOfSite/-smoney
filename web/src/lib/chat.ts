import { prisma as prismaSingleton } from "@/lib/prisma";

/** Matches Prisma enum `ChatSender` — defined here so chat code does not import enum types from `@prisma/client` (avoids TS2305 when `prisma generate` is stale). */
export type ChatSender = "user" | "admin";

export const CHAT_SENDER: Record<"user" | "admin", ChatSender> = {
  user: "user",
  admin: "admin",
};

/** Row shape for `ChatConversation` (mirrors Prisma model; kept local so this file does not depend on generated `PrismaClient` chat delegates). */
type ChatConversationRow = {
  id: string;
  userSteamId: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Narrow view of the DB client used only in this module (avoids TS2339 when tooling resolves an older `PrismaClient` without chat models). */
type ChatDb = {
  chatConversation: {
    findUnique(args: { where: { userSteamId: string } }): Promise<ChatConversationRow | null>;
    create(args: { data: { userSteamId: string } }): Promise<ChatConversationRow>;
  };
  chatMessage: {
    findFirst(args: {
      where:
        | { conversationId: string; sender: ChatSender }
        | { conversation: { userSteamId: string }; sender: ChatSender };
      orderBy: { createdAt: "desc" };
      select: { createdAt: true };
    }): Promise<{ createdAt: Date } | null>;
  };
};

const db: ChatDb = prismaSingleton as unknown as ChatDb;

export const CHAT_MESSAGE_MAX_LEN = 4000;
/** Minimum delay between messages from the same party (anti-spam). */
export const CHAT_SEND_MIN_INTERVAL_MS = 2500;

export function normalizeChatText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.length > CHAT_MESSAGE_MAX_LEN) return null;
  return s;
}

export async function getOrCreateConversation(userSteamId: string) {
  const existing = await db.chatConversation.findUnique({
    where: { userSteamId },
  });
  if (existing) return existing;
  return db.chatConversation.create({
    data: { userSteamId },
  });
}

export async function assertUserCanSend(steamId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const last = await db.chatMessage.findFirst({
    where: { conversation: { userSteamId: steamId }, sender: CHAT_SENDER.user },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < CHAT_SEND_MIN_INTERVAL_MS) {
    return { ok: false, status: 429, error: "rate_limited" };
  }
  return { ok: true };
}

export async function assertAdminCanSend(conversationId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const last = await db.chatMessage.findFirst({
    where: { conversationId, sender: CHAT_SENDER.admin },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < CHAT_SEND_MIN_INTERVAL_MS) {
    return { ok: false, status: 429, error: "rate_limited" };
  }
  return { ok: true };
}

/** Accepts Steam ID64 or common URL forms; returns normalized ID64 or null. */
export function parseSteamId64Input(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/7656119[0-9]{10}/);
  if (m) return m[0];
  if (/^7656119[0-9]{10}$/.test(s)) return s;
  return null;
}

export function serializeChatMessage(m: {
  id: string;
  sender: ChatSender;
  text: string;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: m.id,
    sender: m.sender,
    text: m.text,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
  };
}
