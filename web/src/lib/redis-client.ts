/**
 * Singleton Redis client for shared cache (Render Key Value / local Redis).
 * When REDIS_URL is unset, returns null and callers use in-memory fallback.
 *
 * Render internal URLs use hostname `red-xxxxxxxx` — they resolve only inside Render’s
 * private network (and only when Key Value and web service are in the same region).
 * Outside Render, use an external URL (rediss://… from the dashboard) or unset REDIS_URL.
 */

import "server-only";

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  __csmoneyRedis?: Redis | null;
  __csmoneyRedisFatal?: boolean;
};

/** Single-label host `red-…` = Render internal Redis; not on public DNS. */
function isRenderInternalRedisHost(hostname: string): boolean {
  return hostname.length > 0 && !hostname.includes(".") && /^red-[a-z0-9]+$/i.test(hostname);
}

function normalizeRedisUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
    u = u.slice(1, -1).trim();
  }
  return u || null;
}

function warnOnce(key: string, message: string) {
  const g = globalForRedis as unknown as Record<string, boolean>;
  if (g[key]) return;
  g[key] = true;
  console.warn(message);
}

function createRedis(): Redis | null {
  const urlStr = normalizeRedisUrl(process.env.REDIS_URL);
  if (!urlStr) return null;

  let host: string;
  try {
    host = new URL(urlStr).hostname;
  } catch {
    warnOnce("__redisBadUrl", "[redis] Invalid REDIS_URL (not a valid URL). Inventory cache uses memory only.");
    return null;
  }

  const onRender = process.env.RENDER === "true";

  if (isRenderInternalRedisHost(host) && !onRender) {
    warnOnce(
      "__redisInternalOffRender",
      `[redis] REDIS_URL uses Render internal host "${host}" — it does not resolve on your machine. ` +
        `Unset REDIS_URL for local dev, or use the external Key Value URL (rediss://…) with TLS and your IP in the allow list. ` +
        `Inventory cache falls back to in-memory.`,
    );
    return null;
  }

  const client = new Redis(urlStr, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy: () => null,
    reconnectOnError: () => false,
  });

  client.on("error", (err: Error & { code?: string }) => {
    if (globalForRedis.__csmoneyRedisFatal) return;
    const code = err.code ?? "";
    const msg = err.message ?? "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("ENOTFOUND")) {
      globalForRedis.__csmoneyRedisFatal = true;
      globalForRedis.__csmoneyRedis = null;
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
      warnOnce(
        "__redisEnotfound",
        `[redis] ${msg} — disabled for this process; using in-memory inventory cache. ` +
          `On Render: use Key Value in the same region as the web service, or set REDIS_URL to the external rediss URL. ` +
          `Locally: unset REDIS_URL or use the external URL.`,
      );
    } else {
      console.warn("[redis]", msg);
    }
  });

  return client;
}

/** Shared client; null if REDIS_URL is not set or Redis was disabled after a fatal error. */
export function getRedis(): Redis | null {
  if (globalForRedis.__csmoneyRedisFatal) return null;
  if (globalForRedis.__csmoneyRedis === undefined) {
    globalForRedis.__csmoneyRedis = createRedis();
  }
  return globalForRedis.__csmoneyRedis;
}
