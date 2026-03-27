/** Optional: enrich user from Steam Web API (needs STEAM_WEB_API_KEY). */
export async function fetchSteamPlayerSummary(steamId: string): Promise<{
  displayName: string | null;
  avatarUrl: string | null;
}> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) {
    return { displayName: null, avatarUrl: null };
  }

  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.searchParams.set("key", key);
  url.searchParams.set("steamids", steamId);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return { displayName: null, avatarUrl: null };
    const data = (await res.json()) as {
      response?: { players?: Array<{ personaname?: string; avatarfull?: string }> };
    };
    const p = data.response?.players?.[0];
    return {
      displayName: p?.personaname ?? null,
      avatarUrl: p?.avatarfull ?? null,
    };
  } catch {
    return { displayName: null, avatarUrl: null };
  }
}
