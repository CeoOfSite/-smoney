"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdminPagination } from "@/app/admin/admin-pagination";
import { AdminTradeUrlField } from "@/app/admin/admin-trade-url";

import { UserBanToggle } from "./user-ban-toggle";

type UserRow = {
  steamId: string;
  displayName: string | null;
  tradeUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isBanned: boolean;
  isAdmin: boolean;
};

export default function AdminUsersClient({ currentAdminSteamId }: { currentAdminSteamId: string }) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const prevDebouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevDebouncedRef.current === null) {
      prevDebouncedRef.current = debouncedSearch;
      return;
    }
    if (prevDebouncedRef.current !== debouncedSearch) {
      prevDebouncedRef.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/users?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setError("Нет доступа");
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Ошибка загрузки");
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const list = Array.isArray(data?.data) ? (data.data as UserRow[]) : [];
      setRows(list);
      setTotal(typeof data?.total === "number" ? data.total : 0);
      setTotalPages(typeof data?.totalPages === "number" ? Math.max(1, data.totalPages) : 1);
    } catch {
      setError("Сеть недоступна");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Пользователи</h1>
      <p className="text-sm text-zinc-500">
        {loading ? "Загрузка…" : `Всего в выборке: ${total}`}
      </p>

      <div className="max-w-md">
        <label htmlFor="admin-user-search" className="block text-xs font-medium uppercase text-zinc-500">
          Поиск по Steam ID
        </label>
        <input
          id="admin-user-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Например 76561198…"
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="px-4 py-3">Имя Steam</th>
              <th className="px-4 py-3">Steam ID</th>
              <th className="px-4 py-3">Trade link</th>
              <th className="px-4 py-3">Регистрация</th>
              <th className="px-4 py-3">Последний вход</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3 text-right">Действие</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length > 0
              ? rows.map((u) => (
                  <tr key={u.steamId} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <span className="text-zinc-900 dark:text-zinc-100">{u.displayName ?? "—"}</span>
                      {u.isAdmin ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          админ
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{u.steamId}</td>
                    <td className="max-w-[min(280px,28vw)] px-4 py-2 align-top">
                      <AdminTradeUrlField url={u.tradeUrl ?? null} variant="table" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(u.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {u.isBanned ? (
                        <span className="text-red-600 dark:text-red-400">Заблокирован</span>
                      ) : (
                        <span className="text-zinc-500">Активен</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <UserBanToggle
                        steamId={u.steamId}
                        isBanned={u.isBanned}
                        currentAdminSteamId={currentAdminSteamId}
                        onChanged={refetch}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Загрузка…</p>
        ) : null}
        {!loading && rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Пользователи не найдены</p>
        ) : null}
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
      </div>
    </main>
  );
}
