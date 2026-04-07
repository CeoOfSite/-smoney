"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { t, type LangCode } from "@/lib/i18n";

type ChatMsg = { id: string; sender: "user" | "admin"; text: string; createdAt: string };

const POLL_OPEN_MS = 7000;
const POLL_CLOSED_MS = 9000;

function readLang(): LangCode {
  if (typeof window === "undefined") return "ru";
  const v = localStorage.getItem("chez_lang") as LangCode | null;
  return v === "en" || v === "zh" || v === "ru" ? v : "ru";
}

export function ChatDock() {
  const [lang, setLang] = useState<LangCode>("ru");
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unreadFromAdmin, setUnreadFromAdmin] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(readLang());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "chez_lang" && e.newValue) {
        const v = e.newValue as LangCode;
        if (v === "en" || v === "zh" || v === "ru") setLang(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    setLoggedIn(res.ok && !!(await res.json().catch(() => null))?.user);
  }, []);

  const fetchCounts = useCallback(async () => {
    const res = await fetch("/api/chat?counts=1", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { unreadFromAdmin?: number; conversationId?: string | null };
    setUnreadFromAdmin(typeof data.unreadFromAdmin === "number" ? data.unreadFromAdmin : 0);
    if (data.conversationId) setConversationId(data.conversationId);
  }, []);

  const fetchFull = useCallback(async () => {
    const res = await fetch("/api/chat", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { conversationId?: string | null; messages?: ChatMsg[] };
    setConversationId(data.conversationId ?? null);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setUnreadFromAdmin(0);
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (loggedIn !== true) return;
    if (open) {
      setLoading(true);
      void fetchFull().finally(() => setLoading(false));
      const id = window.setInterval(() => void fetchFull(), POLL_OPEN_MS);
      return () => clearInterval(id);
    }
    void fetchCounts();
    const id = window.setInterval(() => void fetchCounts(), POLL_CLOSED_MS);
    return () => clearInterval(id);
  }, [loggedIn, open, fetchFull, fetchCounts]);

  useEffect(() => {
    if (open) requestAnimationFrame(scrollToBottom);
  }, [messages, open, scrollToBottom]);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (data?.error === "rate_limited") setSendError(t("chatRateLimited", lang));
        else setSendError(t("chatError", lang));
        return;
      }
      setText("");
      await fetchFull();
    } finally {
      setSending(false);
    }
  }, [text, sending, fetchFull, lang]);

  const onToggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) void refreshMe();
      else setSendError(null);
      return next;
    });
  };

  const showBadge = loggedIn === true && unreadFromAdmin > 0 && !open;

  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open ? (
        <div
          className="flex h-[min(420px,70dvh)] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-zinc-700/90 bg-[#121214] shadow-2xl shadow-black/50"
          role="dialog"
          aria-label={t("chatTitle", lang)}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
            <span className="text-sm font-semibold text-zinc-100">{t("chatTitle", lang)}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label={t("tradeSubmitModalClose", lang)}
            >
              ×
            </button>
          </div>

          {loggedIn === false ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm text-zinc-400">{t("chatLoginPrompt", lang)}</p>
              <a
                href="/api/auth/steam"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
              >
                {t("loginSteam", lang)}
              </a>
            </div>
          ) : loggedIn === null ? (
            <div className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-500">{t("chatLoading", lang)}</div>
          ) : (
            <>
              <div
                ref={listRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
              >
                {loading && messages.length === 0 ? (
                  <p className="text-center text-xs text-zinc-500">{t("chatLoading", lang)}</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-zinc-500">{t("chatEmpty", lang)}</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-sm leading-snug ${
                        m.sender === "user"
                          ? "ml-auto bg-amber-600/25 text-amber-50"
                          : "mr-auto bg-zinc-800 text-zinc-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="mt-0.5 text-[9px] opacity-60">
                        {new Date(m.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : lang === "zh" ? "zh-CN" : "en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {sendError ? <p className="px-3 text-center text-[11px] text-red-400">{sendError}</p> : null}
              <div className="border-t border-zinc-800 p-2">
                <div className="flex gap-1.5">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={t("chatPlaceholder", lang)}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-600/30"
                  />
                  <button
                    type="button"
                    disabled={!text.trim() || sending}
                    onClick={() => void send()}
                    className="shrink-0 self-end rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("chatSend", lang)}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        title={showBadge ? t("chatNewBadge", lang) : t("chatOpen", lang)}
        aria-label={t("chatOpen", lang)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-700/50 bg-gradient-to-br from-amber-600 to-amber-800 text-2xl shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95"
      >
        <span aria-hidden>💬</span>
        {showBadge ? (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[#121214]">
            {unreadFromAdmin > 9 ? "9+" : unreadFromAdmin}
          </span>
        ) : null}
      </button>
    </div>
  );
}
