import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE_NAME = "csmoney_session";

const WEEK_SEC = 60 * 60 * 24 * 7;

function getJwtSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(s);
}

export async function signSessionToken(steamId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(steamId)
    .setIssuedAt()
    .setExpirationTime(`${WEEK_SEC}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ steamId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const steamId = (payload as JWTPayload).sub;
    if (!steamId || typeof steamId !== "string") return null;
    return { steamId };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK_SEC,
  };
}
