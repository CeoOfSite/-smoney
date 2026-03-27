import { NextRequest, NextResponse } from "next/server";

import { steamLoginRedirectUrl } from "@/lib/steam-openid";

export async function GET(request: NextRequest) {
  try {
    const url = steamLoginRedirectUrl(request);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
