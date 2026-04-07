"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { t, type LangCode } from "@/lib/i18n";

type Row = {
  id: string;
  userSteamId: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  updatedAt: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastSender: "user" | "admin" | null;
  unreadFromUser: number;
};

type ChatMsg = { id: string; sender: "user" | "admin"; text: string; createdAt: string };

const POLL_LIST_MS = 8000;
const POLL_THREAD_MS = 7000;

function readLang(): LangCode {
  if (typeof window === "undefined") return "ru";
  const v = localStorage.getItem("chez_lang") as LangCode | null;
  return v === "en" || v === "zh" || v === "ru" ? v : "ru";
}

export default function AdminChatClient() {
  const [lang, setLang] = useState<LangCode>("ru");
  const [rows, setRows] = useState<Row[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadUser, setThreadUser] = useState<{
    steamId: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [steamInput, setSteamInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(readLang());
  }, []);

  const scrollBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/chat", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { data?: Row[]; totalUnreadUserMessages?: number };
    setRows(Array.isArray(data.data) ? data.data : []);
    setTotalUnread(typeof data.totalUnreadUserMessages === "number" ? data.totalUnreadUserMessages : 0);
  }, []);

  const loadThread = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/chat/${id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversation?: {
          id: string;
          userSteamId: string;
          userDisplayName: string | null;
          userAvatarUrl: string | null;
        };
        messages?: ChatMsg[];
      };
      if (data.conversation) {
        setThreadUser({
          steamId: data.conversation.userSteamId,
          displayName: data.conversation.userDisplayName,
          avatarUrl: data.conversation.userAvatarUrl,
        });
      }
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      requestAnimationFrame(scrollBottom);
    },
    [scrollBottom],
  );

  useEffect(() => {
    void loadList();
    const id = window.setInterval(() => void loadList(), POLL_LIST_MS);
    return () => clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const id = window.setInterval(() => void loadThread(selectedId), POLL_THREAD_MS);
    return () => clearInterval(id);
  }, [selectedId, loadThread]);

  useEffect(() => {
    requestAnimationFrame(scrollBottom);
  }, [messages, scrollBottom]);

  const startChat = async () => {
    setBusy(true);
    setStartError(null);
    try {
      const res = await fetch("/api/admin/chat/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: steamInput.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { conversationId?: string; error?: string } | null;
      if (!res.ok) {
        if (data?.error === "user_not_found") setStartError(t("adminChatUserNotFound", lang));
        else if (data?.error === "invalid_steam_id") setStartError(t("adminChatInvalidSteam", lang));
        else setStartError(t("errorGenericShort", lang));
        return;
      }
      if (data?.conversationId) {
        setSteamInput("");
        await loadList();
        setSelectedId(data.conversationId);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendAdmin = async () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedId || busy) return;
    setBusy(true);
    setSendError(null);
    try {
      const res = await fetch("/api/admin/chat/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, text: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (data?.error === "rate_limited") setSendError(t("chatRateLimited", lang));
        else setSendError(t("chatError", lang));
        return;
      }
      setText("");
      await loadThread(selectedId);
      await loadList();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("adminChatTitle", lang)}</h1>
          {totalUnread > 0 ? (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              {t("adminChatUnread", lang)}: {totalUnread}
            </p>
          ) : null}
        </div>
        <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={steamInput}
            onChange={(e) => setSteamInput(e.target.value)}
            placeholder={t("adminChatStartSteam", lang)}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            disabled={busy || !steamInput.trim()}
            onClick={() => void startChat()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
          >
            {t("adminChatStartBtn", lang)}
          </button>
        </div>
      </div>
      {startError ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{startError}</p> : null}

      <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {t("adminChatTitle", lang)}
          </div>
          <ul className="max-h-[min(60vh,560px)] overflow-y-auto">
            {rows.length === 0 ? (
              <li className="p-4 text-center text-sm text-zinc-500">{t("adminChatNoConversations", lang)}</li>
            ) : (
              rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full gap-2 border-b border-zinc-100 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/80 ${
                      selectedId === r.id ? "bg-amber-50 dark:bg-amber-950/30" : ""
                    } ${r.unreadFromUser > 0 ? "ring-1 ring-inset ring-amber-400/40" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.userAvatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg"}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {r.userDisplayName || r.userSteamId}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">{r.userSteamId}</p>
                      {r.lastMessagePreview ? (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                          {r.lastSender === "admin" ? `${t("adminChatYou", lang)}: ` : ""}
                          {r.lastMessagePreview}
                        </p>
                      ) : null}
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                        {r.lastMessageAt ? (
                          <span>
                            {t("adminChatLastMessage", lang)}:{" "}
                            {new Date(r.lastMessageAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                        {r.unreadFromUser > 0 ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            +{r.unreadFromUser}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex min-h-[480px] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
              {t("adminChatSelect", lang)}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <button
                  type="button"
                  className="lg:hidden rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                  onClick={() => setSelectedId(null)}
                >
                  {t("adminChatBack", lang)}
                </button>
                {threadUser ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        threadUser.avatarUrl ||
                        "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg"
                      }
                      alt=""
                      className="h-9 w-9 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {threadUser.displayName || threadUser.steamId}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{threadUser.steamId}</p>
                    </div>
                  </>
                ) : null}
              </div>
              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${
                      m.sender === "user"
                        ? "mr-auto bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "ml-auto bg-amber-600/90 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className="mt-1 text-[9px] opacity-70">
                      {new Date(m.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
              {sendError ? <p className="px-3 text-center text-xs text-red-500">{sendError}</p> : null}
              <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
                <div className="flex gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendAdmin();
                      }
                    }}
                    placeholder={t("chatPlaceholder", lang)}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    disabled={!text.trim() || busy}
                    onClick={() => void sendAdmin()}
                    className="shrink-0 self-end rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
                  >
                    {t("chatSend", lang)}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/admin" className="text-amber-600 hover:underline dark:text-amber-400">
          ← {t("backToAdmin", lang)}
        </Link>
      </p>
    </div>
  );
}
