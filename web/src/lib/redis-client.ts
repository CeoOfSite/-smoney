/**
 * Singleton Redis client for shared cache (Render Key Value / local Redis).
 * When REDIS_URL is unset, returns null and callers use in-memory fallback.
 */

import "server-only";

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  __csmoneyRedis?: Redis | null;
};

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    reconnectOnError: (err) => err.message.includes("READONLY"),
  });
  client.on("error", (err) => console.warn("[redis]", err.message));
  return client;
}

/** Shared client; null if REDIS_URL is not set. */
export function getRedis(): Redis | null {
  if (globalForRedis.__csmoneyRedis === undefined) {
    globalForRedis.__csmoneyRedis = createRedis();
  }
  return globalForRedis.__csmoneyRedis;
}
