import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import type { User } from "@prisma/client";

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const parsed = await verifySessionToken(token);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({
    where: { steamId: parsed.steamId },
  });

  if (!user || user.isBanned) return null;
  return user;
}
