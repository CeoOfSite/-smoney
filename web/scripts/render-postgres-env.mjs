/**
 * Render Postgres expects TLS. Prisma/quaint also honors libpq-style PGSSLMODE.
 * We normalize the URL so sslmode is explicit even if Dashboard omits query params.
 */
export function patchDatabaseUrlForRenderPostgres() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !shouldHardenTls(raw)) return;

  try {
    const u = new URL(raw);
    if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return;
    u.searchParams.set("sslmode", "require");
    u.searchParams.set("connect_timeout", "120");
    process.env.DATABASE_URL = u.toString();
  } catch {
    if (!/sslmode=/i.test(raw)) {
      process.env.DATABASE_URL = raw.includes("?")
        ? `${raw}&sslmode=require&connect_timeout=120`
        : `${raw}?sslmode=require&connect_timeout=120`;
    } else if (!/connect_timeout=/i.test(raw)) {
      process.env.DATABASE_URL = raw.includes("?")
        ? `${raw}&connect_timeout=120`
        : `${raw}?connect_timeout=120`;
    }
  }

  process.env.PGSSLMODE = "require";
  console.error("[render] TLS params applied for managed Postgres (sslmode=require)");
}

function isRenderPostgresUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith("postgres.render.com") ||
      host.startsWith("dpg-") ||
      host.includes(".oregon-postgres.render.com")
    );
  } catch {
    return /postgres\.render\.com/i.test(url);
  }
}

function shouldHardenTls(url) {
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) return false;
  if (process.env.RENDER === "true") return true;
  return isRenderPostgresUrl(url);
}
