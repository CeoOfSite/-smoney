"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { t, type LangCode } from "@/lib/i18n";

const STORAGE_KEY = "chez_cookie_consent";

function detectLang(): LangCode {
  if (typeof window === "undefined") return "ru";
  try {
    const stored = localStorage.getItem("chez_lang") as LangCode | null;
    if (stored === "en" || stored === "zh" || stored === "ru") return stored;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() ?? "" : "";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";
  return "ru";
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<LangCode>("ru");

  useEffect(() => {
    setLang(detectLang());
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    setVisible(true);
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("cookieBannerAria", lang)}
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-zinc-800/80 bg-[#0f0f12]/95 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-6 sm:py-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-balance text-[11px] leading-snug text-zinc-400 sm:text-xs">{t("cookieBannerText", lang)}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/cookies"
            className="text-[11px] font-medium text-amber-500/90 underline-offset-2 hover:text-amber-400 hover:underline sm:text-xs"
          >
            {t("cookieBannerMore", lang)}
          </Link>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-600/15 transition-colors hover:bg-amber-500 active:scale-[0.98]"
          >
            {t("cookieBannerAccept", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
