import type { NextRequest } from "next/server";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

/** Build absolute URL for OpenID return_to / realm from incoming request. */
export function steamOpenIdOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  return new URL(request.url).origin;
}

export function steamLoginRedirectUrl(request: NextRequest): string {
  const origin = steamOpenIdOrigin(request);
  const returnTo = `${origin}/api/auth/steam/callback`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

/**
 * Validate Steam OpenID callback: POST all openid.* params back with mode check_authentication.
 */
export async function verifySteamAssertion(
  request: NextRequest,
): Promise<{ steamId: string } | { error: string }> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("openid.mode");
  if (mode !== "id_res") {
    return { error: "invalid_mode" };
  }

  const body = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) {
      body.append(key, value);
    }
  });
  body.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!text.includes("is_valid:true")) {
    return { error: "not_valid" };
  }

  const claimed = url.searchParams.get("openid.claimed_id");
  if (!claimed) return { error: "no_claimed_id" };

  const m = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/.exec(claimed);
  if (!m) return { error: "bad_claimed_id" };

  return { steamId: m[1] };
}
